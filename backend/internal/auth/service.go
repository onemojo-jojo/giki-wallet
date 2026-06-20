package auth

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"crypto/rand"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	auth "github.com/hash-walker/giki-wallet/internal/auth/auth_db"
	"github.com/hash-walker/giki-wallet/internal/common"
	commonerrors "github.com/hash-walker/giki-wallet/internal/common/errors"
	"github.com/hash-walker/giki-wallet/internal/user/user_db"
	"github.com/hash-walker/giki-wallet/internal/worker"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	userQ     *user_db.Queries
	authQ     *auth.Queries
	dbPool    *pgxpool.Pool
	jobs      *worker.JobWorker
	jwtSecret string
}

func NewService(dbPool *pgxpool.Pool, jwtSecret string, jobs *worker.JobWorker) *Service {
	return &Service{
		authQ:     auth.New(dbPool),
		userQ:     user_db.New(dbPool),
		dbPool:    dbPool,
		jobs:      jobs,
		jwtSecret: jwtSecret,
	}
}

func (s *Service) Login(ctx context.Context, req LoginParams) (*LoginResult, error) {

	var res *LoginResult
	var authenticationErr error

	err := common.WithTransaction(ctx, s.dbPool, func(tx pgx.Tx) error {

		res, authenticationErr = s.authenticateAndIssueTokens(ctx, tx, req.Email, req.Password)

		if authenticationErr != nil {
			return authenticationErr
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return res, nil

}

func (s *Service) GetUserByID(ctx context.Context, userID uuid.UUID) (user_db.GikiWalletUser, error) {
	u, err := s.userQ.GetUserAuthByID(ctx, userID)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return user_db.GikiWalletUser{}, ErrUserNotFound
		}
		return user_db.GikiWalletUser{}, commonerrors.Wrap(commonerrors.ErrDatabase, err)
	}

	return u, nil
}

func (s *Service) VerifyEmailAndIssueTokens(ctx context.Context, token string) (*LoginResult, error) {
	tokenHash := sha256Hex(token)

	var res *LoginResult

	err := common.WithTransaction(ctx, s.dbPool, func(tx pgx.Tx) error {
		authQ := s.authQ.WithTx(tx)

		u, err := authQ.GetUserByTokenHash(ctx, tokenHash)

		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrInvalidVerificationToken
			}
			return commonerrors.Wrap(commonerrors.ErrDatabase, err)
		}

		if u.Type != "EMAIL_VERIFICATION" {
			return ErrInvalidVerificationToken
		}

		if time.Now().UTC().After(u.ExpiresAt.UTC()) {
			return ErrVerificationTokenExpired
		}

		userQ := s.userQ.WithTx(tx)

		_, err = userQ.UpdateUserVerification(ctx, u.UserID)
		if err != nil {
			return commonerrors.Wrap(commonerrors.ErrDatabase, err)
		}

		user, err := userQ.GetUserAuthByID(ctx, u.UserID)
		if err != nil {
			return commonerrors.Wrap(commonerrors.ErrDatabase, err)
		}

		expireTime := time.Duration(3600) * time.Second
		tokenPair, err := s.issueTokenPair(ctx, tx, user, expireTime)

		if err != nil {
			return commonerrors.Wrap(ErrTokenCreation, err)
		}

		res = &LoginResult{
			User:   user,
			Tokens: tokenPair,
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return res, nil
}

func (s *Service) authenticateAndIssueTokens(ctx context.Context, tx pgx.Tx, email string, password string) (*LoginResult, error) {

	user, err := s.checkUserAndPassword(ctx, tx, email, password)

	if err != nil {
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return nil, commonerrors.Wrap(ErrUserNotFound, err)
		case errors.Is(err, ErrInvalidPassword):
			return nil, err
		default:
			return nil, commonerrors.Wrap(commonerrors.ErrDatabase, err)
		}
	}

	userType := strings.ToUpper(user.UserType)

	if !user.IsActive {

		if userType == RoleEmployee {
			return nil, commonerrors.Wrap(ErrUserPendingApproval, fmt.Errorf("user pending approval: active=%v, verified=%v", user.IsActive, user.IsVerified))
		}
		return nil, commonerrors.Wrap(ErrUserInactive, fmt.Errorf("user inactive: active=%v, verified=%v", user.IsActive, user.IsVerified))
	}

	if !user.IsVerified {
		return nil, commonerrors.Wrap(ErrUserNotVerified, fmt.Errorf("user not verified: active=%v, verified=%v", user.IsActive, user.IsVerified))
	}

	expireTime := time.Duration(3600) * time.Second

	tokenPair, err := s.issueTokenPair(ctx, tx, user, expireTime)

	if err != nil {
		return nil, commonerrors.Wrap(ErrTokenCreation, err)
	}

	res := LoginResult{
		User:   user,
		Tokens: tokenPair,
	}

	return &res, nil
}

func (s *Service) issueTokenPair(ctx context.Context, tx pgx.Tx, user user_db.GikiWalletUser, expiresIn time.Duration) (TokenPairs, error) {

	if s.jwtSecret == "" {
		return TokenPairs{}, commonerrors.Wrap(commonerrors.ErrInternal, fmt.Errorf("JWT secret not configured"))
	}

	claims := CustomClaims{
		UserType: user.UserType,
		Email:    user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "giki-wallet",
			IssuedAt:  jwt.NewNumericDate(time.Now().UTC()),
			ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(expiresIn)),
			Subject:   user.ID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	signedToken, err := token.SignedString([]byte(s.jwtSecret))

	if err != nil {
		return TokenPairs{}, commonerrors.Wrap(ErrTokenCreation, err)
	}

	refreshToken, err := MakeRefreshToken()
	refreshTokenHash := sha256Hex(refreshToken)

	expirationAt := time.Now().Add(60 * 24 * time.Hour)

	if err != nil {
		return TokenPairs{}, commonerrors.Wrap(commonerrors.ErrInternal, err)
	}

	authQ := s.authQ.WithTx(tx)

	_, err = authQ.CreateRefreshToken(ctx, auth.CreateRefreshTokenParams{
		TokenHash: refreshTokenHash,
		ExpiresAt: common.TimeToPgTime(expirationAt),
		UserID:    user.ID,
	})

	if err != nil {
		return TokenPairs{}, commonerrors.Wrap(commonerrors.ErrDatabase, err)
	}

	tokenPairs := TokenPairs{
		AccessToken:  signedToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresIn,
	}

	return tokenPairs, nil
}

func (s *Service) checkUserAndPassword(ctx context.Context, tx pgx.Tx, email string, password string) (user_db.GikiWalletUser, error) {

	userQ := s.userQ.WithTx(tx)

	user, err := userQ.GetUserAuthByEmail(ctx, email)

	if err != nil {
		return user_db.GikiWalletUser{}, err
	}

	passwordHash := user.PasswordHash
	passwordAlgo := strings.ToUpper(user.PasswordAlgo)

	var isValid bool
	var verificationErr error

	switch passwordAlgo {
	case "BCRYPT":
		err = bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password))
		if err == nil {
			isValid = true
		} else {
			verificationErr = ErrInvalidPassword
		}
	case "DJANGO_PBKDF2_SHA256":
		isValid, err = verifyDjangoPBKDF2(password, passwordHash)
		if err != nil {
			return user_db.GikiWalletUser{}, commonerrors.Wrap(commonerrors.ErrInternal, fmt.Errorf("failed to verify legacy password: %v", err))
		}
		if !isValid {
			verificationErr = ErrInvalidPassword
		}
	case "LOCKED":
		return user_db.GikiWalletUser{}, commonerrors.Wrap(ErrUserInactive, fmt.Errorf("account is locked"))
	default:
		return user_db.GikiWalletUser{}, commonerrors.Wrap(commonerrors.ErrInternal, fmt.Errorf("unsupported password algorithm: %s", passwordAlgo))
	}

	if verificationErr != nil {
		return user_db.GikiWalletUser{}, verificationErr
	}

	if passwordAlgo == "DJANGO_PBKDF2_SHA256" {
		newHash, err := HashPassword(password)
		if err == nil {
			_, updateErr := userQ.UpdateUserPasswordWithAlgo(ctx, user_db.UpdateUserPasswordWithAlgoParams{
				ID:           user.ID,
				PasswordHash: newHash,
				PasswordAlgo: "BCRYPT",
			})
			if updateErr != nil {
				fmt.Printf("Failed to upgrade legacy password for %s: %v\n", user.Email, updateErr)
			}
		}
	}

	return user, nil
}

