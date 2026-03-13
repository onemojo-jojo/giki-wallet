package payment

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/url"
	"strings"
	"time"


	"github.com/google/uuid"
	"github.com/hash-walker/giki-wallet/internal/auth"
	"github.com/hash-walker/giki-wallet/internal/common"
	commonerrors "github.com/hash-walker/giki-wallet/internal/common/errors"
	"github.com/hash-walker/giki-wallet/internal/config"
	"github.com/hash-walker/giki-wallet/internal/config_management"
	"github.com/hash-walker/giki-wallet/internal/payment/gateway"
	payment "github.com/hash-walker/giki-wallet/internal/payment/payment_db"
	"github.com/hash-walker/giki-wallet/internal/wallet"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/hash-walker/giki-wallet/internal/middleware"
)

// =============================================================================
// TYPES
// =============================================================================

// Service handles payment business logic
type Service struct {
	q             *payment.Queries
	walletS       *wallet.Service
	dbPool        *pgxpool.Pool
	gatewayClient gateway.Gateway
	rateLimiter   *RateLimiter
	configS       *config_management.Service
	AppURL        string
	workerS       workerEnqueuer
}

// workerEnqueuer is the minimal interface the payment service needs from the worker.
type workerEnqueuer interface {
	EnqueueIn(ctx context.Context, jobType string, payload interface{}, delay time.Duration) error
}

// RateLimiter limits concurrent API calls to external services
type RateLimiter struct {
	tokens chan struct{}
}

// =============================================================================
// CONSTRUCTORS
// =============================================================================

// NewService creates a new payment service
func NewService(dbPool *pgxpool.Pool, gatewayClient gateway.Gateway, walletS *wallet.Service, rateLimiter *RateLimiter, configS *config_management.Service, appURL string, workerS workerEnqueuer) *Service {
	return &Service{
		q:             payment.New(dbPool),
		dbPool:        dbPool,
		walletS:       walletS,
		gatewayClient: gatewayClient,
		rateLimiter:   rateLimiter,
		configS:       configS,
		AppURL:        appURL,
		workerS:       workerS,
	}
}

// NewRateLimiter creates a new rate limiter with maxConcurrent tokens
func NewRateLimiter(maxConcurrent int) *RateLimiter {
	rl := &RateLimiter{
		tokens: make(chan struct{}, maxConcurrent),
	}
	for i := 0; i < maxConcurrent; i++ {
		rl.tokens <- struct{}{}
	}
	return rl
}

// =============================================================================
// RATE LIMITER METHODS
// =============================================================================

// Acquire blocks until a token is available or context is cancelled
func (rl *RateLimiter) Acquire(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-rl.tokens:
		return nil
	}
}

// Release returns a token to the pool
func (rl *RateLimiter) Release() {
	select {
	case rl.tokens <- struct{}{}:
	default:
		// Channel full - shouldn't happen if Acquire/Release are balanced
	}
}

// =============================================================================
// PUBLIC SERVICE METHODS
// =============================================================================

