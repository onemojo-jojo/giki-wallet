package payment

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/hash-walker/giki-wallet/internal/auth"
	"github.com/hash-walker/giki-wallet/internal/common"
	commonerrors "github.com/hash-walker/giki-wallet/internal/common/errors"
	"github.com/hash-walker/giki-wallet/internal/middleware"
	"github.com/hash-walker/giki-wallet/internal/wallet"
)

type Handler struct {
	pService *Service
	wService *wallet.Service
}

func NewHandler(pService *Service, wService *wallet.Service) *Handler {
	return &Handler{
		pService: pService,
		wService: wService,
	}
}

func (h *Handler) TopUp(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())
	var params TopUpRequest

	_, ok := auth.GetUserRoleFromContext(r.Context())

	if !ok {
		middleware.HandleError(w, commonerrors.ErrUnauthorized, requestID)
		return
	}

	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidJSON, err), requestID)
		return
	}

	response, err := h.pService.InitiatePayment(r.Context(), params)

	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	if response.PaymentMethod == PaymentMethodMWallet && response.Status == PaymentStatusPending {
		go h.pService.startPollingForTransaction(response.TxnRefNo)
	}

	switch response.Status {
	case PaymentStatusSuccess:
		common.ResponseWithJSON(w, http.StatusOK, response, requestID)
	case PaymentStatusFailed:
		common.ResponseWithJSON(w, http.StatusOK, response, requestID)
	default:
		common.ResponseWithJSON(w, http.StatusAccepted, response, requestID)
	}
}

func (h *Handler) CardPaymentPage(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())
	txnRefNo := chi.URLParam(r, "txnRefNo")

	html, err := h.pService.initiateCardPayment(r.Context(), txnRefNo)
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(html))
}

func (h *Handler) CardCallBack(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())

	err := r.ParseForm()
	if err != nil {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidInput, err), requestID)
		return
	}

	auditID, err := h.pService.LogCardCallbackAudit(r.Context(), r.Form)

	if err != nil {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInternal, err), requestID)
		return
	}

	tx, err := h.pService.dbPool.Begin(r.Context())

	if err != nil {
		middleware.LogAppError(commonerrors.Wrap(commonerrors.ErrDatabase, err), requestID)
		h.pService.MarkAuditFailed(r.Context(), auditID, err.Error())
		http.Redirect(w, r, h.pService.AppURL+"/payment/pending", http.StatusSeeOther)
		return
	}
	defer tx.Rollback(r.Context())

	result, err := h.pService.CompleteCardPayment(r.Context(), tx, r.Form, auditID)

	if err != nil {
		middleware.LogAppError(err, requestID)
		h.pService.MarkAuditFailed(r.Context(), auditID, err.Error())
		http.Redirect(w, r, h.pService.AppURL+"/payment/pending", http.StatusSeeOther)
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		middleware.LogAppError(commonerrors.Wrap(commonerrors.ErrDatabase, err), requestID)
		h.pService.MarkAuditFailed(r.Context(), auditID, err.Error())
		http.Redirect(w, r, h.pService.AppURL+"/payment/error", http.StatusSeeOther)
		return
	}

	if result.Status == PaymentStatusSuccess {
		http.Redirect(w, r, h.pService.AppURL+"/payment/success?txn="+result.TxnRefNo, http.StatusSeeOther)
	} else {
		http.Redirect(w, r, h.pService.AppURL+"/payment/failed?txn="+result.TxnRefNo, http.StatusSeeOther)
	}
}

func (h *Handler) CheckStatus(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())
	txnRefNo := chi.URLParam(r, "txnRefNo")

	if txnRefNo == "" {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidInput, nil), requestID)
		return
	}

	result, err := h.pService.GetTransactionStatus(r.Context(), txnRefNo)
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	common.ResponseWithJSON(w, http.StatusOK, result, requestID)
}

// =============================================================================
// ADMIN HANDLERS
// =============================================================================

