package middleware

import (
	"net/http"

	"github.com/didip/tollbooth/v7"
	"github.com/didip/tollbooth/v7/limiter"
	"github.com/hash-walker/giki-wallet/internal/common/errors"
)

func RateLimit(limit float64, burst int) func(http.Handler) http.Handler {
	lmt := tollbooth.NewLimiter(limit, &limiter.ExpirableOptions{
		DefaultExpirationTTL: 0,
	})

	lmt.SetIPLookups([]string{"X-Forwarded-For", "X-Real-IP", "RemoteAddr"})

	lmt.SetBurst(burst)
	lmt.SetOverrideDefaultResponseWriter(true)

	lmt.SetOnLimitReached(func(w http.ResponseWriter, r *http.Request) {
		requestID := GetRequestID(r.Context())
		HandleError(w, errors.ErrRateLimitExceeded, requestID)
	})

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			httpError := tollbooth.LimitByRequest(lmt, w, r)
			if httpError != nil {
				lmt.ExecOnLimitReached(w, r)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
