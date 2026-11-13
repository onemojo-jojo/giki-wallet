-- +goose Up
CREATE TABLE giki_transport.user_quota_overrides (
    user_id UUID NOT NULL REFERENCES giki_wallet.users(id) ON DELETE CASCADE,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('OUTBOUND', 'INBOUND')),
    week_start DATE NOT NULL,
    extra_bookings SMALLINT NOT NULL DEFAULT 1 CHECK (extra_bookings BETWEEN 1 AND 10),
    expires_at TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    granted_by UUID REFERENCES giki_wallet.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, direction, week_start)
);

CREATE INDEX user_quota_overrides_expires_at_idx
    ON giki_transport.user_quota_overrides (expires_at);

-- +goose Down
DROP TABLE IF EXISTS giki_transport.user_quota_overrides;
