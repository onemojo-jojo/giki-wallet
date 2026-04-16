package transport

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"math/rand"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/hash-walker/giki-wallet/internal/common"
	commonerrors "github.com/hash-walker/giki-wallet/internal/common/errors"
	"github.com/hash-walker/giki-wallet/internal/middleware"
	"github.com/hash-walker/giki-wallet/internal/transport/transport_db"
	"github.com/hash-walker/giki-wallet/internal/wallet"
	"github.com/hash-walker/giki-wallet/internal/worker"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	q      *transport_db.Queries
	wallet *wallet.Service
	worker *worker.JobWorker
	dbPool *pgxpool.Pool

	dashboardCache map[string]tripCacheEntry
	cacheMutex     sync.RWMutex
	loc            *time.Location
}

func NewService(dbPool *pgxpool.Pool, walletService *wallet.Service, worker *worker.JobWorker, loc *time.Location) *Service {
	return &Service{
		q:              transport_db.New(dbPool),
		wallet:         walletService,
		worker:         worker,
		dbPool:         dbPool,
		dashboardCache: make(map[string]tripCacheEntry),
		loc:            loc,
	}
}

// =============================================================================
// 1. TRIP MANAGEMENT (The New Logic)
// =============================================================================

func (s *Service) GetWeeklyTrips(ctx context.Context, startDate, endDate time.Time) ([]TripResponse, error) {

	cacheKey := fmt.Sprintf("%d_%d", startDate.Unix(), endDate.Unix())

	s.cacheMutex.RLock()
	entry, found := s.dashboardCache[cacheKey]
	s.cacheMutex.RUnlock()

	if found && time.Now().Before(entry.expiresAt) {
		return entry.data, nil
	}

	s.cacheMutex.Lock()
	defer s.cacheMutex.Unlock()

	entry, found = s.dashboardCache[cacheKey]
	if found && time.Now().Before(entry.expiresAt) {
		return entry.data, nil
	}

	rows, err := s.q.GetTripsForWeekWithStops(ctx, transport_db.GetTripsForWeekWithStopsParams{
		DepartureTime:   startDate,
		DepartureTime_2: endDate,
	})

	if err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrDatabase, err)
	}

	data := mapDbTripsForWeekToResponse(rows)

	if len(s.dashboardCache) > 100 {
		s.dashboardCache = make(map[string]tripCacheEntry)
	}

	s.dashboardCache[cacheKey] = tripCacheEntry{
		data:      data,
		expiresAt: time.Now().Add(5 * time.Second),
	}

	return data, nil
}

func (s *Service) CreateTrip(ctx context.Context, req CreateTripRequest) (uuid.UUID, error) {

	// 1. Validate Input Early
	if req.TotalCapacity <= 0 {
		return uuid.Nil, commonerrors.ErrInvalidInput
	}

	if req.BasePrice < 0 {
		return uuid.Nil, commonerrors.ErrInvalidInput
	}

	if req.BookingOpenOffsetMinutes <= req.BookingCloseOffsetMinutes {
		return uuid.Nil, commonerrors.New(commonerrors.ErrInvalidInput.Code, commonerrors.ErrInvalidInput.StatusCode, "booking open offset must be greater than close offset")
	}

	var tripID uuid.UUID
	err := common.WithTransaction(ctx, s.dbPool, func(tx pgx.Tx) error {
		qtx := s.q.WithTx(tx)

		basePrice := common.AmountToLowestUnit(req.BasePrice)

		var createErr error
		tripID, createErr = qtx.CreateTrip(ctx, transport_db.CreateTripParams{
			RouteID:                  req.RouteID,
			DepartureTime:            req.DepartureTime,
			BookingOpenOffsetMinutes:  req.BookingOpenOffsetMinutes,
			BookingCloseOffsetMinutes: req.BookingCloseOffsetMinutes,
			TotalCapacity:            int32(req.TotalCapacity),
			AvailableSeats:           int32(req.TotalCapacity),
			BasePrice:                basePrice,
			BusType:                  req.BusType,
			Direction:                req.Direction,
		})

		if createErr != nil {
			return commonerrors.Wrap(ErrTripCreationFailed, createErr)
		}

		for i, stop := range req.Stops {
			err := qtx.CreateTripStop(ctx, transport_db.CreateTripStopParams{
				TripID:        tripID,
				StopID:        stop.StopID,
				SequenceOrder: int32(i + 1),
			})
			if err != nil {
				return commonerrors.Wrap(ErrTripCreationFailed, err)
			}
		}

		return nil
	})

	if err != nil {
		return uuid.Nil, err
	}

	return tripID, nil
}