func MakeRefreshToken() (string, error) {
	key := make([]byte, 32)
	_, err := rand.Read(key)

	if err != nil {
		return "", commonerrors.Wrap(commonerrors.ErrInternal, err)
	}
	refreshToken := hex.EncodeToString(key)

	return refreshToken, nil
}

func (s *Service) RefreshToken(ctx context.Context, refreshToken string) (*TokenPairs, error) {

	incomingHash := sha256Hex(refreshToken)
	var result *TokenPairs

	err := common.WithTransaction(ctx, s.dbPool, func(tx pgx.Tx) error {
		authQ := s.authQ.WithTx(tx)

		rt, err := authQ.GetRefreshTokenByHash(ctx, incomingHash)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrInvalidRefreshToken
			}
			return commonerrors.Wrap(commonerrors.ErrDatabase, err)
		}

		if rt.RevokedAt.Valid {
			_ = authQ.RevokeAllRefreshTokensForUser(ctx, rt.UserID)
			return ErrInvalidRefreshToken
		}

		if time.Now().After(rt.ExpiresAt.Time) {
			return ErrRefreshTokenExpired
		}

		user, err := s.userQ.WithTx(tx).GetUserAuthByID(ctx, rt.UserID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrUserNotFound
			}
			return commonerrors.Wrap(commonerrors.ErrDatabase, err)
		}

		expireTime := time.Duration(3600) * time.Second
		tokenPair, err := s.issueTokenPair(ctx, tx, user, expireTime)
		if err != nil {
			return err
		}

		err = authQ.ReplaceRefreshToken(ctx, auth.ReplaceRefreshTokenParams{
			TokenHash: incomingHash,
			ReplacedByToken: pgtype.Text{
				String: sha256Hex(tokenPair.RefreshToken),
				Valid:  true,
			},
		})
		if err != nil {
			return commonerrors.Wrap(commonerrors.ErrDatabase, err)
		}

		result = &tokenPair
		return nil
	})

	if err != nil {
		return nil, err
	}

	return result, nil
}