func (s *Service) InitiatePayment(ctx context.Context, payload TopUpRequest) (*TopUpResult, error) {
	idempotencyKey := payload.IdempotencyKey

	userID, ok := auth.GetUserIDFromContext(ctx)
	if !ok {
		return nil, ErrUserIDNotFound
	}

	existingPayment, err := s.q.GetByIdempotencyKey(ctx, idempotencyKey)
	if err == nil {
		return s.handleExistingTransaction(ctx, existingPayment)
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, commonerrors.Wrap(ErrDatabaseQuery, err)
	}

	transaction, err := s.q.GetPendingTransaction(ctx, userID)
	if err == nil {
		response, err := s.checkTransactionStatus(ctx, transaction)

		if err != nil {
			if response.Status != PaymentStatusFailed {
				return response, nil
			}
		}
	} else if !errors.Is(err, pgx.ErrNoRows) {}

	amountPaisa := common.AmountToLowestUnit(payload.Amount)

	if amountPaisa <= 0 {
		return nil, commonerrors.Wrap(commonerrors.ErrInvalidInput, fmt.Errorf("amount must be greater than 0"))
	}

	maxLimit, err := s.configS.GetMaxTopUpAmount(ctx)
	if err == nil {
		balanceResp, balanceErr := s.walletS.GetUserBalance(ctx, userID)
		if balanceErr == nil {
			currentBalancePaisa := common.AmountToLowestUnit(balanceResp.Balance)
			if int64(amountPaisa)+int64(currentBalancePaisa) > maxLimit {
				limitRs := maxLimit / 100
				return nil, commonerrors.Wrap(commonerrors.ErrInvalidInput, fmt.Errorf("top-up would exceed maximum allowed wallet balance of Rs. %d", limitRs))
			}
		}
	}

	billRefNo, err := GenerateBillRefNo()
	if err != nil {
		return nil, commonerrors.Wrap(ErrInternal, err)
	}

	txnRefNo, err := GenerateTxnRefNo()
	if err != nil {
		return nil, commonerrors.Wrap(ErrInternal, err)
	}

	gatewayTxn, err := s.q.CreateGatewayTransaction(ctx, payment.CreateGatewayTransactionParams{
		UserID:         userID,
		IdempotencyKey: payload.IdempotencyKey,
		BillRefID:      billRefNo,
		TxnRefNo:       txnRefNo,
		PaymentMethod:  string(payload.Method),
		Status:         payment.CurrentStatus(PaymentStatusPending),
		Amount:         int64(amountPaisa),
	})

	if err != nil {

		check := CheckUniqueConstraintViolation(err)

		if check {
			existing, fetchErr := s.q.GetByIdempotencyKey(ctx, idempotencyKey)
			if fetchErr != nil {
				return nil, commonerrors.Wrap(ErrDatabaseQuery, fetchErr)
			}
			return s.handleExistingTransaction(ctx, existing)
		}

		return nil, commonerrors.Wrap(ErrTransactionCreation, err)

	}

	// ═══════════════════════════════════════════════════════════════════════════
	// route to payment method handler
	// ═══════════════════════════════════════════════════════════════════════════

	switch payload.Method {
	case PaymentMethodMWallet:
		return s.initiateMWalletPayment(ctx, gatewayTxn, payload, billRefNo, txnRefNo)
	case PaymentMethodCard:
		return &TopUpResult{
			ID:             gatewayTxn.ID,
			TxnRefNo:       txnRefNo,
			Status:         PaymentStatus(gatewayTxn.Status),
			PaymentMethod:  PaymentMethodCard,
			PaymentPageURL: fmt.Sprintf("/api/payment/page/%s", txnRefNo),
		}, nil
	default:
		return nil, commonerrors.Wrap(ErrInvalidPaymentMethod, fmt.Errorf("method: %s", payload.Method))
	}
}

// =============================================================================
// AUDIT LOG METHODS
// =============================================================================

// LogCardCallbackAudit logs the raw callback data before processing
func (s *Service) LogCardCallbackAudit(ctx context.Context, formData url.Values) (uuid.UUID, error) {

	rawPayload, err := json.Marshal(formData)
	if err != nil {
		return uuid.Nil, commonerrors.Wrap(commonerrors.ErrInvalidJSON, err)
	}

	gatewayRef := formData.Get("pp_BillReference")
	txnRefNo := formData.Get("pp_TxnRefNo")

	auditLog, err := s.q.CreateAuditLog(ctx, payment.CreateAuditLogParams{
		EventType:  payment.GikiWalletAuditEventTypeCARDCALLBACK,
		RawPayload: rawPayload,
		TxnRefNo:   pgtype.Text{String: txnRefNo, Valid: txnRefNo != ""},
		GatewayRef: pgtype.Text{String: gatewayRef, Valid: gatewayRef != ""},
		UserID:     pgtype.UUID{},
	})

	if err != nil {
		return uuid.Nil, commonerrors.Wrap(commonerrors.ErrDatabase, fmt.Errorf("failed to create audit log: %w", err))
	}

	return auditLog.ID, nil
}

func (s *Service) MarkAuditFailed(ctx context.Context, auditID uuid.UUID, errorMsg string) {

	err := s.q.MarkAuditFailed(ctx, payment.MarkAuditFailedParams{
		ID:           auditID,
		ProcessError: pgtype.Text{String: errorMsg, Valid: true},
	})
	if err != nil {
		middleware.LogAppError(commonerrors.Wrap(commonerrors.ErrDatabase, fmt.Errorf("failed to mark audit as failed: %w", err)), "audit-background")
	}

}

func (s *Service) MarkAuditProcessed(ctx context.Context, auditID uuid.UUID) {
	err := s.q.MarkAuditProcessed(ctx, auditID)
	if err != nil {
		middleware.LogAppError(commonerrors.Wrap(commonerrors.ErrDatabase, fmt.Errorf("failed to mark audit as processed: %w", err)), "audit-background")
	}
}

