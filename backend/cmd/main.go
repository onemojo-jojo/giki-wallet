package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/hash-walker/giki-wallet/internal/api"
	"github.com/hash-walker/giki-wallet/internal/audit"
	"github.com/hash-walker/giki-wallet/internal/auth"
	"github.com/hash-walker/giki-wallet/internal/config"
	"github.com/hash-walker/giki-wallet/internal/config_management"
	"github.com/hash-walker/giki-wallet/internal/feedback"
	"github.com/hash-walker/giki-wallet/internal/mailer"
	"github.com/hash-walker/giki-wallet/internal/payment"
	"github.com/hash-walker/giki-wallet/internal/payment/gateway"
	"github.com/hash-walker/giki-wallet/internal/transport"
	"github.com/hash-walker/giki-wallet/internal/user"
	"github.com/hash-walker/giki-wallet/internal/wallet"
	"github.com/hash-walker/giki-wallet/internal/worker"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
)

func main() {
	ctx := context.Background()

	_ = godotenv.Load()

	cfg := config.LoadConfig()

	jazzCashClient := gateway.NewJazzCashClient(
		cfg.Jazzcash.MerchantID,
		cfg.Jazzcash.Password,
		cfg.Jazzcash.IntegritySalt,
		cfg.Jazzcash.MerchantMPIN,
		cfg.Jazzcash.CardCallbackURL,
		cfg.Jazzcash.BaseURL,
		cfg.Jazzcash.WalletPaymentURl,
		cfg.Jazzcash.CardPaymentURL,
		cfg.Jazzcash.StatusInquiryURL,
	)

	newMailer := mailer.NewGraphSender(
		cfg.Mailer.ClientID,
		cfg.Mailer.TenantID,
		cfg.Mailer.ClientSecret,
		cfg.Mailer.SenderEmail,
	)

	dbConfig, err := pgxpool.ParseConfig(cfg.Database.DbURL)
	if err != nil {
		log.Fatalf("Unable to parse database connection string: %v", err)
	}

	dbConfig.MaxConns = 300
	dbConfig.MinConns = 10
	dbConfig.MaxConnLifetime = 1 * time.Hour
	dbConfig.MaxConnIdleTime = 30 * time.Minute
	dbConfig.HealthCheckPeriod = 1 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, dbConfig)

	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}
	defer pool.Close()

	inquiryRateLimiter := payment.NewRateLimiter(50)

	// Initialize Worker first
	newWorker := worker.NewWorker(pool, newMailer)
	go newWorker.StartJobTicker(ctx, 10)
	go newWorker.StartStatusTicker(ctx)

	// Initialize Services with dependencies
	auditService := audit.NewService(pool)

	// Config Service (Initialize early for dependencies)
	configService := config_management.NewService(pool)
	if err := configService.Initialize(ctx); err != nil {
		log.Printf("Warning: Failed to initialize system configs: %v", err)
	}
	configHandler := config_management.NewHandler(configService)

	// Load App Timezone
	loc, err := time.LoadLocation(cfg.Server.AppTimezone)
	if err != nil {
		log.Fatalf("Critical: Failed to load application timezone %s: %v", cfg.Server.AppTimezone, err)
	}

	userService := user.NewService(pool, newWorker)
	userHandler := user.NewHandler(userService, auditService)
	authService := auth.NewService(pool, cfg.Secrets.JWTSecret, newWorker)
	authHandler := auth.NewHandler(authService, auditService, cfg.Server.RefreshTokenCookiePath)
	auditHandler := audit.NewHandler(auditService)
	walletService := wallet.NewService(pool, cfg.Secrets.LedgerSecret)
	walletHandler := wallet.NewHandler(walletService)
	paymentService := payment.NewService(pool, jazzCashClient, walletService, inquiryRateLimiter, configService, cfg.Server.AppURL, newWorker)
	paymentHandler := payment.NewHandler(paymentService, walletService)
	transportService := transport.NewService(pool, walletService, newWorker, loc)
	transportHandler := transport.NewHandler(transportService, auditService)

	// Wire reconciliation callbacks (after both services are constructed)
	newWorker.SetReconciler(paymentService.ReconcileTransaction)
	newWorker.SetStaleFetcher(paymentService.StalePendingRefNos)

	feedbackService := feedback.NewService(pool)
	feedbackHandler := feedback.NewHandler(feedbackService)

	srv := api.NewServer(userHandler, authHandler, paymentHandler, transportHandler, walletHandler, newWorker, auditService, auditHandler, configHandler, feedbackHandler)
	srv.MountRoutes()

	allowedOrigins := []string{strings.TrimRight(cfg.Server.AppURL, "/")}
	if os.Getenv("ENV") != "production" {
		allowedOrigins = append(allowedOrigins, "http://localhost:3000", "http://localhost:5173")
	}

	c := cors.New(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Content-Type", "Authorization", "X-Requested-With"},
		AllowCredentials: true,
		Debug:            os.Getenv("ENV") != "production",
	})

	handler := c.Handler(srv.Router)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // Default port
	}

	server := &http.Server{
		Addr:    ":" + port,
		Handler: handler,
	}
	// start the worker
	transport.StartCleanupWorker(pool, 30*time.Second)

	log.Printf("Server starting on port %s\n", port)
	log.Fatal(server.ListenAndServe())

}
