package transport

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
)

const (
	holdSeatsCallers         = 4
	holdSeatsRequestTimeout  = 5 * time.Second
	quotaRuleBarrierWait     = 4 * time.Second
	holdSeatsPoolCleanupWait = 15 * time.Second
)

// TestHoldSeatsDoesNotNeedSecondPoolConnection fails if HoldSeats takes a
// second pool connection for the quota override lookup.
//
// The test pool has MaxConns equal to the number of concurrent calls. An
// admin transaction locks quota_rules until every call has started its own
// transaction and is waiting in GetQuotaRule, so each call already holds one
// of the only four connections. Releasing that lock lets the calls continue
// into GetQuotaExtraBookings. Those calls succeed only when the lookup uses
// the open transaction. Taking another connection from the pool leaves every
// caller waiting until its five-second context expires.
func TestHoldSeatsDoesNotNeedSecondPoolConnection(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}

	runID := strings.ReplaceAll(uuid.New().String(), "-", "")
	adminPool := openConfiguredPool(t, databaseURL, 4, "holdseats-admin-"+runID[:12])
	appName := "holdseats-pool-" + runID[:12]
	testPool := openConfiguredPool(t, databaseURL, holdSeatsCallers, appName)
	require.Equal(t, int32(holdSeatsCallers), testPool.Stat().MaxConns())

	loc := mustKarachi(t)
	svc := NewService(testPool, nil, nil, loc)

	seedCtx, seedCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer seedCancel()
	fixture := seedHoldSeatsDeadlockFixture(t, seedCtx, adminPool, runID)

	var (
		barrierTx   pgx.Tx
		releaseOnce sync.Once
		wg          sync.WaitGroup
	)
	releaseBarrier := func() {
		releaseOnce.Do(func() {
			if barrierTx == nil {
				return
			}
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			err := barrierTx.Rollback(ctx)
			if err != nil && !errors.Is(err, pgx.ErrTxClosed) {
				t.Errorf("release quota_rules barrier: %v", err)
			}
		})
	}
	t.Cleanup(func() {
		releaseBarrier()
		done := make(chan struct{})
		go func() {
			wg.Wait()
			close(done)
		}()
		select {
		case <-done:
		case <-time.After(holdSeatsPoolCleanupWait):
			t.Errorf("timed out after %s waiting for HoldSeats calls during cleanup", holdSeatsPoolCleanupWait)
		}
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		cleanupHoldSeatsDeadlockFixture(t, cleanupCtx, adminPool, fixture)
	})

	lockCtx, lockCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer lockCancel()
	var err error
	barrierTx, err = adminPool.Begin(lockCtx)
	require.NoError(t, err)
	_, err = barrierTx.Exec(lockCtx, `LOCK TABLE giki_transport.quota_rules IN ACCESS EXCLUSIVE MODE`)
	require.NoError(t, err)

	results := make([]holdSeatsCallResult, holdSeatsCallers)
	wg.Add(holdSeatsCallers)
	for i := 0; i < holdSeatsCallers; i++ {
		go func(i int, userID uuid.UUID) {
			defer wg.Done()
			reqCtx, cancel := context.WithTimeout(context.Background(), holdSeatsRequestTimeout)
			defer cancel()
			resp, callErr := svc.HoldSeats(reqCtx, userID, fixture.role, HoldSeatsRequest{
				TripID:        fixture.tripID,
				Count:         1,
				PickupStopID:  fixture.pickupStopID,
				DropoffStopID: fixture.dropoffStopID,
			})
			results[i] = holdSeatsCallResult{resp: resp, err: callErr}
		}(i, fixture.userIDs[i])
	}

	waitCtx, waitCancel := context.WithTimeout(context.Background(), quotaRuleBarrierWait)
	defer waitCancel()
	require.NoError(t, waitForUngrantedQuotaRuleLocks(waitCtx, adminPool, appName, holdSeatsCallers))

	releaseBarrier()
	waitGroupWithTimeout(t, &wg, holdSeatsRequestTimeout+time.Second)

	seen := make(map[uuid.UUID]struct{}, holdSeatsCallers)
	for i, result := range results {
		require.NoErrorf(t, result.err, "HoldSeats caller %d", i)
		require.NotNilf(t, result.resp, "HoldSeats caller %d", i)
		require.Lenf(t, result.resp.Holds, 1, "HoldSeats caller %d", i)
		holdID := result.resp.Holds[0].HoldID
		require.NotEqualf(t, uuid.Nil, holdID, "HoldSeats caller %d", i)
		_, dup := seen[holdID]
		require.Falsef(t, dup, "duplicate hold id %s", holdID)
		seen[holdID] = struct{}{}
	}
	require.Equal(t, int32(0), testPool.Stat().AcquiredConns(), "HoldSeats left pool connections checked out")

	countCtx, countCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer countCancel()
	var stored int
	err = adminPool.QueryRow(countCtx, `SELECT COUNT(*) FROM giki_transport.trip_holds WHERE trip_id = $1`, fixture.tripID).Scan(&stored)
	require.NoError(t, err)
	require.Equal(t, holdSeatsCallers, stored)
}