func (s *Service) UpdateTrip(ctx context.Context, tripID uuid.UUID, req CreateTripRequest) error {
	if req.TotalCapacity <= 0 {
		return commonerrors.ErrInvalidInput
	}
	if req.BasePrice < 0 {
		return commonerrors.ErrInvalidInput
	}
	if req.BookingOpenOffsetMinutes <= req.BookingCloseOffsetMinutes {
		return commonerrors.New(commonerrors.ErrInvalidInput.Code, commonerrors.ErrInvalidInput.StatusCode, "booking open offset must be greater than close offset")
	}

	// Check if new capacity is valid against sold tickets
	soldCount, err := s.q.GetTripBookingCount(ctx, tripID)
	if err != nil {
		return commonerrors.Wrap(commonerrors.ErrDatabase, err)
	}

	if int64(req.TotalCapacity) < soldCount {
		return commonerrors.New(commonerrors.ErrConflict.Code, commonerrors.ErrConflict.StatusCode, fmt.Sprintf("cannot reduce capacity below sold tickets count (%d)", soldCount))
	}

	err = s.q.UpdateTrip(ctx, transport_db.UpdateTripParams{
		ID:                       tripID,
		DepartureTime:            req.DepartureTime,
		BookingOpenOffsetMinutes:  req.BookingOpenOffsetMinutes,
		BookingCloseOffsetMinutes: req.BookingCloseOffsetMinutes,
		TotalCapacity:            int32(req.TotalCapacity),
		BasePrice:                common.AmountToLowestUnit(req.BasePrice),
		BusType:                  req.BusType,
	})

	if err != nil {
		return commonerrors.Wrap(commonerrors.ErrDatabase, err)
	}

	return nil
}

func (s *Service) DeleteTrip(ctx context.Context, tripID uuid.UUID) error {
	count, err := s.q.GetTripBookingCount(ctx, tripID)
	if err != nil {
		return commonerrors.Wrap(commonerrors.ErrDatabase, err)
	}

	if count > 0 {
		return ErrTripHasBookings
	}

	if err := s.q.DeleteTrip(ctx, tripID); err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok && pgErr.Code == "23503" {
			return commonerrors.New(commonerrors.ErrConflict.Code, commonerrors.ErrConflict.StatusCode, "Cannot delete trip: dependent records exist (e.g. holds/stops). Please cancel instead.")
		}
		return commonerrors.Wrap(commonerrors.ErrDatabase, err)
	}

	return nil
}

// =============================================================================
// 2. ROUTE INFO
// =============================================================================

func (s *Service) RoutesList(ctx context.Context) ([]Route, error) {
	rows, err := s.q.GetAllRoutes(ctx)
	if err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrDatabase, err)
	}

	routes := make([]Route, len(rows))
	for i, row := range rows {
		routes[i] = mapDBRouteToRoute(row)
	}
	return routes, nil
}

func (s *Service) GetRouteTemplate(ctx context.Context, routeID uuid.UUID) (*RouteTemplateResponse, error) {
	routeTemplateRows, err := s.q.GetRouteStopsDetails(ctx, routeID)
	if err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrDatabase, err)
	}
	if len(routeTemplateRows) == 0 {
		return nil, ErrRouteNotFound
	}

	weeklyScheduleRows, err := s.q.GetRouteWeeklySchedule(ctx, routeID)
	if err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrDatabase, err)
	}

	return mapDBRouteTemplateToRouteTemplate(routeTemplateRows, weeklyScheduleRows), nil
}

// =============================================================================
// 3. BOOKING & HOLD LOGIC
// =============================================================================

