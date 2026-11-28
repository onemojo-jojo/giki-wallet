package transport

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/hash-walker/giki-wallet/internal/transport/transport_db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
)

func TestGetQuotaExtraBookingsPostgreSQL(t *testing.T) {
	pool := openQuotaTestPool(t)
	loc := mustKarachi(t)
	svc := &Service{loc: loc}
	ctx := context.Background()
	token := strings.ReplaceAll(uuid.New().String(), "-", "")
	userID := insertTestUser(t, ctx, pool,
		"Quota Extra Test",
		"quota-extra-"+token+"@example.test",
		token[:20],
	)
	reference := time.Date(2024, 1, 3, 9, 0, 0, 0, loc)
	const weekStart = "2024-01-01"

	t.Cleanup(func() {
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		// user_quota_overrides.user_id references users(id) ON DELETE CASCADE.
		_, err := pool.Exec(cleanupCtx, `DELETE FROM giki_wallet.users WHERE id = $1`, userID)
		require.NoError(t, err)
	})

	t.Run("no matching row", func(t *testing.T) {
		deleteOverrides(t, ctx, pool, userID)

		got, err := svc.GetQuotaExtraBookings(ctx, pool, userID, "OUTBOUND", reference)
		require.NoError(t, err)
		require.Equal(t, 0, got)
	})

	t.Run("valid override on pool and transaction", func(t *testing.T) {
		deleteOverrides(t, ctx, pool, userID)
		insertOverride(t, ctx, pool, userID, "OUTBOUND", weekStart, "1 day", 4)

		got, err := svc.GetQuotaExtraBookings(ctx, pool, userID, "OUTBOUND", reference)
		require.NoError(t, err)
		require.Equal(t, 4, got)

		tx, err := pool.Begin(ctx)
		require.NoError(t, err)
		t.Cleanup(func() { _ = tx.Rollback(ctx) })

		got, err = svc.GetQuotaExtraBookings(ctx, tx, userID, "OUTBOUND", reference)
		require.NoError(t, err)
		require.Equal(t, 4, got)
	})

	t.Run("expired override", func(t *testing.T) {
		deleteOverrides(t, ctx, pool, userID)
		insertOverride(t, ctx, pool, userID, "OUTBOUND", weekStart, "-1 second", 4)

		got, err := svc.GetQuotaExtraBookings(ctx, pool, userID, "OUTBOUND", reference)
		require.NoError(t, err)
		require.Equal(t, 0, got)
	})

	t.Run("other direction", func(t *testing.T) {
		deleteOverrides(t, ctx, pool, userID)
		insertOverride(t, ctx, pool, userID, "INBOUND", weekStart, "1 day", 5)

		got, err := svc.GetQuotaExtraBookings(ctx, pool, userID, "OUTBOUND", reference)
		require.NoError(t, err)
		require.Equal(t, 0, got)

		got, err = svc.GetQuotaExtraBookings(ctx, pool, userID, "INBOUND", reference)
		require.NoError(t, err)
		require.Equal(t, 5, got)
	})

	t.Run("expires while transaction is open", func(t *testing.T) {
		deleteOverrides(t, ctx, pool, userID)

		tx, err := pool.Begin(ctx)
		require.NoError(t, err)
		t.Cleanup(func() { _ = tx.Rollback(ctx) })

		insertOverride(t, ctx, tx, userID, "OUTBOUND", weekStart, "2 seconds", 6)

		got, err := svc.GetQuotaExtraBookings(ctx, tx, userID, "OUTBOUND", reference)
		require.NoError(t, err)
		require.Equal(t, 6, got)

		waitUntilOverrideExpires(t, ctx, tx, userID, "OUTBOUND", weekStart)

		got, err = svc.GetQuotaExtraBookings(ctx, tx, userID, "OUTBOUND", reference)
		require.NoError(t, err)
		require.Equal(t, 0, got)
	})
}

func openQuotaTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	require.NoError(t, pool.Ping(ctx))
	return pool
}

func insertTestUser(t *testing.T, ctx context.Context, db transport_db.DBTX, name, email, phone string) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := db.QueryRow(ctx, `
		INSERT INTO giki_wallet.users (name, email, phone_number, password_hash, user_type)
		VALUES ($1, $2, $3, 'test-hash', 'STUDENT')
		RETURNING id
	`, name, email, phone).Scan(&id)
	require.NoError(t, err)
	require.NotEqual(t, uuid.Nil, id)
	return id
}

func insertOverride(t *testing.T, ctx context.Context, db transport_db.DBTX, userID uuid.UUID, direction, weekStart, expiresIn string, extra int) {
	t.Helper()
	_, err := db.Exec(ctx, `
		INSERT INTO giki_transport.user_quota_overrides
			(user_id, direction, week_start, expires_at, extra_bookings)
		VALUES ($1, $2, $3::date, statement_timestamp() + $4::interval, $5)
	`, userID, direction, weekStart, expiresIn, extra)
	require.NoError(t, err)
}

func deleteOverrides(t *testing.T, ctx context.Context, db transport_db.DBTX, userID uuid.UUID) {
	t.Helper()
	_, err := db.Exec(ctx, `DELETE FROM giki_transport.user_quota_overrides WHERE user_id = $1`, userID)
	require.NoError(t, err)
}

func waitUntilOverrideExpires(t *testing.T, ctx context.Context, tx pgx.Tx, userID uuid.UUID, direction, weekStart string) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for {
		var expired bool
		err := tx.QueryRow(ctx, `
			SELECT expires_at <= statement_timestamp()
			FROM giki_transport.user_quota_overrides
			WHERE user_id = $1 AND direction = $2 AND week_start = $3::date
		`, userID, direction, weekStart).Scan(&expired)
		require.NoError(t, err)
		if expired {
			return
		}
		if time.Now().After(deadline) {
			t.Fatal("override did not expire before the deadline")
		}
		time.Sleep(50 * time.Millisecond)
	}
}
