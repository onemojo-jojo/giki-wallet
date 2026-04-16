package transport

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/hash-walker/giki-wallet/internal/audit"
	"github.com/hash-walker/giki-wallet/internal/auth"
	"github.com/hash-walker/giki-wallet/internal/common"
	commonerrors "github.com/hash-walker/giki-wallet/internal/common/errors"
	"github.com/hash-walker/giki-wallet/internal/middleware"
)

type Handler struct {
	service *Service
	audit   *audit.Service
}

func NewHandler(service *Service, audit *audit.Service) *Handler {
	return &Handler{
		service: service,
		audit:   audit,
	}
}

// =============================================================================
// TRIP & ROUTE ENDPOINTS
// =============================================================================

// HandleWeeklyTrips returns the "Dashboard" view: All trips for the week
func (h *Handler) HandleWeeklyTrips(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())

	var params common.DateRangeParams
	if err := params.Bind(r); err != nil {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidInput, err), requestID)
		return
	}

	trips, err := h.service.GetWeeklyTrips(r.Context(), params.StartDate, params.EndDate)
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	common.ResponseWithJSON(w, http.StatusOK, trips, requestID)
}

func (h *Handler) CreateTrip(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())
	var req CreateTripRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidJSON, err), requestID)
		return
	}

	tripID, err := h.service.CreateTrip(r.Context(), req)
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	h.logAdminAction(r.Context(), r, audit.ActionAdminCreateTrip, &tripID, map[string]interface{}{"route_id": req.RouteID, "departure": req.DepartureTime})

	common.ResponseWithJSON(w, http.StatusCreated, CreateTripResponse{TripID: tripID}, requestID)
}

func (h *Handler) ListRoutes(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())

	routes, err := h.service.RoutesList(r.Context())
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	common.ResponseWithJSON(w, http.StatusOK, routes, requestID)
}

func (h *Handler) GetRouteTemplate(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())

	routeIDParam := chi.URLParam(r, "route_id")
	routeID, err := uuid.Parse(routeIDParam)
	if err != nil {
		middleware.HandleError(w, commonerrors.Wrap(ErrInvalidRouteID, err), requestID)
		return
	}

	template, err := h.service.GetRouteTemplate(r.Context(), routeID)
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	common.ResponseWithJSON(w, http.StatusOK, template, requestID)
}

func (h *Handler) DeleteTrip(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())

	tripIDParam := chi.URLParam(r, "trip_id")
	tripID, err := uuid.Parse(tripIDParam)
	if err != nil {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidInput, err), requestID)
		return
	}

	err = h.service.DeleteTrip(r.Context(), tripID)
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	h.logAdminAction(r.Context(), r, audit.ActionAdminDeleteTrip, &tripID, nil)

	common.ResponseWithJSON(w, http.StatusOK, map[string]string{"status": "deleted"}, requestID)
}

func (h *Handler) UpdateTrip(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())

	tripIDParam := chi.URLParam(r, "trip_id")
	tripID, err := uuid.Parse(tripIDParam)
	if err != nil {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidInput, err), requestID)
		return
	}

	var req CreateTripRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidJSON, err), requestID)
		return
	}

	err = h.service.UpdateTrip(r.Context(), tripID, req)
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	h.logAdminAction(r.Context(), r, audit.ActionAdminUpdateTrip, &tripID, map[string]interface{}{"action": "update_trip_details"})

	common.ResponseWithJSON(w, http.StatusOK, map[string]string{"status": "updated"}, requestID)
}

func (h *Handler) AdminGetRevenueTransactions(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())

	var params common.PaginationParams
	if err := params.Bind(r); err != nil {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidInput, err), requestID)
		return
	}

	txns, err := h.service.GetRevenueTransactions(r.Context(), params.Page, params.PageSize)
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	common.ResponseWithJSON(w, http.StatusOK, txns, requestID)
}