func (s *Service) HoldSeats(ctx context.Context, userID uuid.UUID, userRole string, req HoldSeatsRequest) (*HoldSeatsResponse, error) {

	var holds []HoldTicketResponse

	err := common.WithTransaction(ctx, s.dbPool, func(tx pgx.Tx) error {
		qtx := s.q.WithTx(tx)

		if _, lockErr := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtext($1))", userID.String()); lockErr != nil {
			return commonerrors.Wrap(commonerrors.ErrDatabase, lockErr)
		}

		trip, tripErr := qtx.GetTrip(ctx, req.TripID)
		if tripErr != nil {
			if errors.Is(tripErr, pgx.ErrNoRows) {
				return ErrTripNotFound
			}
			return commonerrors.Wrap(commonerrors.ErrDatabase, tripErr)
		}

		if userRole != "TRANSPORT_ADMIN" && userRole != "SUPER_ADMIN" {
			if !strings.EqualFold(trip.BusType, userRole) {
				return ErrBusTypeMismatch
			}

			if trip.ComputedStatus != "OPEN" {
				return ErrTripNotOpen
			}
		}

		rule, quotaErr := qtx.GetQuotaRule(ctx, transport_db.GetQuotaRuleParams{
			UserRole:  userRole,
			Direction: trip.Direction,
		})

		if quotaErr != nil {
			if errors.Is(quotaErr, pgx.ErrNoRows) {
				return ErrNoQuotaPolicy
			}
			return commonerrors.Wrap(commonerrors.ErrDatabase, quotaErr)
		}

		usage, usageErr := qtx.GetWeeklyTicketCountByDirection(ctx, transport_db.GetWeeklyTicketCountByDirectionParams{
			UserID:        userID,
			Direction:     trip.Direction,
			ReferenceTime: trip.DepartureTime,
		})

		if usageErr != nil {
			return commonerrors.Wrap(commonerrors.ErrDatabase, usageErr)
		}

		if (usage + int64(req.Count)) > int64(rule.WeeklyLimit) {
			return ErrQuotaExceeded
		}

		holdDuration := 3 * time.Minute
		if userRole == "TRANSPORT_ADMIN" || userRole == "SUPER_ADMIN" || userRole == "EMPLOYEE" {
			holdDuration = 7 * time.Minute
		}
		expiry := time.Now().Add(holdDuration)

		for i := 0; i < req.Count; i++ {
			// Decrement seat
			_, decErr := qtx.DecreaseTripSeat(ctx, req.TripID)
			if decErr != nil {
				if common.IsUniqueConstraintViolation(decErr) || strings.Contains(decErr.Error(), "available_seats") {
					return ErrTripFull
				}
				return commonerrors.Wrap(commonerrors.ErrDatabase, decErr)
			}

			// Create hold
			hold, holdErr := qtx.CreateBlankHold(ctx, transport_db.CreateBlankHoldParams{
				TripID:        req.TripID,
				UserID:        userID,
				PickupStopID:  req.PickupStopID,
				DropoffStopID: req.DropoffStopID,
				ExpiresAt:     expiry,
			})

			if holdErr != nil {
				return commonerrors.Wrap(commonerrors.ErrDatabase, holdErr)
			}

			holds = append(holds, HoldTicketResponse{
				HoldID:    hold.ID,
				ExpiresAt: expiry,
			})
		}

		return nil // Transaction commits here automatically
	})

	if err != nil {
		return nil, err
	}

	return &HoldSeatsResponse{Holds: holds}, nil
}