func (s *Service) CompleteCardPayment(ctx context.Context, tx pgx.Tx, rForm url.Values, auditID uuid.UUID) (*TopUpResult, error) {

	callbackData := make(map[string]string)
	for k := range rForm {
		callbackData[k] = rForm.Get(k)
	}

	callback, err := s.gatewayClient.ParseAndVerifyCardCallback(ctx, callbackData)
	if err != nil {
		return nil, commonerrors.Wrap(ErrGatewayUnavailable, err)
	}

	paymentQ := s.q.WithTx(tx)

	gatewayTxn, err := paymentQ.GetTransactionByTxnRefNo(ctx, callback.TxnRefNo)

	if err != nil {
		return nil, commonerrors.Wrap(ErrDatabaseQuery, err)
	}

	paymentStatus := GatewayStatusToPaymentStatus(callback.Status)

	err = paymentQ.UpdateGatewayTransactionStatus(ctx, payment.UpdateGatewayTransactionStatusParams{
		Status:            payment.CurrentStatus(paymentStatus),
		TxnRefNo:          callback.TxnRefNo,
		GatewayMessage:    pgtype.Text{String: callback.Message, Valid: true},
		GatewayStatusCode: pgtype.Text{String: callback.ResponseCode, Valid: true},
	})


	if err != nil {
		return nil, commonerrors.Wrap(ErrTransactionUpdate, err)
	}

	switch paymentStatus {
	case PaymentStatusFailed:
		s.MarkAuditFailed(ctx, auditID, fmt.Sprintf("Gateway logic: %s (%s)", callback.Message, callback.ResponseCode))
	case PaymentStatusSuccess:
		err = s.creditWalletFromPayment(ctx, tx, gatewayTxn.UserID, gatewayTxn.Amount, gatewayTxn.TxnRefNo)
		if err != nil {
			if errors.Is(err, ErrIdempotentSuccess) {
				return MapCardCallbackToTopUpResult(gatewayTxn, callback), nil
			}
			return nil, err
		}

		s.MarkAuditProcessed(ctx, auditID)
	}
	if err != nil {
		// Don't fail the whole operation for this
	}

	return MapCardCallbackToTopUpResult(gatewayTxn, callback), nil
}

// =============================================================================
// PRIVATE SERVICE METHODS - Payment Initiation
// =============================================================================

func (s *Service) initiateMWalletPayment(
	ctx context.Context,
	gatewayTxn payment.GikiWalletGatewayTransaction,
	payload TopUpRequest,
	billRefNo, txnRefNo string,
) (*TopUpResult, error) {

	phoneNumber, err := NormalizePhoneNumber(payload.PhoneNumber)
	if err != nil {
		return nil, commonerrors.Wrap(ErrInvalidPhoneNumber, err)
	}

	cnic, err := NormalizeCNICLast6(payload.CNICLast6)
	if err != nil {
		return nil, commonerrors.Wrap(ErrInvalidCNIC, err)
	}

	now := NowPKT()
	txnDateTime := now.Format("20060102150405")
	txnExpiryDateTime := now.Add(24 * time.Hour).Format("20060102150405")

	mwRequest := gateway.MWalletInitiateRequest{
		AmountPaisa:       AmountToPaisa(gatewayTxn.Amount),
		BillRefID:         billRefNo,
		TxnRefNo:          txnRefNo,
		Description:       "GIKI Wallet Top Up",
		MobileNumber:      phoneNumber,
		CNICLast6:         cnic,
		TxnDateTime:       txnDateTime,
		TxnExpiryDateTime: txnExpiryDateTime,
	}

	_, err = s.gatewayClient.SubmitMWallet(ctx, mwRequest)
	if err != nil {
		return nil, commonerrors.Wrap(ErrGatewayUnavailable, err)
	}

	return s.checkTransactionStatus(ctx, gatewayTxn)
}

func (s *Service) initiateCardPayment(
	ctx context.Context,
	txnRefNo string,
) (string, error) {

	txn, err := s.q.GetTransactionByTxnRefNo(ctx, txnRefNo)
	if err != nil {
		return "", commonerrors.Wrap(ErrDatabaseQuery, err)
	}

	if txn.Status != "PENDING" {
		return "", fmt.Errorf("transaction is not pending")
	}

	now := NowPKT()
	txnDateTime := now.Format("20060102150405")
	txnExpiryDateTime := now.Add(24 * time.Hour).Format("20060102150405")
	returnURL := config.LoadConfig().Jazzcash.CardCallbackURL

	cardRequest := gateway.CardInitiateRequest{
		AmountPaisa:       AmountToPaisa(txn.Amount),
		BillRefID:         txn.BillRefID,
		TxnRefNo:          txn.TxnRefNo,
		Description:       "GIKI-Wallet-TopUp",
		ReturnURL:         returnURL,
		TxnDateTime:       txnDateTime,
		TxnExpiryDateTime: txnExpiryDateTime,
	}

	cardInitiateResponse, err := s.gatewayClient.InitiateCard(ctx, cardRequest)

	if err != nil {
		return "", commonerrors.Wrap(ErrGatewayUnavailable, err)
	}

	html := s.buildAutoSubmitForm(cardInitiateResponse.Fields, cardInitiateResponse.PostURL)

	return html, nil
}

func (s *Service) GetTransactionStatus(ctx context.Context, txnRefNo string) (*TopUpResult, error) {
	txn, err := s.q.GetTransactionByTxnRefNo(ctx, txnRefNo)
	if err != nil {
		return nil, commonerrors.Wrap(ErrDatabaseQuery, err)
	}

	return s.checkTransactionStatus(ctx, txn)
}

