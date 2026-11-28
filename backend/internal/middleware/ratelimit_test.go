package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/hash-walker/giki-wallet/internal/common"
	"github.com/stretchr/testify/require"
)

func TestRateLimit_WithinLimit_CallsNextHandler(t *testing.T) {
	var nextCalled bool
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusTeapot)
		_, _ = w.Write([]byte("ok"))
	})

	handler := RequestID(RateLimit(1, 1)(next))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.RemoteAddr = "203.0.113.10:1234"
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	require.True(t, nextCalled, "next handler should be called when within limit")
	require.Equal(t, http.StatusTeapot, rr.Code)
	require.Equal(t, "ok", rr.Body.String())
}

func TestRateLimit_OverLimit_Returns429AndSkipsNextHandler(t *testing.T) {
	var nextCalls int
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		nextCalls++
		w.WriteHeader(http.StatusOK)
	})

	handler := RequestID(RateLimit(1, 1)(next))

	makeRequest := func() *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.RemoteAddr = "203.0.113.10:1234"
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		return rr
	}

	first := makeRequest()
	require.Equal(t, http.StatusOK, first.Code, "first request should pass")
	require.Equal(t, 1, nextCalls)

	second := makeRequest()
	require.Equal(t, http.StatusTooManyRequests, second.Code)
	require.Equal(t, 1, nextCalls, "next handler must not run when rate limited")

	var body common.APIResponse
	require.NoError(t, json.Unmarshal(second.Body.Bytes(), &body))
	require.False(t, body.Success)

	errMap, ok := body.Error.(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, "RATE_LIMIT_EXCEEDED", errMap["code"])
}

func TestRateLimit_OverLimit_WithRequestIDInContext(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := RateLimit(1, 1)(next)

	sameIP := "203.0.113.20:5678"
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.RemoteAddr = sameIP
		req = req.WithContext(context.WithValue(req.Context(), requestIDKey, "test-req-id"))
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		if i == 1 {
			require.Equal(t, http.StatusTooManyRequests, rr.Code)

			var body common.APIResponse
			require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
			require.Equal(t, "test-req-id", body.Meta.RequestID)
		}
	}
}