func (s *Service) ConfirmBatch(ctx context.Context, userID uuid.UUID, userRole string, items []ConfirmItem) (*ConfirmBatchResponse, error) {

	if len(items) == 0 {
		return &ConfirmBatchResponse{Tickets: []BookTicketResponse{}}, nil
	}

	var tickets []BookTicketResponse
	tripCache := make(map[uuid.UUID]transport_db.GetTripRow)
	routeCache := make(map[uuid.UUID]transport_db.GetRouteDetailsForTripRow)

	shouldChargeWallet := strings.ToUpper(userRole) == "STUDENT" || strings.ToUpper(userRole) == "EMPLOYEE"

	var emailDetails []worker.TicketDetail
	var totalPrice int

	err := common.WithTransaction(ctx, s.dbPool, func(tx pgx.Tx) error {
		qtx := s.q.WithTx(tx)

		if _, lockErr := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtext($1))", userID.String()); lockErr != nil {
			return commonerrors.Wrap(commonerrors.ErrDatabase, lockErr)
		}

		var err error

		var userWalletID, revenueWalletID uuid.UUID
		if shouldChargeWallet {
			userWallet, err := s.wallet.GetOrCreateWallet(ctx, tx, userID)
			if err != nil {
				return err
			}
			userWalletID = userWallet.ID

			revWalletID, err := s.wallet.GetSystemWalletByName(ctx, wallet.TransportSystemWallet, wallet.SystemWalletRevenue)
			if err != nil {
				return err
			}
			revenueWalletID = revWalletID

			if _, err := s.wallet.GetWalletForUpdate(ctx, tx, revenueWalletID); err != nil {
				return commonerrors.Wrap(wallet.ErrDatabase, err)
			}
		}

			
		holds := make([]transport_db.GikiTransportTripHold, len(items))
		uniqueTripIDs := make(map[uuid.UUID]struct{})
		for i, item := range items {
			// Use FOR UPDATE to lock holds first (consistent lock order with reaper to prevent deadlocks)
			hold, err := qtx.GetHoldForUpdate(ctx, item.HoldID)
			if err != nil {
				return commonerrors.Wrap(commonerrors.ErrDatabase, err)
			}
			// Verify hold belongs to requesting user
			if hold.UserID != userID {
				return commonerrors.ErrUnauthorized
			}
			holds[i] = hold
			uniqueTripIDs[hold.TripID] = struct{}{}
		}

	
		sortedTripIDs := make([]uuid.UUID, 0, len(uniqueTripIDs))
		for id := range uniqueTripIDs {
			sortedTripIDs = append(sortedTripIDs, id)
		}
		common.SortUUIDs(sortedTripIDs)

		for _, tripID := range sortedTripIDs {
			if _, err := qtx.GetTripForUpdate(ctx, tripID); err != nil {
				return commonerrors.Wrap(commonerrors.ErrDatabase, err)
			}
		}

	
		for i, item := range items {
			hold := holds[i]

			if time.Now().After(hold.ExpiresAt) {
				return ErrHoldExpired
			}

			var trip transport_db.GetTripRow
			if cachedTrip, exists := tripCache[hold.TripID]; exists {
				trip = cachedTrip
			} else {
				trip, err = qtx.GetTrip(ctx, hold.TripID)
				if err != nil {
					return commonerrors.Wrap(commonerrors.ErrDatabase, err)
				}
				tripCache[hold.TripID] = trip
			}
			price := trip.BasePrice

			var routeDetails transport_db.GetRouteDetailsForTripRow
			if cachedRoute, exists := routeCache[hold.TripID]; exists {
				routeDetails = cachedRoute
			} else {
				routeDetails, err = qtx.GetRouteDetailsForTrip(ctx, hold.TripID)
				if err != nil {
					routeDetails = transport_db.GetRouteDetailsForTripRow{RouteName: "Unknown Route", Direction: "Unknown"}
				} else {
					routeCache[hold.TripID] = routeDetails
				}
			}

			var ticketRow transport_db.ConfirmBookingWithDetailsRow
			var bookingErr error
			var finalCode string

			for range 5 {
				code := GenerateRandomCode()
				ticketRow, bookingErr = qtx.ConfirmBookingWithDetails(ctx, transport_db.ConfirmBookingWithDetailsParams{
					TripID:            hold.TripID,
					UserID:            userID,
					TicketCode:        code,
					PickupStopID:      hold.PickupStopID,
					DropoffStopID:     hold.DropoffStopID,
					PassengerName:     item.PassengerName,
					PassengerRelation: item.PassengerRelation,
					PricePaid:         price,
				})

				if bookingErr == nil {
					finalCode = code
					break
				}

				if !common.IsUniqueConstraintViolation(bookingErr) {
					return commonerrors.Wrap(commonerrors.ErrDatabase, bookingErr)
				}
			}

			if bookingErr != nil {
				return commonerrors.Wrap(commonerrors.ErrDatabase, bookingErr)
			}

			ticketID := ticketRow.ID

			if err := qtx.DeleteHold(ctx, item.HoldID); err != nil {
				return commonerrors.Wrap(commonerrors.ErrDatabase, err)
			}

			if shouldChargeWallet && price > 0 {
				err := s.wallet.ExecuteTransaction(
					ctx,
					tx,
					userWalletID,
					revenueWalletID,
					int64(price),
					"TRANSPORT_BOOKING",
					ticketID.String(),
					fmt.Sprintf("Ticket for %s", item.PassengerName),
				)
				if err != nil {
					return err
				}
			}

			tickets = append(tickets, BookTicketResponse{
				TicketID: ticketID,
				Status:   "CONFIRMED",
			})

			emailDetails = append(emailDetails, worker.TicketDetail{
				SerialNo:      strconv.Itoa(int(ticketRow.SerialNo)),
				TicketCode:    finalCode,
				PassengerName: item.PassengerName,
				RouteName:     routeDetails.RouteName,
				TripTime:      trip.DepartureTime.In(s.loc).Format("Mon, 02 Jan 15:04"),
				Price:         int(price / 100),
			})
			totalPrice += int(price)

		}

		return nil

	})

	if err != nil {
		return nil, err
	}

	bgCtx := context.Background()
	_ = s.enqueueTicketConfirmationJob(bgCtx, userID, emailDetails, totalPrice)

	return &ConfirmBatchResponse{Tickets: tickets}, nil
}