func (h *Handler) HandleExportTrips(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())

	// 1. Parse Trip IDs
	tripIDs, err := h.parseUUIDListParam(r, "trip_ids")
	if err != nil {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidInput, err), requestID)
		return
	}

	if len(tripIDs) == 0 {
		middleware.HandleError(w, commonerrors.New("MISSING_TRIP_IDS", http.StatusBadRequest, "At least one trip ID is required for export"), requestID)
		return
	}

	// 2. Call Service
	zipBytes, err := h.service.ExportTripData(r.Context(), tripIDs)
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	// 3. Return File Response
	filename := fmt.Sprintf("trip_manifests_%s.zip", time.Now().Format("20060102"))
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	w.Header().Set("Content-Length", strconv.Itoa(len(zipBytes)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(zipBytes)
}

// --- Handler Helpers ---

func (h *Handler) parseUUIDListParam(r *http.Request, key string) ([]uuid.UUID, error) {
	raw := r.URL.Query().Get(key)
	if raw == "" {
		return nil, nil
	}

	var ids []uuid.UUID
	for _, p := range strings.Split(raw, ",") {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}

		id, err := uuid.Parse(p)
		if err != nil {
			return nil, fmt.Errorf("invalid uuid in %s: %s", key, p)
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// =============================================================================
// BOOKING & QUOTA ENDPOINTS
// =============================================================================

func (h *Handler) HoldSeats(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())
	userID, ok := auth.GetUserIDFromContext(r.Context())
	if !ok {
		middleware.HandleError(w, commonerrors.ErrUnauthorized, requestID)
		return
	}

	userRole := getUserRoleForTransport(r)

	var req HoldSeatsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidJSON, err), requestID)
		return
	}

	resp, err := h.service.HoldSeats(r.Context(), userID, userRole, req)
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	common.ResponseWithJSON(w, http.StatusCreated, resp, requestID)
}

func (h *Handler) ConfirmBatch(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())
	userID, ok := auth.GetUserIDFromContext(r.Context())
	if !ok {
		middleware.HandleError(w, commonerrors.ErrUnauthorized, requestID)
		return
	}

	userRole := getUserRoleForTransport(r)

	var req ConfirmBatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidJSON, err), requestID)
		return
	}

	resp, err := h.service.ConfirmBatch(r.Context(), userID, userRole, req.Confirmations)
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	common.ResponseWithJSON(w, http.StatusOK, resp, requestID)
}

func (h *Handler) GetQuota(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())
	userID, ok := auth.GetUserIDFromContext(r.Context())
	if !ok {
		middleware.HandleError(w, commonerrors.ErrUnauthorized, requestID)
		return
	}

	userRole := getUserRoleForTransport(r)

	resp, err := h.service.GetUserQuota(r.Context(), userID, userRole)
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	common.ResponseWithJSON(w, http.StatusOK, resp, requestID)
}

func (h *Handler) GetActiveHolds(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())
	userID, ok := auth.GetUserIDFromContext(r.Context())
	if !ok {
		middleware.HandleError(w, commonerrors.ErrUnauthorized, requestID)
		return
	}

	resp, err := h.service.GetActiveHolds(r.Context(), userID)
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	common.ResponseWithJSON(w, http.StatusOK, resp, requestID)
}

func (h *Handler) ReleaseAllActiveHolds(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())
	userID, ok := auth.GetUserIDFromContext(r.Context())
	if !ok {
		middleware.HandleError(w, commonerrors.ErrUnauthorized, requestID)
		return
	}

	err := h.service.ReleaseAllHolds(r.Context(), userID)
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	common.ResponseWithJSON(w, http.StatusOK, map[string]string{"status": "RELEASED"}, requestID)
}

func (h *Handler) CancelTicket(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())
	userID, ok := auth.GetUserIDFromContext(r.Context())
	if !ok {
		middleware.HandleError(w, commonerrors.ErrUnauthorized, requestID)
		return
	}

	ticketIDParam := chi.URLParam(r, "ticket_id")
	ticketID, err := uuid.Parse(ticketIDParam)
	if err != nil {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidInput, err), requestID)
		return
	}

	userRole := getUserRoleForTransport(r)

	if err := h.service.CancelTicketWithRole(r.Context(), userID, ticketID, userRole); err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	common.ResponseWithJSON(w, http.StatusOK, map[string]string{"status": "CANCELLED"}, requestID)
}

func (h *Handler) GetUserTickets(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())
	userID, ok := auth.GetUserIDFromContext(r.Context())
	if !ok {
		middleware.HandleError(w, commonerrors.ErrUnauthorized, requestID)
		return
	}

	tickets, err := h.service.GetUserTickets(r.Context(), userID)
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	common.ResponseWithJSON(w, http.StatusOK, tickets, requestID)
}

// =============================================================================
// HELPER
// =============================================================================

func getUserRoleForTransport(r *http.Request) string {
	role, ok := auth.GetUserRoleFromContext(r.Context())
	if !ok || strings.TrimSpace(role) == "" {
		return "STUDENT"
	}
	switch strings.ToLower(role) {
	case "student":
		return "STUDENT"
	case "employee":
		return "EMPLOYEE"
	default:
		return strings.ToUpper(role)
	}
}