func (s *Service) creditWalletFromPayment(ctx context.Context, tx pgx.Tx, userID uuid.UUID, amount int64, paymentTxnRefNo string) error {

	// get user's wallet
	userWallet, err := s.walletS.GetOrCreateWallet(ctx, tx, userID)
	if err != nil {
		return fmt.Errorf("failed to get user wallet: %w", err)
	}

	// get system liability wallet (where top-up money comes from)
	systemLiabilityWalletID, err := s.walletS.GetSystemWalletByName(ctx, wallet.GikiWallet, wallet.SystemWalletLiability)
	if err != nil {
		return fmt.Errorf("failed to get system liability wallet: %w", err)
	}

	// prepare transaction details
	txnType := "JAZZCASH_DEPOSIT"
	description := fmt.Sprintf("Wallet top-up via payment %s", paymentTxnRefNo)

	err = s.walletS.ExecuteTransaction(
		ctx, tx,
		systemLiabilityWalletID,
		userWallet.ID,
		amount,
		txnType,
		paymentTxnRefNo,
		description,
	)

	if err != nil {

		if errors.Is(err, wallet.ErrDuplicateLedgerEntry) {
			// wallet already credited for transaction (idempotent)
			return nil
		}

		// Also check for raw database constraint violation (race condition)
		if CheckUniqueConstraintViolation(err) {
			return ErrIdempotentSuccess
		}

		return commonerrors.Wrap(commonerrors.ErrTransactionBegin, fmt.Errorf("wallet credit failed: %w", err))
	}
	return nil
}

// =============================================================================
// PRIVATE SERVICE METHODS - Transaction Status
// =============================================================================

// handleExistingTransaction checks and returns status of an existing transaction
func (s *Service) handleExistingTransaction(
	ctx context.Context,
	existing payment.GikiWalletGatewayTransaction,
) (*TopUpResult, error) {
	switch existing.Status {
	case payment.CurrentStatus(PaymentStatusSuccess):
		return &TopUpResult{
			ID:            existing.ID,
			TxnRefNo:      existing.TxnRefNo,
			Status:        PaymentStatusSuccess,
			Message:       "Transaction has already completed",
			PaymentMethod: PaymentMethod(existing.PaymentMethod),
			Amount:        float64(existing.Amount),
		}, nil

	case payment.CurrentStatus(PaymentStatusPending),
		payment.CurrentStatus(PaymentStatusUnknown),
		payment.CurrentStatus(PaymentStatusFailed):
		// For all non-success statuses, check the REAL status at JazzCash
		return s.checkTransactionStatus(ctx, existing)

	default:
		return &TopUpResult{
			ID:            existing.ID,
			TxnRefNo:      existing.TxnRefNo,
			Status:        PaymentStatusFailed,
			Message:       "Transaction has failed. Please create a new payment.",
			PaymentMethod: PaymentMethod(existing.PaymentMethod),
			Amount:        float64(existing.Amount) / 100.0,
		}, nil
	}
}

// checkTransactionStatus queries gateway for current status
func (s *Service) checkTransactionStatus(
	ctx context.Context,
	existing payment.GikiWalletGatewayTransaction,
) (*TopUpResult, error) {
	// External API call - no transaction held
	inquiryResult, err := s.gatewayClient.Inquiry(ctx, gateway.InquiryRequest{TxnRefNo: existing.TxnRefNo})

	if err != nil {
		return nil, commonerrors.Wrap(ErrGatewayUnavailable, err)
	}

	paymentStatus := GatewayStatusToPaymentStatus(inquiryResult.Status)

	switch paymentStatus {
	case PaymentStatusSuccess, PaymentStatusFailed:
		success, finalizeErr := s.finalizeTransaction(ctx, existing.TxnRefNo, inquiryResult)
		if !success && paymentStatus == PaymentStatusSuccess {
			if finalizeErr != nil {
				err := commonerrors.Wrap(ErrTransactionUpdate, fmt.Errorf("failed to finalize success transaction: %w", finalizeErr))
				err = err.WithDetails("internal_error", finalizeErr.Error())
				return nil, err
			}
		}



		return MapInquiryToTopUpResult(existing, *inquiryResult), nil

	case PaymentStatusPending, PaymentStatusUnknown:
		if time.Since(existing.CreatedAt) > 120*time.Second {
			s.finalizeTransaction(ctx, existing.TxnRefNo, inquiryResult)
			result := MapInquiryToTopUpResult(existing, *inquiryResult)
			result.Status = PaymentStatusFailed
			result.Message = "Transaction has timed out. Please try again."
			return result, nil
		}
		return MapInquiryToTopUpResult(existing, *inquiryResult), nil

	default:
		return MapInquiryToTopUpResult(existing, *inquiryResult), nil
	}
}