func (s *Service) enqueueTicketConfirmationJob(ctx context.Context, userID uuid.UUID, tickets []worker.TicketDetail, totalPrice int) error {

	user, err := s.q.GetUserEmailAndName(ctx, userID)
	if err != nil {
		middleware.LogAppError(err, "Failed to fetch user for email")
		return err
	}

	payload := worker.TicketConfirmedPayload{
		Email:      user.Email,
		UserName:   user.Name,
		TotalPrice: totalPrice / 100,
		Tickets:    tickets,
	}

	if err = s.worker.Enqueue(ctx, "SEND_TICKET_CONFIRMATION", payload); err != nil {
		middleware.LogAppError(err, "Failed to enqueue ticket email")
		return err
	}

	return nil
}

func (s *Service) GetUserQuota(ctx context.Context, userID uuid.UUID, userRole string) (*QuotaResponse, error) {

	directions := []string{"OUTBOUND", "INBOUND"}
	resp := &QuotaResponse{}

	for _, dir := range directions {
		// 1. Get rule
		rule, err := s.q.GetQuotaRule(ctx, transport_db.GetQuotaRuleParams{
			UserRole:  userRole,
			Direction: dir,
		})
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				continue // Skip if no policy for this direction
			}
			return nil, commonerrors.Wrap(commonerrors.ErrDatabase, err)
		}

		// 2. Get usage
		usage, err := s.q.GetWeeklyTicketCountByDirection(ctx, transport_db.GetWeeklyTicketCountByDirectionParams{
			UserID:        userID,
			Direction:     dir,
			ReferenceTime: time.Now(),
		})
		if err != nil {
			return nil, commonerrors.Wrap(commonerrors.ErrDatabase, err)
		}

		quotaUsage := QuotaUsage{
			Limit:     int(rule.WeeklyLimit),
			Used:      int(usage),
			Remaining: int(rule.WeeklyLimit) - int(usage),
		}

		if dir == "OUTBOUND" {
			resp.Outbound = quotaUsage
		} else {
			resp.Inbound = quotaUsage
		}
	}

	return resp, nil
}

func (s *Service) GetActiveHolds(ctx context.Context, userID uuid.UUID) ([]ActiveHoldResponse, error) {
	rows, err := s.q.GetActiveHoldsByUserID(ctx, userID)
	if err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrDatabase, err)
	}

	resp := make([]ActiveHoldResponse, 0, len(rows))
	for _, row := range rows {
		resp = append(resp, ActiveHoldResponse{
			ID:        row.ID,
			TripID:    row.TripID,
			ExpiresAt: row.ExpiresAt,
			Direction: row.Direction,
			RouteName: row.RouteName,
		})
	}

	return resp, nil
}

func (s *Service) ReleaseAllHolds(ctx context.Context, userID uuid.UUID) error {

	err := common.WithTransaction(ctx, s.dbPool, func(tx pgx.Tx) error {
		qtx := s.q.WithTx(tx)

		tripIDs, err := qtx.DeleteAllActiveHoldsByUserID(ctx, userID)
		if err != nil {
			return commonerrors.Wrap(commonerrors.ErrDatabase, err)
		}

		for _, tripID := range tripIDs {
			if err = qtx.IncrementTripSeat(ctx, tripID); err != nil {
				return commonerrors.Wrap(commonerrors.ErrDatabase, err)
			}
		}

		return nil
	})

	if err != nil {
		return err
	}

	return nil
}

