package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/hash-walker/giki-wallet/internal/common"
	"github.com/hash-walker/giki-wallet/internal/mailer"
	"github.com/hash-walker/giki-wallet/internal/middleware"
	worker "github.com/hash-walker/giki-wallet/internal/worker/worker_db"
	"github.com/jackc/pgx/v5/pgxpool"
)

type JobWorker struct {
	q              *worker.Queries
	dbPool         *pgxpool.Pool
	mailer         *mailer.GraphSender
	lastHeartbeat  time.Time
	reconcileFunc  func(ctx context.Context, txnRefNo string, attempt int) error
	staleFetcher   func(ctx context.Context) []string
}

func NewWorker(dbPool *pgxpool.Pool, mailer *mailer.GraphSender) *JobWorker {
	return &JobWorker{
		q:             worker.New(dbPool),
		dbPool:        dbPool,
		mailer:        mailer,
		lastHeartbeat: time.Now(),
	}
}

// SetReconciler wires the payment reconciliation callback to avoid circular imports.
func (w *JobWorker) SetReconciler(fn func(ctx context.Context, txnRefNo string, attempt int) error) {
	w.reconcileFunc = fn
}

// SetStaleFetcher wires a function that returns TxnRefNo strings for stale pending transactions.
func (w *JobWorker) SetStaleFetcher(fn func(ctx context.Context) []string) {
	w.staleFetcher = fn
}

func (w *JobWorker) Enqueue(ctx context.Context, jobType string, payload interface{}) error {
	return w.EnqueueIn(ctx, jobType, payload, 0)
}

func (w *JobWorker) EnqueueIn(ctx context.Context, jobType string, payload interface{}, delay time.Duration) error {
	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal job payload: %w", err)
	}

	runAt := time.Now().Add(delay)

	_, err = w.q.CreateJob(ctx, worker.CreateJobParams{
		JobType: jobType,
		Payload: jsonBytes,
		RunAt:   runAt,
	})

	if err != nil {
		return fmt.Errorf("failed to enqueue job: %w", err)
	}

	return nil
}

func (w *JobWorker) StartJobTicker(ctx context.Context, workerCount int) {
	for i := range workerCount {
		go func(workerID int) {
			time.Sleep(time.Duration(workerID*100) * time.Millisecond)
			ticker := time.NewTicker(200 * time.Millisecond)
			defer ticker.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					w.processNextJob(ctx)
				}
			}
		}(i)
	}
}

func (w *JobWorker) StartStatusTicker(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	pruneTicker := time.NewTicker(1 * time.Hour)
	reconcileTicker := time.NewTicker(3 * time.Minute)
	defer ticker.Stop()
	defer pruneTicker.Stop()
	defer reconcileTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.lastHeartbeat = time.Now()
			if err := w.q.AutoOpenTrips(ctx); err != nil {
				middleware.LogAppError(err, "Error opening trips")
			}

			if err := w.q.AutoCloseTrips(ctx); err != nil {
				middleware.LogAppError(err, "Error closing trips")
			}
		case <-pruneTicker.C:
			// Cleanup old data to maintain DB scale
			if err := w.q.PruneCompletedJobs(ctx); err != nil {
				middleware.LogAppError(err, "Error pruning jobs")
			}
			if err := w.q.PruneExpiredTokens(ctx); err != nil {
				middleware.LogAppError(err, "Error pruning tokens")
			}
		case <-reconcileTicker.C:
			w.runReconciliationSweep(ctx)
		}
	}
}

func (w *JobWorker) runReconciliationSweep(ctx context.Context) {
	if w.reconcileFunc == nil || w.staleFetcher == nil {
		// Not wired yet — skip.
		return
	}

	stale := w.staleFetcher(ctx)
	if len(stale) == 0 {
		return
	}

	log.Printf("[reconciliation] Found %d stale pending transaction(s) — enqueuing jobs", len(stale))

	for _, txnRefNo := range stale {
		payload := ReconcilePaymentPayload{
			TxnRefNo: txnRefNo,
			Attempt:  1,
		}
		if err := w.Enqueue(ctx, "RECONCILE_PAYMENT", payload); err != nil {
			middleware.LogAppError(err, "[reconciliation] Failed to enqueue job for "+txnRefNo)
		} else {
			log.Printf("[reconciliation] Enqueued RECONCILE_PAYMENT for %s", txnRefNo)
		}
	}
}