// =============================================================================
// PRIVATE SERVICE METHODS - Background Polling
// =============================================================================

// startPollingForTransaction polls gateway for transaction status updates
func (s *Service) startPollingForTransaction(txRefNo string) {
	conn, err := s.dbPool.Acquire(context.Background())
	if err != nil {
		middleware.LogAppError(commonerrors.Wrap(commonerrors.ErrDatabase, fmt.Errorf("failed to acquire db connection for polling: %w", err)), "polling-"+txRefNo)
		return
	}

	defer conn.Release()

	paymentQ := payment.New(conn)

	// Acquire polling lock
	_, err = paymentQ.UpdatePollingStatus(context.Background(), txRefNo)
	if err != nil {
		// polling already started or transaction not found
		middleware.LogAppError(commonerrors.Wrap(commonerrors.ErrDatabase, fmt.Errorf("polling already started or transaction not found: %w", err)), "polling-"+txRefNo)
		return
	}

	pollCtx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-pollCtx.Done():
			s.handlePollingTimeout(paymentQ, txRefNo)
			return

		case <-ticker.C:
			if done := s.pollTransactionOnce(pollCtx, txRefNo); done {
				return
			}
		}
	}
}

// handlePollingTimeout handles timeout during polling
func (s *Service) handlePollingTimeout(paymentQ *payment.Queries, txRefNo string) {
	cleanupCtx := context.Background()

	err := paymentQ.UpdateGatewayTransactionStatus(cleanupCtx, payment.UpdateGatewayTransactionStatusParams{
		Status:            payment.CurrentStatus(PaymentStatusFailed),
		TxnRefNo:          txRefNo,
		GatewayMessage:    pgtype.Text{String: "Polling timeout reached", Valid: true},
		GatewayStatusCode: pgtype.Text{String: "TIMEOUT", Valid: true},
	})

	if err != nil {
		middleware.LogAppError(commonerrors.Wrap(ErrTransactionUpdate, fmt.Errorf("failed to update status on timeout: %w", err)), "polling-"+txRefNo)
	}

	if err := paymentQ.ClearPollingStatus(cleanupCtx, txRefNo); err != nil {
		middleware.LogAppError(commonerrors.Wrap(commonerrors.ErrDatabase, fmt.Errorf("failed to clear polling status: %w", err)), "polling-"+txRefNo)
	}
}

func (s *Service) pollTransactionOnce(ctx context.Context, txRefNo string) bool {
	// 1. Acquire Rate Limiter
	if err := s.rateLimiter.Acquire(ctx); err != nil {
		middleware.LogAppError(commonerrors.Wrap(commonerrors.ErrInternal, fmt.Errorf("rate limiter acquire failed: %w", err)), "polling-"+txRefNo)
		return true
	}
	// Guaranteed release on exit
	defer s.rateLimiter.Release()

	// 2. Inquiry API Call
	inquiryResult, err := s.gatewayClient.Inquiry(ctx, gateway.InquiryRequest{TxnRefNo: txRefNo})
	if err != nil {
		middleware.LogAppError(commonerrors.Wrap(commonerrors.ErrExternalService, fmt.Errorf("inquiry API failed (will retry): %w", err)), "polling-"+txRefNo)
		return false
	}

	// 3. Database Transaction Block
	done, _ := s.finalizeTransaction(ctx, txRefNo, inquiryResult)
	return done
}