func (s *Service) CancelTicketWithRole(ctx context.Context, requestingUserID uuid.UUID, ticketID uuid.UUID, userRole string) error {

	err := common.WithTransaction(ctx, s.dbPool, func(tx pgx.Tx) error {
		qtx := s.q.WithTx(tx)

		ticket, err := qtx.GetTicketForCancellation(ctx, ticketID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrCancellationClosed
			}
			return commonerrors.Wrap(commonerrors.ErrDatabase, err)
		}

		if ticket.UserID != requestingUserID {
			return commonerrors.ErrUnauthorized
		}
		if strings.ToUpper(userRole) == "STUDENT" || strings.ToUpper(userRole) == "EMPLOYEE" {
			refundAmount := ticket.BasePrice

			if refundAmount > 0 {
				// SAFETY CHECK: Verify that a corresponding TRANSPORT_BOOKING debit exists
				// before issuing a refund. This prevents crediting money that was never debited
				// (e.g., due to race conditions or partial failures).
				debitExists, verifyErr := s.wallet.VerifyBookingDebitExists(ctx, ticketID.String())
				if verifyErr != nil {
					return commonerrors.Wrap(commonerrors.ErrDatabase, verifyErr)
				}

				if !debitExists {
					middleware.LogAppError(
						fmt.Errorf("ALERT: cancel requested for ticket %s but no TRANSPORT_BOOKING debit found, skipping refund", ticketID),
						"cancel-ticket-no-debit",
					)
				} else {
					userWallet, err := s.wallet.GetOrCreateWallet(ctx, tx, ticket.UserID)
					if err != nil {
						return commonerrors.Wrap(commonerrors.ErrDatabase, err)
					}

					revenueWalletID, err := s.wallet.GetSystemWalletByName(ctx, wallet.TransportSystemWallet, wallet.SystemWalletRevenue)
					if err != nil {
						return commonerrors.Wrap(commonerrors.ErrDatabase, err)
					}

					err = s.wallet.ExecuteTransaction(
						ctx,
						tx,
						revenueWalletID,
						userWallet.ID,
						int64(refundAmount),
						"REFUND",
						ticketID.String(),
						"Trip cancellation refund",
					)
					if err != nil {
						return ErrRefundFailed
					}
				}
			}
		}

		if err := qtx.SetTicketCancelled(ctx, ticketID); err != nil {
			return commonerrors.Wrap(commonerrors.ErrDatabase, err)
		}
		if err := qtx.IncrementTripSeat(ctx, ticket.TripID); err != nil {
			return commonerrors.Wrap(commonerrors.ErrDatabase, err)
		}

		return nil
	})

	if err != nil {
		return err
	}

	return nil
}

func (s *Service) GetUserTickets(ctx context.Context, userID uuid.UUID) ([]MyTicketResponse, error) {
	rows, err := s.q.GetUserTicketsByID(ctx, userID)
	if err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrDatabase, err)
	}
	return mapDBTicketsToResponse(rows), nil
}

