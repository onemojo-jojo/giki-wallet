package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/hash-walker/giki-wallet/internal/audit"
	"github.com/hash-walker/giki-wallet/internal/auth"
	"github.com/hash-walker/giki-wallet/internal/common"
	"github.com/hash-walker/giki-wallet/internal/config_management"
	"github.com/hash-walker/giki-wallet/internal/middleware"
	"github.com/hash-walker/giki-wallet/internal/feedback"
	"github.com/hash-walker/giki-wallet/internal/payment"
	"github.com/hash-walker/giki-wallet/internal/transport"
	"github.com/hash-walker/giki-wallet/internal/user"
	"github.com/hash-walker/giki-wallet/internal/wallet"
	"github.com/hash-walker/giki-wallet/internal/worker"
)

type Server struct {
	Router       *chi.Mux
	User         *user.Handler
	Auth         *auth.Handler
	Payment      *payment.Handler
	Transport    *transport.Handler
	Wallet       *wallet.Handler
	Worker       *worker.JobWorker
	Audit        *audit.Service
	AuditHandler *audit.Handler
	Config       *config_management.Handler
	Feedback     *feedback.Handler
}

func NewServer(
	userHandler *user.Handler,
	authHandler *auth.Handler,
	paymentHandler *payment.Handler,
	transportHandler *transport.Handler,
	walletHandler *wallet.Handler,
	jobWorker *worker.JobWorker,
	auditService *audit.Service,
	auditHandler *audit.Handler,
	configHandler *config_management.Handler,
	feedbackHandler *feedback.Handler,
) *Server {
	return &Server{
		Router:       chi.NewRouter(),
		User:         userHandler,
		Auth:         authHandler,
		Payment:      paymentHandler,
		Transport:    transportHandler,
		Wallet:       walletHandler,
		Worker:       jobWorker,
		Audit:        auditService,
		AuditHandler: auditHandler,
		Config:       configHandler,
		Feedback:     feedbackHandler,
	}
}

