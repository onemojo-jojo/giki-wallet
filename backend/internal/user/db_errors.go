package user

import (
	"errors"
	"fmt"

	commonerrors "github.com/hash-walker/giki-wallet/internal/common/errors"
	"github.com/jackc/pgx/v5/pgconn"
)

// translateDBError converts PostgreSQL errors to user-friendly error messages
func translateDBError(err error) error {
	// Check if it's a PostgreSQL error
	var pgErr *pgconn.PgError
	ok := errors.As(err, &pgErr)

	if !ok {
		return ErrUserCreationFailed
	}

	if pgErr.Code == "23505" {
		switch pgErr.ConstraintName {
		case "uq_users_email":
			return ErrDuplicateEmail
		case "uq_users_phone":
			return ErrDuplicatePhone
		case "uq_users_reg_number":
			return ErrDuplicateRegID
		default:
			fmt.Printf("ERROR: Unknown unique constraint violation: %s\n", pgErr.ConstraintName)
			return commonerrors.Wrap(ErrUserCreationFailed, err)
		}
	}

	// Default to generic error
	fmt.Printf("ERROR: Unknown database error: %s (Code: %s)\n", pgErr.Message, pgErr.Code)
	return commonerrors.Wrap(ErrUserCreationFailed, err)
}