type holdSeatsCallResult struct {
	resp *HoldSeatsResponse
	err  error
}

type holdSeatsDeadlockFixture struct {
	role          string
	tripID        uuid.UUID
	routeID       uuid.UUID
	pickupStopID  uuid.UUID
	dropoffStopID uuid.UUID
	userIDs       []uuid.UUID
}

func openConfiguredPool(t *testing.T, databaseURL string, maxConns int32, applicationName string) *pgxpool.Pool {
	t.Helper()
	cfg, err := pgxpool.ParseConfig(databaseURL)
	require.NoError(t, err)
	cfg.MaxConns = maxConns
	cfg.MinConns = 0
	cfg.HealthCheckPeriod = time.Hour
	if cfg.ConnConfig.RuntimeParams == nil {
		cfg.ConnConfig.RuntimeParams = map[string]string{}
	}
	cfg.ConnConfig.RuntimeParams["application_name"] = applicationName

	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	require.NoError(t, pool.Ping(ctx))

	var connectedName string
	err = pool.QueryRow(ctx, `SHOW application_name`).Scan(&connectedName)
	require.NoError(t, err)
	require.Equal(t, applicationName, connectedName)
	return pool
}

func seedHoldSeatsDeadlockFixture(t *testing.T, ctx context.Context, pool *pgxpool.Pool, runID string) holdSeatsDeadlockFixture {
	t.Helper()
	tx, err := pool.Begin(ctx)
	require.NoError(t, err)
	defer func() {
		rbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = tx.Rollback(rbCtx)
	}()

	fixture := holdSeatsDeadlockFixture{
		// Private role so the test never updates a shared quota rule.
		role:    "HS" + runID,
		userIDs: make([]uuid.UUID, holdSeatsCallers),
	}
	err = tx.QueryRow(ctx, `
		INSERT INTO giki_transport.stops (address) VALUES ($1) RETURNING id
	`, "Hold seats pickup "+runID).Scan(&fixture.pickupStopID)
	require.NoError(t, err)
	err = tx.QueryRow(ctx, `
		INSERT INTO giki_transport.stops (address) VALUES ($1) RETURNING id
	`, "Hold seats dropoff "+runID).Scan(&fixture.dropoffStopID)
	require.NoError(t, err)
	err = tx.QueryRow(ctx, `
		INSERT INTO giki_transport.routes (name, origin_stop_id, destination_stop_id)
		VALUES ($1, $2, $3)
		RETURNING id
	`, "Hold seats "+runID, fixture.pickupStopID, fixture.dropoffStopID).Scan(&fixture.routeID)
	require.NoError(t, err)
	err = tx.QueryRow(ctx, `
		INSERT INTO giki_transport.trip (
			route_id, departure_time,
			booking_open_offset_minutes, booking_close_offset_minutes,
			direction, bus_type, total_capacity, available_seats, manual_status
		) VALUES (
			$1, now() + interval '2 days',
			0, 0,
			'OUTBOUND', $2, 100, 100, 'OPEN'
		)
		RETURNING id
	`, fixture.routeID, fixture.role).Scan(&fixture.tripID)
	require.NoError(t, err)
	_, err = tx.Exec(ctx, `
		INSERT INTO giki_transport.quota_rules (user_role, direction, weekly_limit, allow_dependent_booking)
		VALUES ($1, 'OUTBOUND', 10, false)
	`, fixture.role)
	require.NoError(t, err)

	for i := 0; i < holdSeatsCallers; i++ {
		fixture.userIDs[i] = insertTestUser(t, ctx, tx,
			fmt.Sprintf("Hold Seats %d", i),
			fmt.Sprintf("holdseats-%s-%d@example.test", runID, i),
			fmt.Sprintf("%s%02d", runID[:18], i),
		)
	}

	require.NoError(t, tx.Commit(ctx))
	return fixture
}