func (s *Service) finalizeTransaction(ctx context.Context, txRefNo string, inquiry *gateway.InquiryResponse) (bool, error) {
	status := GatewayStatusToPaymentStatus(inquiry.Status)
	isTerminal := status == PaymentStatusSuccess || status == PaymentStatusFailed

	// 1. PHASE 1: Update Status (PERSISTENT & INDEPENDENT)
	// We want this to stick even if Phase 2 fails.
	var existing payment.GikiWalletGatewayTransaction
	err := common.WithTransaction(ctx, s.dbPool, func(tx pgx.Tx) error {
		paymentQ := s.q.WithTx(tx)

		var err error
		existing, err = paymentQ.GetTransactionByTxnRefNo(ctx, txRefNo)
		if err != nil {
			return err
		}

		// Update Status & Clear Polling ONLY IF terminal
		updateErr := paymentQ.UpdateGatewayTransactionStatus(ctx, payment.UpdateGatewayTransactionStatusParams{
			Status:            payment.CurrentStatus(status),
			TxnRefNo:          txRefNo,
			GatewayMessage:    pgtype.Text{String: inquiry.Message, Valid: true},
			GatewayStatusCode: pgtype.Text{String: inquiry.ResponseCode, Valid: true},
		})
		if updateErr != nil {
			return updateErr
		}

		if isTerminal {
			if cleaningErr := paymentQ.ClearPollingStatus(ctx, txRefNo); cleaningErr != nil {
				return cleaningErr
			}
		}

		return nil
	})

	if err != nil {
		middleware.LogAppError(fmt.Errorf("status update failed for %s: %w", txRefNo, err), "finalizer-phase1")
		return false, err
	}

	// 2. PHASE 2: Credit Wallet (ONLY IF Success & Terminal)
	// This runs in a SEPARATE transaction. If this fails (e.g. unique constraint), 
	// it won't roll back the Status Update from Phase 1.
	if isTerminal && status == PaymentStatusSuccess {
		creditErr := common.WithTransaction(ctx, s.dbPool, func(tx pgx.Tx) error {
			// Check for recovery logging inside the credit transaction
			if existing.Status != payment.CurrentStatusSUCCESS {
				middleware.LogAppError(fmt.Errorf("RECONCILIATION RECOVERY: Transaction %s recovered to SUCCESS from %s", txRefNo, existing.Status), "reconciliation-recovery")
			}

			if creditErr := s.creditWalletFromPayment(ctx, tx, existing.UserID, existing.Amount, existing.TxnRefNo); creditErr != nil {
				// Don't treat idempotent success as an error
				if errors.Is(creditErr, ErrIdempotentSuccess) {
					return nil
				}
				return creditErr
			}
			return nil
		})

		if creditErr != nil {
			middleware.LogAppError(fmt.Errorf("wallet credit failed for %s: %w", txRefNo, creditErr), "finalizer-phase2")
			// We return true (it's terminal) but include the error 
			// so the caller knows the credit failed.
			return true, creditErr
		}
	}

	return isTerminal, nil
}




// =============================================================================
// HELPERS - Form Builder
// =============================================================================

func (s *Service) buildAutoSubmitForm(fields gateway.JazzCashFields, jazzcashPostURL string) string {
	var hiddenInputs strings.Builder
	for k, v := range fields {
		hiddenInputs.WriteString(fmt.Sprintf("\t\t\t\t\t<input type=\"hidden\" name=\"%s\" value=\"%s\">\n", k, v))
	}

	html := fmt.Sprintf(`
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
			<title>Secure Payment Redirect | GIKI Wallet</title>
			<script src="https://cdn.tailwindcss.com"></script>
			<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
			<style>
				* {
					margin: 0;
					padding: 0;
					box-sizing: border-box;
				}
				html, body {
					width: 100%%;
					height: 100%%;
					font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
				}
				body {
					display: flex;
					align-items: center;
					justify-content: center;
					background: linear-gradient(135deg, #f5f7fa 0%%, #c3cfe2 100%%);
					padding: 16px;
					min-height: 100vh;
				}
				.payment-card {
					animation: slideUp 0.6s ease-out;
				}
				@keyframes slideUp {
					from {
						opacity: 0;
						transform: translateY(20px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}
				.spinner {
					animation: spin 2s linear infinite;
				}
				@keyframes spin {
					from { transform: rotate(0deg); }
					to { transform: rotate(360deg); }
				}
			</style>
		</head>
		<body onload="document.getElementById('payForm').submit()">
			<div class="payment-card max-w-sm mx-auto bg-white rounded-3xl shadow-lg p-8 border border-gray-100 w-full">
				<div class="flex justify-center mb-6">
					<div class="relative w-16 h-16 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full flex items-center justify-center">
						<svg class="spinner w-8 h-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
							<circle class="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"></circle>
							<path class="opacity-100" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
					</div>
				</div>

				<div class="text-center mb-6">
					<h1 class="text-2xl font-bold text-gray-900 mb-2">Redirecting to Payment</h1>
					<p class="text-gray-600 text-sm leading-relaxed">
						Securely transferring you to JazzCash Payment Gateway...
					</p>
				</div>

				<div class="flex items-center justify-center gap-2 mb-6 px-3 py-2 bg-green-50 rounded-lg border border-green-100">
					<svg class="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
					</svg>
					<span class="text-xs font-semibold text-green-800">256-bit SSL Encrypted</span>
				</div>

				<form id="payForm" method="POST" action="%s" style="display: none;">
%s
				</form>

				<noscript>
					<div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
						<p class="text-yellow-900 font-semibold text-sm mb-3">JavaScript is disabled in your browser</p>
						<button type="submit" form="payForm" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-lg transition-colors text-sm">
							Continue to Payment
						</button>
					</div>
				</noscript>

				<div class="mt-4 text-center">
					<p class="text-xs text-gray-500 font-medium">Please wait...</p>
					<p class="text-xs text-gray-400 mt-1">Do not close this window</p>
				</div>
			</div>
		</body>
		</html>
	`, jazzcashPostURL, hiddenInputs.String(),
	)

	return html
}

// =============================================================================
// ADMIN SERVICE METHODS
// =============================================================================