func (h *Handler) HandleAdminTickets(w http.ResponseWriter, r *http.Request) {

	requestID := middleware.GetRequestID(r.Context())

	var params common.TicketListParams
	if err := params.Bind(r); err != nil {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidInput, err), requestID)
		return
	}

	busType := r.URL.Query().Get("bus_type")
	if busType == "all" {
		busType = ""
	}

	status := r.URL.Query().Get("status")
	if status == "all" {
		status = ""
	}

	search := r.URL.Query().Get("search")

	response, err := h.service.AdminGetTickets(
		r.Context(),
		params.StartDate,
		params.EndDate,
		busType,
		status,
		search,
		params.Page,
		params.PageSize,
	)
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	common.ResponseWithJSON(w, http.StatusOK, response, requestID)
}

// =============================================================================
// TRIP MANUAL STATUS MANAGEMENT
// =============================================================================

func (h *Handler) UpdateTripManualStatus(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())

	tripIDStr := chi.URLParam(r, "id")
	tripID, err := uuid.Parse(tripIDStr)
	if err != nil {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidInput, err), requestID)
		return
	}

	var req struct {
		ManualStatus string `json:"manual_status"` // "OPEN", "CLOSED", or null to clear
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidJSON, err), requestID)
		return
	}

	if err := h.service.UpdateTripManualStatus(r.Context(), tripID, req.ManualStatus); err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	h.logAdminAction(r.Context(), r, audit.ActionAdminUpdateTrip, &tripID, map[string]interface{}{"manual_status": req.ManualStatus})

	common.ResponseWithJSON(w, http.StatusOK, map[string]string{"message": "Trip status updated"}, requestID)
}

func (h *Handler) BatchUpdateTripManualStatus(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())

	var req struct {
		TripIDs      []string `json:"trip_ids"`
		ManualStatus string   `json:"manual_status"` // "OPEN" or "CLOSED"
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidJSON, err), requestID)
		return
	}

	tripIDs := make([]uuid.UUID, len(req.TripIDs))
	for i, idStr := range req.TripIDs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidInput, err), requestID)
			return
		}
		tripIDs[i] = id
	}

	if err := h.service.BatchUpdateTripManualStatus(r.Context(), tripIDs, req.ManualStatus); err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	h.logAdminAction(r.Context(), r, audit.ActionAdminUpdateTrip, nil, map[string]interface{}{"batch_update": "status", "count": len(tripIDs), "status": req.ManualStatus})

	common.ResponseWithJSON(w, http.StatusOK, map[string]string{"message": fmt.Sprintf("%d trips updated", len(tripIDs))}, requestID)
}

func (h *Handler) CancelTrip(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())

	tripIDStr := chi.URLParam(r, "id")
	tripID, err := uuid.Parse(tripIDStr)
	if err != nil {
		middleware.HandleError(w, commonerrors.Wrap(commonerrors.ErrInvalidInput, err), requestID)
		return
	}

	if err := h.service.CancelTrip(r.Context(), tripID); err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	h.logAdminAction(r.Context(), r, audit.ActionAdminCancelTrip, &tripID, map[string]interface{}{"action": "trip_cancellation_and_refund"})

	common.ResponseWithJSON(w, http.StatusOK, map[string]string{"message": "Trip cancelled and refunds processed"}, requestID)
}

func (h *Handler) ReconcileEmployeeCancelRefunds(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetRequestID(r.Context())

	result, err := h.service.ReconcileEmployeeCancelRefunds(r.Context())
	if err != nil {
		middleware.HandleError(w, err, requestID)
		return
	}

	h.logAdminAction(r.Context(), r, audit.ActionAdminCancelTrip, nil, map[string]interface{}{
		"action":    "reconcile_employee_cancel_refunds",
		"refunded":  result.Refunded,
		"processed": result.Processed,
		"skipped":   result.Skipped,
	})

	common.ResponseWithJSON(w, http.StatusOK, result, requestID)
}

// logAdminAction is a helper to centralize audit logging
func (h *Handler) logAdminAction(ctx context.Context, r *http.Request, action string, targetID *uuid.UUID, details map[string]interface{}) {
	ip := common.GetClientIP(r)
	userAgent := r.UserAgent()
	actorID, _ := auth.GetUserIDFromContext(ctx)

	_ = h.audit.LogSecurityEvent(ctx, audit.Event{
		ActorID:   &actorID,
		Action:    action,
		TargetID:  targetID,
		IPAddress: ip,
		UserAgent: userAgent,
		Status:    audit.StatusSuccess,
		Details:   details,
	})
}
