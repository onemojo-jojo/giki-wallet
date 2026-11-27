package transport

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/hash-walker/giki-wallet/internal/transport/transport_db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/require"
)

type recordingDB struct {
	sql   string
	args  []any
	row   pgx.Row
	calls int
}

func (db *recordingDB) Exec(context.Context, string, ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, nil
}

func (db *recordingDB) Query(context.Context, string, ...any) (pgx.Rows, error) {
	return nil, nil
}

func (db *recordingDB) QueryRow(_ context.Context, sql string, args ...any) pgx.Row {
	db.calls++
	db.sql = sql
	db.args = append([]any(nil), args...)
	return db.row
}

type fixedRow struct {
	value int
	err   error
}

func (r fixedRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	extra := dest[0].(*int)
	*extra = r.value
	return nil
}

func TestGetQuotaExtraBookingsUsesPassedDB(t *testing.T) {
	loc := mustKarachi(t)
	svc := &Service{loc: loc, dbPool: nil}
	userID := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	reference := time.Date(2024, 1, 3, 12, 0, 0, 0, loc)

	first := &recordingDB{row: fixedRow{value: 2}}
	second := &recordingDB{row: fixedRow{value: 5}}

	got, err := svc.GetQuotaExtraBookings(context.Background(), first, userID, "OUTBOUND", reference)
	require.NoError(t, err)
	require.Equal(t, 2, got)
	require.Equal(t, 1, first.calls)
	require.Zero(t, second.calls)

	got, err = svc.GetQuotaExtraBookings(context.Background(), second, userID, "INBOUND", reference)
	require.NoError(t, err)
	require.Equal(t, 5, got)
	require.Equal(t, 1, first.calls)
	require.Equal(t, 1, second.calls)
	require.Equal(t, "INBOUND", second.args[1])
}

func TestGetQuotaExtraBookingsWeekStart(t *testing.T) {
	loc := mustKarachi(t)
	svc := &Service{loc: loc}
	userID := uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")

	tests := []struct {
		name      string
		direction string
		at        time.Time
		weekStart string
	}{
		{
			name:      "monday",
			direction: "OUTBOUND",
			at:        time.Date(2024, 1, 1, 15, 30, 0, 0, loc),
			weekStart: "2024-01-01",
		},
		{
			name:      "wednesday",
			direction: "INBOUND",
			at:        time.Date(2024, 1, 3, 9, 0, 0, 0, loc),
			weekStart: "2024-01-01",
		},
		{
			name:      "sunday",
			direction: "OUTBOUND",
			at:        time.Date(2024, 1, 7, 23, 0, 0, 0, loc),
			weekStart: "2024-01-01",
		},
		{
			name:      "utc sunday is monday in karachi",
			direction: "INBOUND",
			at:        time.Date(2024, 1, 7, 20, 0, 0, 0, time.UTC),
			weekStart: "2024-01-08",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := &recordingDB{row: fixedRow{value: 4}}

			got, err := svc.GetQuotaExtraBookings(context.Background(), db, userID, tt.direction, tt.at)
			require.NoError(t, err)
			require.Equal(t, 4, got)
			require.Equal(t, 1, db.calls)
			require.Equal(t, []any{userID, tt.direction, tt.weekStart}, db.args)

			require.Contains(t, db.sql, "COALESCE(MAX(extra_bookings), 0)")
			require.Contains(t, db.sql, "FROM giki_transport.user_quota_overrides")
			require.Contains(t, db.sql, "user_id = $1")
			require.Contains(t, db.sql, "direction = $2")
			require.Contains(t, db.sql, "week_start = $3::date")
			require.Contains(t, db.sql, "expires_at > statement_timestamp()")
		})
	}
}

func mustKarachi(t *testing.T) *time.Location {
	t.Helper()
	loc, err := time.LoadLocation("Asia/Karachi")
	require.NoError(t, err)
	return loc
}

var _ transport_db.DBTX = (*recordingDB)(nil)