func (s *Server) MountRoutes() {

	r := s.Router

	// Global middleware stack (order matters!)
	r.Use(middleware.RequestID)         // 1. Generate request ID
	r.Use(middleware.Logger)            // 2. Log requests/responses
	r.Use(middleware.ErrorHandler)      // 3. Recover from panics
	// NOTE: All GIKI campus users share one NAT IP. Limits cover ALL users at once.
	// 800 users x ~4 concurrent requests = ~3200 burst at peak.
	r.Use(middleware.RateLimit(1000, 5000)) // 4. Global Rate Limit (1000 req/s, 5000 burst)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, err := w.Write([]byte("OK"))
		if err != nil {
			return
		}
	})

	r.Post("/auth/register", s.User.HandlerRegister)

	// Login rate limit: raised for campus NAT (all users share one IP).
	r.With(middleware.RateLimit(50, 200)).Post("/auth/signin", s.Auth.Login)

	r.Post("/auth/refresh", s.Auth.RefreshToken)
	r.Post("/auth/signout", s.Auth.Logout)
	r.Get("/auth/verify", s.Auth.VerifyEmail)
	r.With(middleware.RateLimit(10, 50)).Post("/auth/forgot-password", s.Auth.ForgotPassword)
	r.With(middleware.RateLimit(10, 50)).Post("/auth/reset-password", s.Auth.ResetPassword)
	r.With(s.Auth.Authenticate).Get("/auth/me", s.Auth.Me)
	r.With(s.Auth.Authenticate).Get("/auth/me", s.Auth.Me)

	r.With(s.Auth.Authenticate).Post("/feedback", s.Feedback.CreateFeedback)

	r.Route("/payment", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(s.Auth.Authenticate)
			r.Post("/topup", s.Payment.TopUp)
			r.Get("/status/{txnRefNo}", s.Payment.CheckStatus)
			r.Get("/limit", s.Config.GetMaxTopUpLimit)
		})
		// Make this public so window.location.assign can access it without headers
		r.Get("/page/{txnRefNo}", s.Payment.CardPaymentPage)
	})

	r.Post("/booking/payment/response", s.Payment.CardCallBack)
	r.Post("/booking/payment/response/", s.Payment.CardCallBack)

	r.Route("/transport", func(r chi.Router) {

		r.Get("/weekly-summary", s.Transport.HandleWeeklyTrips)
		r.Get("/routes", s.Transport.ListRoutes)

		r.Group(func(r chi.Router) {
			r.Use(s.Auth.Authenticate)
			r.Get("/quota", s.Transport.GetQuota)
			r.Post("/holds", s.Transport.HoldSeats)
			r.Get("/holds/active", s.Transport.GetActiveHolds)
			r.Delete("/holds/active", s.Transport.ReleaseAllActiveHolds)
			r.Get("/tickets", s.Transport.GetUserTickets)
			r.Delete("/tickets/{ticket_id}", s.Transport.CancelTicket)
			r.Post("/confirm", s.Transport.ConfirmBatch)
		})
	})

	r.Route("/wallet", func(r chi.Router) {
		r.Use(s.Auth.Authenticate)
		r.Get("/balance", s.Wallet.GetBalance)
		r.Get("/history", s.Wallet.GetHistory)
	})

	r.Route("/admin", func(r chi.Router) {
		r.Use(s.Auth.RequireLogin("/admin/signin"))
		r.Use(auth.RequireRole(auth.RoleSuperAdmin, auth.RoleTransportAdmin, auth.RoleFinanceAdmin))

		r.Get("/dashboard", func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte("Admin Dashboard"))
		})

		r.Get("/routes", s.Transport.ListRoutes)
		r.Get("/routes/{route_id}/template", s.Transport.GetRouteTemplate)

		r.Get("/trips", s.Transport.HandleWeeklyTrips)
		r.Post("/trips", s.Transport.CreateTrip)
		r.Put("/trips/{trip_id}", s.Transport.UpdateTrip)
		r.Delete("/trips/{trip_id}", s.Transport.DeleteTrip)
		r.Patch("/trips/{id}/status", s.Transport.UpdateTripManualStatus)
		r.Patch("/trips/batch-status", s.Transport.BatchUpdateTripManualStatus)
		r.Post("/trips/{id}/cancel", s.Transport.CancelTrip)

		// Transport Revenue
		r.Get("/transport/transactions", s.Transport.AdminGetRevenueTransactions)
		r.Get("/transport/trips/export", s.Transport.HandleExportTrips)

		// Tickets Management
		r.Get("/tickets", s.Transport.HandleAdminTickets)

		r.Route("/users", func(r chi.Router) {
			r.Get("/", s.User.HandlerListUsers)
			r.Post("/", s.User.HandlerAdminCreateUser)    // Create User (Admin Flow)
			r.Put("/{user_id}", s.User.HandlerUpdateUser) // Update User
			r.Delete("/{user_id}", s.User.HandlerDeleteUser)
			r.Patch("/{user_id}/status", s.User.HandlerUpdateUserStatus)
			r.Post("/{user_id}/approve", s.User.HandlerApproveEmployee)
			r.Post("/{user_id}/reject", s.User.HandlerRejectEmployee)
		})

		r.Route("/transactions/gateway", func(r chi.Router) {
			r.Get("/", s.Payment.ListGatewayTransactions)
			r.Get("/export", s.Payment.HandleExportGatewayTransactions)
			r.Get("/{txnRefNo}/logs", s.Payment.GetTransactionAuditLogs)
			r.Post("/{txnRefNo}/verify", s.Payment.VerifyGatewayTransaction)
		})

		r.Route("/finance", func(r chi.Router) {
			r.Get("/liability", s.Payment.GetLiabilityBalance)
			r.Get("/revenue", s.Payment.GetRevenueBalance)
			r.Get("/revenue/period", s.Payment.GetRevenuePeriodVolume)
		})
		r.Get("/finance/transactions", s.Wallet.GetAdminTransactions)
		r.Get("/audit-logs", s.AuditHandler.HandlerListSecurityEvents)

		// Worker Status
		r.Get("/worker/status", func(w http.ResponseWriter, r *http.Request) {
			requestID := middleware.GetRequestID(r.Context())
			status, err := s.Worker.GetStatus(r.Context())
			if err != nil {
				middleware.HandleError(w, err, requestID)
				return
			}
			common.ResponseWithJSON(w, http.StatusOK, status, requestID)
		})

		// System Configuration
		r.Route("/settings", func(r chi.Router) {
			r.Use(auth.RequireRole(auth.RoleSuperAdmin, auth.RoleTransportAdmin, auth.RoleFinanceAdmin))
			r.Get("/", s.Config.ListConfigs)
			r.Put("/{key}", s.Config.UpdateConfig)
		})
	})
}