func (h *Handler) ListGatewayTransactions(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())

	var params common.GatewayTransactionListParams
	if err := params.Bind(r); err != nil {
		appErr := commonerrors.New("INVALID_REQUEST", http.StatusBadRequest, err.Error())
		middleware.HandleError(w, appErr, requestID)
		return
	}

	txns, totalCount, totalAmount, err := h.pService.GetGatewayTransactions(r.Context(), params)
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	response := make([]AdminGatewayTransaction, len(txns))
	for i, txn := range txns {
		response[i] = AdminGatewayTransaction{
			TxnRefNo:      txn.TxnRefNo,
			UserID:        txn.UserID,
			UserName:      txn.UserName,
			UserEmail:     txn.UserEmail,
			Amount:        fmt.Sprintf("%d", txn.Amount),
			Status:        PaymentStatus(txn.Status),
			PaymentMethod: PaymentMethod(txn.PaymentMethod),
			CreatedAt:         txn.CreatedAt.Format(time.RFC3339),
			UpdatedAt:         txn.UpdatedAt.Format(time.RFC3339),
			BillRefID:         txn.BillRefID,
			GatewayMessage:    txn.GatewayMessage.String,
			GatewayStatusCode: txn.GatewayStatusCode.String,
		}

	}

	common.ResponseWithJSON(w, http.StatusOK, map[string]interface{}{
		"data":         response,
		"total_count":  totalCount,
		"total_amount": fmt.Sprintf("%d", totalAmount),
		"page":         params.Page,
		"page_size":    params.PageSize,
	}, requestID)
}

func (h *Handler) VerifyGatewayTransaction(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())
	txnRefNo := chi.URLParam(r, "txnRefNo")

	if txnRefNo == "" {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidInput, nil), requestID)
		return
	}

	result, err := h.pService.VerifyTransaction(r.Context(), txnRefNo)
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	common.ResponseWithJSON(w, http.StatusOK, result, requestID)
}

func (h *Handler) GetLiabilityBalance(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())

	balance, err := h.pService.GetLiabilityWalletBalance(r.Context())
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	common.ResponseWithJSON(w, http.StatusOK, map[string]interface{}{
		"balance":  balance,
		"currency": "PKR",
	}, requestID)
}

func (h *Handler) GetRevenueBalance(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())

	balance, err := h.pService.GetTransportRevenueWalletBalance(r.Context())
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	common.ResponseWithJSON(w, http.StatusOK, map[string]interface{}{
		"balance":  balance,
		"currency": "PKR",
	}, requestID)
}

func (h *Handler) GetRevenuePeriodVolume(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())

	var params common.GatewayTransactionListParams
	if err := params.Bind(r); err != nil {
		appErr := commonerrors.New("INVALID_REQUEST", http.StatusBadRequest, err.Error())
		middleware.HandleError(w, appErr, requestID)
		return
	}

	volume, err := h.pService.GetTransportRevenuePeriodVolume(r.Context(), params.StartDate, params.EndDate)
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	common.ResponseWithJSON(w, http.StatusOK, map[string]interface{}{
		"volume":   volume,
		"currency": "PKR",
	}, requestID)
}

func (h *Handler) HandleExportGatewayTransactions(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())

	var params common.GatewayTransactionListParams
	if err := params.Bind(r); err != nil {
		appErr := commonerrors.New("INVALID_REQUEST", http.StatusBadRequest, err.Error())
		middleware.HandleError(w, appErr, requestID)
		return
	}

	csvData, err := h.pService.ExportGatewayTransactions(r.Context(), params)
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	filename := fmt.Sprintf("gateway_transactions_%s.csv", time.Now().Format("20060102_1504"))

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	w.Write(csvData)
}

func (h *Handler) GetTransactionAuditLogs(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())
	txnRefNo := chi.URLParam(r, "txnRefNo")

	logs, err := h.pService.GetTransactionAuditLogs(r.Context(), txnRefNo)
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	common.ResponseWithJSON(w, http.StatusOK, logs, requestID)
}