func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

func (s *Service) RequestPasswordReset(ctx context.Context, email string) error {
	// 1. Check if user exists and is active
	user, err := s.userQ.GetUserAuthByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Fail silently to prevent account enumeration
			return nil
		}
		return commonerrors.Wrap(commonerrors.ErrDatabase, err)
	}

	if !user.IsActive {
		return nil // Non-active users can't reset password
	}

	// 2. Generate secure token
	token, err := generateBase64Token(32)
	if err != nil {
		return commonerrors.Wrap(commonerrors.ErrInternal, err)
	}

	tokenHash := sha256Hex(token)
	expiresAt := time.Now().UTC().Add(1 * time.Hour)

	// 3. Save hashed token to DB
	_, err = s.authQ.CreateAccessToken(ctx, auth.CreateAccessTokenParams{
		TokenHash: tokenHash,
		UserID:    user.ID,
		Type:      "PASSWORD_RESET",
		ExpiresAt: expiresAt,
	})
	if err != nil {
		return commonerrors.Wrap(commonerrors.ErrDatabase, err)
	}

	// 4. Enqueue Email Job
	forgotBase := os.Getenv("FRONTEND_FORGOT_URL")
	if forgotBase == "" {
		forgotBase = "https://giktransport.giki.edu.pk/reset-password"
	}

	_ = s.jobs.Enqueue(ctx, "SEND_PASSWORD_RESET_EMAIL", worker.PasswordResetPayload{
		Email: user.Email,
		Name:  user.Name,
		Link:  fmt.Sprintf("%s?token=%s", forgotBase, token),
	})

	return nil
}

func (s *Service) ResetPassword(ctx context.Context, token, newPassword string) error {
	tokenHash := sha256Hex(token)

	err := common.WithTransaction(ctx, s.dbPool, func(tx pgx.Tx) error {
		authQ := s.authQ.WithTx(tx)
		userQ := s.userQ.WithTx(tx)

		// 1. Verify token
		t, err := authQ.GetUserByTokenHash(ctx, tokenHash)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrInvalidVerificationToken
			}
			return commonerrors.Wrap(commonerrors.ErrDatabase, err)
		}

		if t.Type != "PASSWORD_RESET" {
			return ErrInvalidVerificationToken
		}

		if time.Now().UTC().After(t.ExpiresAt.UTC()) {
			return ErrVerificationTokenExpired
		}

		// 2. Hash new password
		hashedPassword, err := HashPassword(newPassword)
		if err != nil {
			return commonerrors.Wrap(commonerrors.ErrInternal, err)
		}

		// 3. Update user
		_, err = userQ.UpdateUserPasswordWithAlgo(ctx, user_db.UpdateUserPasswordWithAlgoParams{
			ID:           t.UserID,
			PasswordHash: hashedPassword,
			PasswordAlgo: "BCRYPT",
		})
		if err != nil {
			return commonerrors.Wrap(commonerrors.ErrDatabase, err)
		}

		// 4. Delete token
		err = authQ.DeleteAccessToken(ctx, tokenHash)
		if err != nil {
			return commonerrors.Wrap(commonerrors.ErrDatabase, err)
		}

		return nil
	})

	return err
}

func generateBase64Token(n int) (string, error) {
	b := make([]byte, n)
	if _, err := io.ReadFull(rand.Reader, b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

func HashPassword(password string) (string, error) {
	hashPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashPassword), nil
}
