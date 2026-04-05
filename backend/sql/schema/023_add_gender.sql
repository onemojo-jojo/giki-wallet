-- +goose Up
ALTER TABLE giki_wallet.users ADD COLUMN gender VARCHAR(10);

-- +goose Down
ALTER TABLE giki_wallet.users DROP COLUMN IF EXISTS gender;