func GenerateRandomCode() string {
	const charset = "0123456789"
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	b := make([]byte, 5)
	for i := range b {
		b[i] = charset[rng.Intn(len(charset))]
	}
	return string(b)
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. REVENUE & TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════════

func (s *Service) GetRevenueTransactions(ctx context.Context, page, pageSize int) (*wallet.LedgerHistoryWithPagination, error) {
	revenueWalletID, err := s.wallet.GetSystemWalletByName(ctx, wallet.TransportSystemWallet, wallet.SystemWalletRevenue)
	if err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrInternal, err)
	}

	return s.wallet.GetWalletHistory(ctx, revenueWalletID, page, pageSize)
}
func (s *Service) ExportTripData(ctx context.Context, tripIDs []uuid.UUID) ([]byte, error) {
	// 1. Get all ticket rows (only trips WITH confirmed tickets will appear here)
	rows, err := s.q.GetTripsForExport(ctx, tripIDs)
	if err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrDatabase, err)
	}

	// 2. Get trip info for ALL requested trips (including those with zero tickets)
	allTrips, err := s.q.GetTripInfoForExport(ctx, tripIDs)
	if err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrDatabase, err)
	}

	type TripGroup struct {
		TripID        uuid.UUID
		RouteName     string
		DepartureTime time.Time
		BusType       string
		Direction     string
		Tickets       []transport_db.GetTripsForExportRow
	}

	trips := make(map[uuid.UUID]*TripGroup)
	var tripOrder []*TripGroup

	// 3. Seed all trips from the info query (guarantees every selected trip is included)
	for _, info := range allTrips {
		tg := &TripGroup{
			TripID:        info.TripID,
			RouteName:     info.RouteName,
			DepartureTime: info.DepartureTime,
			BusType:       info.BusType,
			Direction:     info.Direction,
			Tickets:       []transport_db.GetTripsForExportRow{},
		}
		trips[info.TripID] = tg
		tripOrder = append(tripOrder, tg)
	}

	// 4. Attach ticket rows to their trip groups
	for _, row := range rows {
		tg, exists := trips[row.TripID]
		if !exists {
			continue // shouldn't happen, but defensive
		}
		tg.Tickets = append(tg.Tickets, row)
	}

	// 5. Create ZIP buffer
	buf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(buf)

	for _, tg := range tripOrder {
		safeRouteName := strings.ReplaceAll(tg.RouteName, " ", "_")
		safeRouteName = strings.ReplaceAll(safeRouteName, "/", "-")
		filename := fmt.Sprintf("%s_%s_%s_%s.csv", safeRouteName, tg.Direction, tg.BusType, tg.DepartureTime.In(s.loc).Format("20060102_1504"))

		// FIX: Use CreateHeader with proper Modified time (fixes 1979 date bug)
		header := &zip.FileHeader{
			Name:     filename,
			Method:   zip.Deflate,
			Modified: tg.DepartureTime,
		}
		f, err := zipWriter.CreateHeader(header)
		if err != nil {
			return nil, commonerrors.Wrap(commonerrors.ErrInternal, err)
		}

		w := csv.NewWriter(f)

		// Header Info
		_ = w.Write([]string{"GIKI TRANSPORT - TRIP MANIFEST"})
		_ = w.Write([]string{"Route", tg.RouteName})
		_ = w.Write([]string{"Bus", tg.BusType})
		_ = w.Write([]string{"Departure", tg.DepartureTime.In(s.loc).Format("Mon, 02 Jan 15:04")})
		_ = w.Write([]string{"Direction", tg.Direction})
		_ = w.Write([]string{"Total Passengers", strconv.Itoa(len(tg.Tickets))})
		_ = w.Write([]string{}) // Empty row

		if len(tg.Tickets) == 0 {
			_ = w.Write([]string{"No confirmed passengers for this trip."})
		} else {
			// Pre-calculate counts per stop
			stopCounts := make(map[string]int)
			for _, t := range tg.Tickets {
				stopCounts[t.StopName]++
			}

			// Group by Stops
			currentStop := ""
			for _, ticket := range tg.Tickets {
				// If new stop, print stop header
				if ticket.StopName != currentStop {
					if currentStop != "" {
						_ = w.Write([]string{})
					}
					currentStop = ticket.StopName
					count := stopCounts[currentStop]
					_ = w.Write([]string{"STOP: " + strings.ToUpper(currentStop), "TOTAL: " + strconv.Itoa(count)})
					_ = w.Write([]string{"Serial", "Ticket Code", "Passenger Name", "Mobile Number", "Email"})
				}

				_ = w.Write([]string{
					strconv.Itoa(int(ticket.SerialNo)),
					ticket.TicketCode,
					ticket.PassengerName,
					ticket.UserPhoneNumber,
					ticket.UserEmail,
				})
			}
		}

		w.Flush()
		if err := w.Error(); err != nil {
			return nil, commonerrors.Wrap(commonerrors.ErrInternal, err)
		}
	}

	if err := zipWriter.Close(); err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrInternal, err)
	}

	return buf.Bytes(), nil
}
func (s *Service) AdminGetTickets(ctx context.Context, startDate, endDate time.Time, busType, status, search string, page, pageSize int) (*AdminTicketPaginationResponse, error) {
	limit := int32(pageSize)
	offset := int32((page - 1) * pageSize)

	rows, err := s.q.GetTicketsForAdmin(ctx, transport_db.GetTicketsForAdminParams{
		StartDate: startDate,
		EndDate:   endDate,
		BusType:   busType,
		Status:    status,
		Search:    search,
		Limit:     limit,
		Offset:    offset,
	})
	if err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrDatabase, err)
	}

	var totalCount int64
	if len(rows) > 0 {
		totalCount = rows[0].TotalCount
	}

	// Fetch weekly stats (independent of pagination/filters)
	stats, err := s.q.GetWeeklyTicketStats(ctx, transport_db.GetWeeklyTicketStatsParams{
		DepartureTime:   startDate,
		DepartureTime_2: endDate,
	})
	if err != nil {
		// Log error but continue, or return? For now let's just return what we have or zero stats
		// Ideally we should log this.
	}

	return &AdminTicketPaginationResponse{
		Data:       mapAdminTicketsToItem(rows),
		TotalCount: totalCount,
		Page:       page,
		PageSize:   pageSize,
		Stats: &WeeklyStats{
			StudentCount:   stats.StudentCount,
			EmployeeCount:  stats.EmployeeCount,
			TotalConfirmed: stats.TotalConfirmed,
		},
	}, nil
}

