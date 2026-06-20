package auth

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/hash-walker/giki-wallet/internal/user/user_db"
)

type LoginParams struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type CustomClaims struct {
	UserType string `json:"user_type"`
	Email    string `json:"email"`
	jwt.RegisteredClaims
}

type TokenPairs struct {
	AccessToken  string        `json:"access_token"`
	RefreshToken string        `json:"refresh_token"`
	ExpiresAt    time.Duration `json:"expires_at"`
}

type LoginResult struct {
	User   user_db.GikiWalletUser
	Tokens TokenPairs
}

type AuthTokens struct {
	AccessToken string        `json:"access_token"`
	ExpiresAt   time.Duration `json:"expires_at"`
}

type LoginResponse struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Email       string      `json:"email"`
	PhoneNumber string      `json:"phone_number"`
	UserType    string      `json:"user_type"`
	CreatedAt   time.Time   `json:"created_at,omitempty"`
	Auth        *AuthTokens `json:"auth,omitempty"`
}

// ToLoginResponse converts LoginResult to LoginResponse for API response
func ToLoginResponse(result LoginResult) LoginResponse {
	return LoginResponse{
		ID:          result.User.ID.String(),
		Name:        result.User.Name,
		Email:       result.User.Email,
		PhoneNumber: result.User.PhoneNumber,
		UserType:    result.User.UserType,
		CreatedAt:   result.User.CreatedAt,
		Auth: func() *AuthTokens {
			// For endpoints like /auth/me we may not be issuing tokens.
			if result.Tokens.AccessToken == "" && result.Tokens.RefreshToken == "" && result.Tokens.ExpiresAt == 0 {
				return nil
			}
			return &AuthTokens{
				AccessToken: result.Tokens.AccessToken,
				ExpiresAt:   result.Tokens.ExpiresAt,
			}
		}(),
	}
}