func (s *Service) GetGatewayTransactions(ctx context.Context, params common.GatewayTransactionListParams) ([]payment.GetGatewayTransactionsRow, int64, int64, error) {
	arg := payment.GetGatewayTransactionsParams{
		Status:        pgtype.Text{String: params.Status, Valid: params.Status != ""},
		PaymentMethod: pgtype.Text{String: params.PaymentMethod, Valid: params.PaymentMethod != ""},
		StartDate:     params.StartDate,
		EndDate:       params.EndDate,
		Search:        params.Search,
		Limit:         int32(params.PageSize),
		Offset:        int32((params.Page - 1) * params.PageSize),
	}

	txns, err := s.q.GetGatewayTransactions(ctx, arg)
	if err != nil {
		middleware.LogAppError(fmt.Errorf("GetGatewayTransactions failed: %w; params: %+v", err, params), "payment-get-gateway-transactions")
		return nil, 0, 0, commonerrors.Wrap(ErrDatabaseQuery, err)
	}

	var total int64
	var totalAmount int64
	if len(txns) > 0 {
		total = txns[0].TotalCount
		totalAmount = txns[0].TotalAmount
	}

	return txns, total, totalAmount, nil
}

func (s *Service) VerifyTransaction(ctx context.Context, txnRefNo string) (*AdminGatewayTransaction, error) {
	// 1. Get status from gateway & update DB (Phase 1 & 2 logic inside)
	statusResult, err := s.GetTransactionStatus(ctx, txnRefNo)
	if err != nil {
		return nil, err
	}

	// 2. Fetch the DETAILED transaction (with user info) for the frontend
	txn, err := s.q.GetGatewayTransactionByRefDetailed(ctx, txnRefNo)
	if err != nil {
		middleware.LogAppError(fmt.Errorf("VerifyTransaction failed to fetch detailed txn %s: %w", txnRefNo, err), "verify-detailed")
		return nil, commonerrors.Wrap(ErrDatabaseQuery, err)
	}

	return &AdminGatewayTransaction{
		TxnRefNo:          txn.TxnRefNo,
		UserID:            txn.UserID,
		UserName:          txn.UserName,
		UserEmail:         txn.UserEmail,
		Amount:            fmt.Sprintf("%d", txn.Amount),
		Status:            statusResult.Status,
		PaymentMethod:     PaymentMethod(txn.PaymentMethod),
		CreatedAt:         txn.CreatedAt.Format(time.RFC3339),
		UpdatedAt:         txn.UpdatedAt.Format(time.RFC3339),
		BillRefID:         txn.BillRefID,
		GatewayMessage:    txn.GatewayMessage.String,
		GatewayStatusCode: txn.GatewayStatusCode.String,
	}, nil
}



func (s *Service) GetLiabilityWalletBalance(ctx context.Context) (float64, error) {
	return s.walletS.GetSystemWalletBalance(ctx, wallet.GikiWallet, wallet.SystemWalletLiability)
}

func (s *Service) GetTransportRevenueWalletBalance(ctx context.Context) (float64, error) {
	return s.walletS.GetSystemWalletBalance(ctx, wallet.TransportSystemWallet, wallet.SystemWalletRevenue)
}

func (s *Service) GetTransportRevenuePeriodVolume(ctx context.Context, startDate, endDate time.Time) (float64, error) {
	stats, err := s.walletS.GetWeeklyStats(ctx, startDate, endDate)
	if err != nil {
		return 0, err
	}

	netRevenue := float64(stats.TotalIncome+stats.TotalRefunds) / 100.0
	return netRevenue, nil
}

func (s *Service) ExportGatewayTransactions(ctx context.Context, params common.GatewayTransactionListParams) ([]byte, error) {
	arg := payment.GetGatewayTransactionsForExportParams{
		Status:        pgtype.Text{String: params.Status, Valid: params.Status != ""},
		PaymentMethod: pgtype.Text{String: params.PaymentMethod, Valid: params.PaymentMethod != ""},
		StartDate:     params.StartDate,
		EndDate:       params.EndDate,
		Search:        params.Search,
	}

	rows, err := s.q.GetGatewayTransactionsForExport(ctx, arg)
	if err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrDatabase, err)
	}

	buf := new(bytes.Buffer)
	w := csv.NewWriter(buf)

	// Header
	if err := w.Write([]string{
		"Transaction Ref",
		"Bill Ref",
		"User Name",
		"User Email",
		"Amount",
		"Status",
		"Method",
		"Date",
	}); err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrInternal, err)
	}

	// Rows
	for _, row := range rows {
		amount := float64(row.Amount) / 100.0

		if err := w.Write([]string{
			row.TxnRefNo,
			row.BillRefID,
			row.UserName,
			row.UserEmail,
			fmt.Sprintf("%.2f", amount),
			string(row.Status),
			string(row.PaymentMethod),
			row.CreatedAt.Format(time.RFC3339),
		}); err != nil {
			return nil, commonerrors.Wrap(commonerrors.ErrInternal, err)
		}
	}

	w.Flush()
	if err := w.Error(); err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrInternal, err)
	}

	return buf.Bytes(), nil
}