// =============================================================================
// MANUAL STATUS MANAGEMENT
// =============================================================================

func (s *Service) UpdateTripManualStatus(ctx context.Context, tripID uuid.UUID, manualStatus string) error {
	return s.q.UpdateTripManualStatus(ctx, transport_db.UpdateTripManualStatusParams{
		ID:           tripID,
		ManualStatus: common.StringToText(manualStatus),
	})
}

func (s *Service) BatchUpdateTripManualStatus(ctx context.Context, tripIDs []uuid.UUID, manualStatus string) error {
	return s.q.BatchUpdateTripManualStatus(ctx, transport_db.BatchUpdateTripManualStatusParams{
		Column1:      tripIDs,
		ManualStatus: common.StringToText(manualStatus),
	})
}

func (s *Service) CancelTrip(ctx context.Context, tripID uuid.UUID) error {
	return common.WithTransaction(ctx, s.dbPool, func(tx pgx.Tx) error {
		qtx := s.q.WithTx(tx)

		tickets, err := qtx.GetConfirmedTicketsForTrip(ctx, tripID)
		if err != nil {
			return commonerrors.Wrap(commonerrors.ErrDatabase, err)
		}

		for _, ticket := range tickets {
			// Safety: only refund if a debit was actually recorded for this ticket
			debitExists, verifyErr := s.wallet.VerifyBookingDebitExists(ctx, ticket.TicketID.String())
			if verifyErr != nil {
				return commonerrors.Wrap(commonerrors.ErrDatabase, verifyErr)
			}

			if debitExists {
				err := s.wallet.RefundTicket(
					ctx, tx,
					ticket.UserID,
					int64(ticket.BasePrice),
					ticket.TicketID.String(),
					fmt.Sprintf("Refund for cancelled trip %s", ticket.RouteName),
				)
				if err != nil {
					return commonerrors.Wrap(ErrRefundFailed, err)
				}
			}

			userEmailInfo, err := s.q.GetUserEmailAndName(ctx, ticket.UserID)
			if err == nil {
				_ = s.worker.Enqueue(ctx, "SEND_TICKET_CANCELLED", worker.TicketCancelledPayload{
					Email:        userEmailInfo.Email,
					UserName:     userEmailInfo.Name,
					TicketCode:   ticket.TicketCode,
					RouteName:    ticket.RouteName,
					RefundAmount: int(ticket.BasePrice / 100),
					Reason:       "Administrative Cancellation",
				})
			}
		}

		if err := qtx.CancelTicketsByTripID(ctx, tripID); err != nil {
			return commonerrors.Wrap(commonerrors.ErrDatabase, err)
		}

		if err := qtx.UpdateTripManualStatus(ctx, transport_db.UpdateTripManualStatusParams{
			ID:           tripID,
			ManualStatus: common.StringToText("CANCELLED"),
		}); err != nil {
			return commonerrors.Wrap(commonerrors.ErrDatabase, err)
		}

		return nil
	})
}

