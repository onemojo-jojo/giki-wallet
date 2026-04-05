-- name: CreateUser :one
INSERT INTO giki_wallet.users(name, email, phone_number, auth_provider, password_hash, password_algo, is_active, is_verified, user_type, gender)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING id, name, email, phone_number, auth_provider, external_id, is_active, is_verified, user_type, gender, created_at, updated_at;

-- name: CreateStudent :one
INSERT INTO giki_wallet.student_profiles(user_id, reg_id, batch_year)
VALUES ($1, $2, $3)
RETURNING user_id, reg_id, degree_program, batch_year;

-- name: CreateEmployee :one
INSERT INTO giki_wallet.employee_profiles(user_id)
Values ($1)
RETURNING user_id, employee_id, designation, department;

-- name: GetUserByEmail :one
SELECT id, name, email, phone_number, auth_provider, external_id, is_active, is_verified, user_type, gender, created_at, updated_at
FROM giki_wallet.users
WHERE giki_wallet.users.email = $1;

-- name: GetUserAuthByEmail :one
SELECT id, name, email, phone_number, auth_provider, external_id, password_hash, password_algo, is_active, is_verified, user_type, gender, created_at, updated_at
FROM giki_wallet.users
WHERE giki_wallet.users.email = $1;

-- name: GetUserByRegOrEmail :one
SELECT u.id, u.name, u.email, u.phone_number, u.auth_provider, u.external_id, u.is_active, u.is_verified, u.user_type, u.gender, u.created_at, u.updated_at
FROM giki_wallet.users as u
JOIN giki_wallet.student_profiles as s ON u.id = s.user_id
WHERE u.email = $1 or s.reg_id = $2;

-- name: DeleteAllTokensForUser :exec
DELETE FROM giki_wallet.access_tokens
WHERE user_id = $1;

-- name: GetUserByID :one
SELECT id, name, email, phone_number, auth_provider, external_id, is_active, is_verified, user_type, gender, created_at, updated_at
FROM giki_wallet.users
WHERE id = $1;

-- name: GetUserAuthByID :one
SELECT id, name, email, phone_number, auth_provider, external_id, password_hash, password_algo, is_active, is_verified, user_type, gender, created_at, updated_at
FROM giki_wallet.users
WHERE id = $1;

-- name: UpdateUserVerification :one
UPDATE giki_wallet.users
SET is_verified = TRUE, is_active = TRUE, updated_at = NOW()
WHERE id = $1
RETURNING id, name, email, phone_number, auth_provider, external_id, is_active, is_verified, user_type, gender, created_at, updated_at;

-- name: CreateAccessToken :exec
INSERT INTO giki_wallet.access_tokens(token_hash, user_id, type, expires_at)
VALUES ($1, $2, $3, $4);

-- name: ListUsers :many
SELECT id, name, email, phone_number, is_active, is_verified, user_type, gender, created_at, updated_at, COUNT(*) OVER() as total_count
FROM giki_wallet.users
WHERE 
    (sqlc.arg('search')::text = '' OR 
     name ILIKE '%' || sqlc.arg('search')::text || '%' OR 
     email ILIKE '%' || sqlc.arg('search')::text || '%' OR 
     phone_number ILIKE '%' || sqlc.arg('search')::text || '%')
    AND (sqlc.arg('user_type')::text = '' OR user_type = sqlc.arg('user_type')::text)
    AND (
        sqlc.arg('filter_status')::text = ''
        OR (sqlc.arg('filter_status')::text = 'active' AND is_active = TRUE)
        OR (sqlc.arg('filter_status')::text = 'inactive' AND is_active = FALSE)
    )
ORDER BY created_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: UpdateUserStatus :one
UPDATE giki_wallet.users
SET is_active = $2, updated_at = NOW()
WHERE id = $1
RETURNING id, name, email, phone_number, is_active, is_verified, user_type, gender, created_at, updated_at;

-- name: UpdateUserDetails :one
UPDATE giki_wallet.users
SET 
    name = COALESCE(NULLIF(sqlc.arg('name')::text, ''), name),
    email = COALESCE(NULLIF(sqlc.arg('email')::text, ''), email),
    phone_number = COALESCE(NULLIF(sqlc.arg('phone_number')::text, ''), phone_number),
    gender = COALESCE(NULLIF(sqlc.arg('gender')::text, ''), gender),
    updated_at = NOW()
WHERE id = $1
RETURNING id, name, email, phone_number, auth_provider, external_id, is_active, is_verified, user_type, gender, created_at, updated_at;

-- name: DeleteUser :exec
DELETE FROM giki_wallet.users
WHERE id = $1;

-- name: UpdateUserPasswordWithAlgo :one
UPDATE giki_wallet.users
SET password_hash = $2, password_algo = $3, updated_at = NOW()
WHERE id = $1
RETURNING id, name, email, phone_number, is_active, is_verified, user_type, gender, created_at, updated_at;