func (w *JobWorker) processNextJob(ctx context.Context) {
	job, err := w.q.FetchNextJob(ctx)
	if err != nil {
		return
	}

	var processErr error

	switch job.JobType {
	case "SEND_STUDENT_VERIFY_EMAIL":
		processErr = w.handleStudentVerification(job.Payload)
	case "SEND_EMPLOYEE_WAIT_EMAIL":
		processErr = w.handleEmployeeWait(job.Payload)
	case "SEND_EMPLOYEE_APPROVED_EMAIL":
		processErr = w.handleEmployeeApproved(job.Payload)
	case "SEND_EMPLOYEE_REJECTED_EMAIL":
		processErr = w.handleEmployeeRejected(job.Payload)
	case "SEND_TICKET_CONFIRMATION":
		processErr = w.handleTicketConfirmation(job.Payload)
	case "SEND_TICKET_CANCELLED":
		processErr = w.handleTicketCancelled(job.Payload)
	case "SEND_ACCOUNT_CREATED_EMAIL":
		processErr = w.handleAccountCreated(job.Payload)
	case "SEND_PASSWORD_RESET_EMAIL":
		processErr = w.handlePasswordReset(job.Payload)
	case "RECONCILE_PAYMENT":
		processErr = w.handlePaymentReconciliation(ctx, job.Payload)
	default:
		log.Printf("Unknown job type: %s", job.JobType)
		processErr = fmt.Errorf("unknown job type")
	}

	if processErr != nil {
		w.q.FailJob(ctx, worker.FailJobParams{
			ID:        job.ID,
			LastError: common.StringToText(processErr.Error()),
		})
	} else {
		w.q.CompleteJob(ctx, job.ID)
	}
}

func (w *JobWorker) handlePaymentReconciliation(ctx context.Context, payload json.RawMessage) error {
	var data ReconcilePaymentPayload
	if err := json.Unmarshal(payload, &data); err != nil {
		return fmt.Errorf("failed to unmarshal reconcile payload: %w", err)
	}

	if w.reconcileFunc == nil {
		return fmt.Errorf("reconcile function not set")
	}

	log.Printf("[reconciliation] Processing RECONCILE_PAYMENT for %s (attempt %d)", data.TxnRefNo, data.Attempt)
	return w.reconcileFunc(ctx, data.TxnRefNo, data.Attempt)
}

func (w *JobWorker) handleStudentVerification(payload json.RawMessage) error {

	var data StudentVerifyPayload
	if err := json.Unmarshal(payload, &data); err != nil {
		return err
	}

	return w.mailer.SendTemplate(data.Email, "Verify your GIKI Account", "verify.html", data)
}

func (w *JobWorker) handleEmployeeWait(payload json.RawMessage) error {
	var data EmployeeWaitPayload

	if err := json.Unmarshal(payload, &data); err != nil {
		return err
	}

	return w.mailer.SendTemplate(data.Email, "Application Received", "pending.html", data)
}

func (w *JobWorker) handleEmployeeApproved(payload json.RawMessage) error {
	var data EmployeeApprovedPayload
	if err := json.Unmarshal(payload, &data); err != nil {
		return err
	}

	return w.mailer.SendTemplate(data.Email, "Account Approved!", "employee_approved.html", data)
}

func (w *JobWorker) handleEmployeeRejected(payload json.RawMessage) error {
	var data EmployeeWaitPayload
	if err := json.Unmarshal(payload, &data); err != nil {
		return err
	}

	return w.mailer.SendTemplate(data.Email, "Application Status", "rejected.html", data)
}

func (w *JobWorker) handleTicketConfirmation(payload json.RawMessage) error {
	var data TicketConfirmedPayload
	if err := json.Unmarshal(payload, &data); err != nil {
		return err
	}

	return w.mailer.SendTemplate(data.Email, "Booking Confirmation", "ticket_confirmed.html", data)
}

func (w *JobWorker) handleTicketCancelled(payload json.RawMessage) error {
	var data TicketCancelledPayload
	if err := json.Unmarshal(payload, &data); err != nil {
		return err
	}

	return w.mailer.SendTemplate(data.Email, "Trip Cancellation Notice", "ticket_cancelled.html", data)
}

func (w *JobWorker) handleAccountCreated(payload json.RawMessage) error {
	var data AccountCreatedPayload
	if err := json.Unmarshal(payload, &data); err != nil {
		return err
	}

	return w.mailer.SendTemplate(data.Email, "Welcome to GIKI Transport", "account_created.html", data)
}

func (w *JobWorker) handlePasswordReset(payload json.RawMessage) error {
	var data PasswordResetPayload
	if err := json.Unmarshal(payload, &data); err != nil {
		return err
	}

	return w.mailer.SendTemplate(data.Email, "Reset Your GIKI Password", "reset_password.html", data)
}
func (w *JobWorker) GetStatus(ctx context.Context) (map[string]interface{}, error) {
	stats, err := w.q.GetJobStats(ctx)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"last_heartbeat": w.lastHeartbeat,
		"is_alive":       time.Since(w.lastHeartbeat) < 5*time.Minute,
		"stats":          stats,
	}, nil
}