func (s *Service) GetTransactionAuditLogs(ctx context.Context, txnRefNo string) ([]payment.GikiWalletPaymentAuditLog, error) {
	logs, err := s.q.GetAuditLogsByTxn(ctx, pgtype.Text{String: txnRefNo, Valid: true})
	if err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrDatabase, err)
	}
	if logs == nil {
		return []payment.GikiWalletPaymentAuditLog{}, nil
	}
	return logs, nil
}

// =============================================================================
// RECONCILIATION METHODS
// =============================================================================

// StalePendingRefNos returns the TxnRefNo of all stale PENDING/UNKNOWN transactions.
// This is called by the worker's 5-minute sweep to decide what to enqueue.
func (s *Service) StalePendingRefNos(ctx context.Context) []string {
	// First: auto-fail any transactions older than 24h — they are permanently abandoned.
	if err := s.q.AutoFailStalePendingTransactions(ctx); err != nil {
		middleware.LogAppError(fmt.Errorf("[reconciliation] AutoFailStalePendingTransactions failed: %w", err), "reconciliation-autofail")
	}

	txns, err := s.q.GetStalePendingTransactions(ctx)
	if err != nil {
		middleware.LogAppError(fmt.Errorf("[reconciliation] GetStalePendingTransactions failed: %w", err), "reconciliation-sweep")
		return nil
	}

	refs := make([]string, 0, len(txns))
	for _, t := range txns {
		refs = append(refs, t.TxnRefNo)
	}
	return refs
}


// ReconcileTransaction is called by the worker for each RECONCILE_PAYMENT job.
// It performs the same status check as the admin "Verify" button.
// If still PENDING, it re-enqueues with a 5-minute delay (up to 3 attempts).
// On attempt 3, it leaves the transaction for manual admin review.
func (s *Service) ReconcileTransaction(ctx context.Context, txnRefNo string, attempt int) error {
	const maxAttempts = 3

	txn, err := s.q.GetTransactionByTxnRefNo(ctx, txnRefNo)
	if err != nil {
		return fmt.Errorf("[reconciliation] GetTransactionByTxnRefNo failed for %s: %w", txnRefNo, err)
	}

	// Already resolved — nothing to do
	if txn.Status == payment.CurrentStatusSUCCESS || txn.Status == payment.CurrentStatusFAILED {
		log.Printf("[reconciliation] %s is already terminal (%s), skipping", txnRefNo, txn.Status)
		return nil
	}

	// Query JazzCash and finalize (credits wallet if SUCCESS)
	_, checkErr := s.checkTransactionStatus(ctx, txn)
	if checkErr != nil {
		// Gateway error — re-enqueue if retries remain
		if attempt < maxAttempts && s.workerS != nil {
			log.Printf("[reconciliation] %s gateway error (attempt %d), will retry: %v", txnRefNo, attempt, checkErr)
			return s.workerS.EnqueueIn(ctx, "RECONCILE_PAYMENT", ReconcilePaymentRef{
				TxnRefNo: txnRefNo,
				Attempt:  attempt + 1,
			}, 3*time.Minute)
		}
		log.Printf("[reconciliation] %s exhausted retries, leaving for admin", txnRefNo)
		return nil
	}

	// Re-check DB status after the call
	updated, err := s.q.GetTransactionByTxnRefNo(ctx, txnRefNo)
	if err != nil {
		return nil // best-effort
	}

	if updated.Status == payment.CurrentStatusSUCCESS || updated.Status == payment.CurrentStatusFAILED {
		log.Printf("[reconciliation] %s resolved to %s ✓", txnRefNo, updated.Status)
		return nil
	}

	// Still pending — retry or give up
	if attempt < maxAttempts && s.workerS != nil {
		log.Printf("[reconciliation] %s still PENDING (attempt %d/%d), re-enqueueing in 3m", txnRefNo, attempt, maxAttempts)
		return s.workerS.EnqueueIn(ctx, "RECONCILE_PAYMENT", ReconcilePaymentRef{
			TxnRefNo: txnRefNo,
			Attempt:  attempt + 1,
		}, 3*time.Minute)
	}

	log.Printf("[reconciliation] %s still PENDING after %d attempts — leaving for admin", txnRefNo, maxAttempts)
	return nil
}

// ReconcilePaymentRef is the minimal payload for re-enqueuing a reconciliation job.
type ReconcilePaymentRef struct {
	TxnRefNo string `json:"txn_ref_no"`
	Attempt  int    `json:"attempt"`
}