func cleanupHoldSeatsDeadlockFixture(t *testing.T, ctx context.Context, pool *pgxpool.Pool, fixture holdSeatsDeadlockFixture) {
	t.Helper()
	tx, err := pool.Begin(ctx)
	require.NoError(t, err)
	defer func() {
		rbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = tx.Rollback(rbCtx)
	}()

	exec := func(sql string, args ...any) {
		t.Helper()
		_, execErr := tx.Exec(ctx, sql, args...)
		require.NoError(t, execErr)
	}

	exec(`DELETE FROM giki_transport.trip_holds WHERE trip_id = $1`, fixture.tripID)
	exec(`DELETE FROM giki_transport.tickets WHERE trip_id = $1`, fixture.tripID)
	for _, userID := range fixture.userIDs {
		exec(`DELETE FROM giki_transport.trip_holds WHERE user_id = $1`, userID)
		exec(`DELETE FROM giki_transport.tickets WHERE user_id = $1`, userID)
	}
	exec(`DELETE FROM giki_transport.trip_stops WHERE trip_id = $1`, fixture.tripID)
	exec(`DELETE FROM giki_transport.trip WHERE id = $1`, fixture.tripID)
	exec(`DELETE FROM giki_transport.route_weekly_schedules WHERE route_id = $1`, fixture.routeID)
	exec(`DELETE FROM giki_transport.route_master_stops WHERE route_id = $1`, fixture.routeID)
	exec(`DELETE FROM giki_transport.routes WHERE id = $1`, fixture.routeID)
	exec(`DELETE FROM giki_transport.stops WHERE id = $1`, fixture.pickupStopID)
	exec(`DELETE FROM giki_transport.stops WHERE id = $1`, fixture.dropoffStopID)
	exec(`DELETE FROM giki_transport.quota_rules WHERE user_role = $1 AND direction = 'OUTBOUND'`, fixture.role)
	for _, userID := range fixture.userIDs {
		exec(`DELETE FROM giki_wallet.users WHERE id = $1`, userID)
	}
	require.NoError(t, tx.Commit(ctx))
}

func waitForUngrantedQuotaRuleLocks(ctx context.Context, admin *pgxpool.Pool, applicationName string, want int) error {
	const query = `
		SELECT COUNT(DISTINCT a.pid)::int
		FROM pg_locks l
		JOIN pg_stat_activity a ON a.pid = l.pid
		WHERE l.relation = 'giki_transport.quota_rules'::regclass
		  AND NOT l.granted
		  AND a.application_name = $1
	`
	ticker := time.NewTicker(20 * time.Millisecond)
	defer ticker.Stop()

	var saw int
	for {
		if err := admin.QueryRow(ctx, query, applicationName).Scan(&saw); err != nil {
			return fmt.Errorf("count sessions waiting on quota_rules: %w", err)
		}
		if saw >= want {
			return nil
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("saw %d of %d sessions waiting on quota_rules: %w", saw, want, ctx.Err())
		case <-ticker.C:
		}
	}
}

func waitGroupWithTimeout(t *testing.T, wg *sync.WaitGroup, d time.Duration) {
	t.Helper()
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(d):
		t.Fatalf("timed out after %s waiting for HoldSeats calls", d)
	}
}
