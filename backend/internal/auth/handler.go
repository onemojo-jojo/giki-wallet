package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/hash-walker/giki-wallet/internal/audit"
	"github.com/hash-walker/giki-wallet/internal/common"
	commonerrors "github.com/hash-walker/giki-wallet/internal/common/errors"
	"github.com/hash-walker/giki-wallet/internal/middleware"
)

type Handler struct {
	service                *Service
	audit                  *audit.Service
	refreshTokenCookiePath string
}

const (
	refreshTokenCookieName = "refresh_token"
	refreshTokenMaxAge     = 60 * 24 * 60 * 60
)

func NewHandler(service *Service, audit *audit.Service, refreshTokenCookiePath string) *Handler {
	return &Handler{
		service:                service,
		audit:                  audit,
		refreshTokenCookiePath: refreshTokenCookiePath,
	}
}

func (h *Handler) setRefreshTokenCookie(w http.ResponseWriter, token string, maxAge int) {
	path := h.refreshTokenCookiePath
	if path == "" {
		path = "/auth/refresh"
	}

	http.SetCookie(w, &http.Cookie{
		Name:     refreshTokenCookieName,
		Value:    token,
		Path:     path,
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
	})
}

func (h *Handler) clearRefreshTokenCookie(w http.ResponseWriter) {
	h.setRefreshTokenCookie(w, "", -1)
}

// Authenticate is a middleware that validates the JWT token
func (h *Handler) Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := middleware.GetRequestID(r.Context())

		userID, userRole, err := h.validateRequest(r)
		if err != nil {
			middleware.HandleError(w, err, requestID)
			return
		}

		ctx := context.WithValue(r.Context(), userIDKey, userID)
		ctx = context.WithValue(ctx, userRoleKey, userRole)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireLogin redirects to a specified path if authentication fails
func (h *Handler) RequireLogin(redirectOnFail string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, userRole, err := h.validateRequest(r)
			if err != nil {
				http.Redirect(w, r, redirectOnFail, http.StatusFound)
				return
			}

			ctx := context.WithValue(r.Context(), userIDKey, userID)
			ctx = context.WithValue(ctx, userRoleKey, userRole)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func (h *Handler) validateRequest(r *http.Request) (uuid.UUID, string, error) {
	tokenString, err := getTokenFromRequest(r)
	if err != nil {
		return uuid.Nil, "", err
	}

	claims, err := ValidateJWT(tokenString, h.service.jwtSecret)
	if err != nil {
		return uuid.Nil, "", err
	}

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return uuid.Nil, "", commonerrors.Wrap(ErrInvalidToken, err)
	}

	return userID, claims.UserType, nil
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())

	var params LoginParams

	if r.Body == nil {
		middleware.HandleError(w, commonerrors.ErrMissingRequestBody, requestID)
		return
	}

	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidJSON, err), requestID)
		return
	}

	if params.Email == "" || params.Password == "" {
		middleware.HandleError(w, commonerrors.ErrMissingField.WithDetails("fields", "email, password"), requestID)
		return
	}

	// Capture IP and User Agent
	ip := common.GetClientIP(r)
	userAgent := r.UserAgent()

	// 1. Log Attempt
	_ = h.audit.LogSecurityEvent(r.Context(), audit.Event{
		Action:    audit.ActionLoginAttempt,
		Details:   map[string]interface{}{"email": params.Email},
		IPAddress: ip,
		UserAgent: userAgent,
		Status:    audit.StatusSuccess,
	})

	res, err := h.service.Login(r.Context(), params)

	if err != nil {
		// 2. Log Failure
		_ = h.audit.LogSecurityEvent(r.Context(), audit.Event{
			Action:    audit.ActionLoginFailure,
			Details:   map[string]interface{}{"email": params.Email, "error": err.Error()},
			IPAddress: ip,
			UserAgent: userAgent,
			Status:    audit.StatusFailure,
		})
		middleware.HandleError(w, err, requestID)
		return
	}

	// 3. Log Success
	_ = h.audit.LogSecurityEvent(r.Context(), audit.Event{
		ActorID:   &res.User.ID,
		Action:    audit.ActionLoginSuccess,
		TargetID:  &res.User.ID,
		IPAddress: ip,
		UserAgent: userAgent,
		Status:    audit.StatusSuccess,
	})

	h.setRefreshTokenCookie(w, res.Tokens.RefreshToken, refreshTokenMaxAge)

	response := ToLoginResponse(*res)
	common.ResponseWithJSON(w, http.StatusOK, response, requestID)
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())
	userID, _ := GetUserIDFromContext(r.Context())
	ip := common.GetClientIP(r)

	if userID != uuid.Nil {
		_ = h.audit.LogSecurityEvent(r.Context(), audit.Event{
			ActorID:   &userID,
			Action:    audit.ActionLogout,
			IPAddress: ip,
			UserAgent: r.UserAgent(),
			Status:    audit.StatusSuccess,
		})
	}

	h.clearRefreshTokenCookie(w)
	w.WriteHeader(http.StatusNoContent)
	_ = requestID
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())

	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		middleware.HandleError(w, commonerrors.ErrUnauthorized, requestID)
		return
	}

	u, err := h.service.GetUserByID(r.Context(), userID)

	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	common.ResponseWithJSON(w, http.StatusOK, ToLoginResponse(LoginResult{User: u}), requestID)
}

func (h *Handler) VerifyEmail(w http.ResponseWriter, r *http.Request) {

	requestID := middleware.GetRequestID(r.Context())

	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token == "" {
		middleware.HandleError(w, commonerrors.ErrMissingField.WithDetails("fields", "token"), requestID)
		return
	}

	res, err := h.service.VerifyEmailAndIssueTokens(r.Context(), token)

	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	h.setRefreshTokenCookie(w, res.Tokens.RefreshToken, refreshTokenMaxAge)

	common.ResponseWithJSON(w, http.StatusOK, ToLoginResponse(*res), requestID)
}

func (h *Handler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())

	cookie, err := r.Cookie(refreshTokenCookieName)
	if err != nil || cookie.Value == "" {
		middleware.HandleError(w, ErrInvalidRefreshToken, requestID)
		return
	}

	tokenPair, err := h.service.RefreshToken(r.Context(), cookie.Value)
	if err != nil {
		h.clearRefreshTokenCookie(w)
		middleware.HandleError(w, err, requestID)
		return
	}

	h.setRefreshTokenCookie(w, tokenPair.RefreshToken, refreshTokenMaxAge)

	common.ResponseWithJSON(w, http.StatusOK, ToLoginResponse(LoginResult{
		Tokens: *tokenPair,
	}), requestID)
}

func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())
	var req struct {
		Email string `json:"email"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidJSON, err), requestID)
		return
	}

	if err := h.service.RequestPasswordReset(r.Context(), req.Email); err != nil {
		// We still log this event for security monitoring
		middleware.HandleError(w, err, requestID)
		return
	}

	common.ResponseWithJSON(w, http.StatusOK, map[string]string{"message": "If an account exists with that email, a password reset link has been sent."}, requestID)
}

func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())
	var req struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidJSON, err), requestID)
		return
	}

	if err := h.service.ResetPassword(r.Context(), req.Token, req.Password); err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	common.ResponseWithJSON(w, http.StatusOK, map[string]string{"message": "Password has been reset successfully."}, requestID)
}

func setRefreshTokenCookie(w http.ResponseWriter, token string, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    token,
		Path:     "/auth/refresh",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
	})
}

func clearRefreshTokenCookie(w http.ResponseWriter) {
	setRefreshTokenCookie(w, "", -1) // MaxAge -1 = delete
}
