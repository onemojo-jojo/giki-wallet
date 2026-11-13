package transport

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/hash-walker/giki-wallet/internal/common"
	"github.com/hash-walker/giki-wallet/internal/transport/transport_db"
	"github.com/hash-walker/giki-wallet/internal/types"
)

type tripCacheEntry struct {
	data      []TripResponse
	expiresAt time.Time
}

type Route struct {
	RouteID   uuid.UUID `json:"route_id"`
	RouteName string    `json:"route_name"`
}

type RouteTemplateResponse struct {
	RouteID    uuid.UUID       `json:"route_id"`
	RouteName  string          `json:"route_name"`
	Rules      RuleSet         `json:"rules"`
	Stops      []StopItem      `json:"stops"`
	QuickSlots []QuickSlotItem `json:"quick_slots"`
}

type RuleSet struct {
	OpenMinutesBefore  int `json:"open_minutes_before"`
	CloseMinutesBefore int `json:"close_minutes_before"`
}

type StopItem struct {
	StopID   uuid.UUID `json:"stop_id"`
	Name     string    `json:"name"`
	Sequence int32     `json:"sequence"`
	IsActive bool      `json:"is_active"`
}

type QuickSlotItem struct {
	SlotID        uuid.UUID       `json:"slot_id"`
	DayOfWeek     string          `json:"day_of_week"`
	DepartureTime types.LocalTime `json:"departure_time"`
}

type CreateTripRequest struct {
	RouteID                   uuid.UUID         `json:"route_id"`
	DepartureTime             time.Time         `json:"departure_time"`
	BookingOpenOffsetMinutes  int32             `json:"booking_open_offset_minutes"`
	BookingCloseOffsetMinutes int32             `json:"booking_close_offset_minutes"`
	TotalCapacity             int               `json:"total_capacity"`
	BasePrice                 float64           `json:"base_price"`
	BusType                   string            `json:"bus_type"`
	Direction                 string            `json:"direction"`
	Stops                     []TripStopRequest `json:"stops"`
}

type TripStopRequest struct {
	StopID uuid.UUID `json:"stop_id"`
}

type UpdateTripRequest struct {
	DepartureTime   time.Time `json:"departure_time"`
	BookingOpensAt  string    `json:"booking_opens_at"`
	BookingClosesAt string    `json:"booking_closes_at"`
	TotalCapacity   int       `json:"total_capacity"`
	BasePrice       float64   `json:"base_price"`
	BusType         string    `json:"bus_type"`
}

type CreateTripResponse struct {
	TripID uuid.UUID `json:"trip_id"`
}

type TripResponse struct {
	ID        uuid.UUID `json:"id"`
	RouteID   uuid.UUID `json:"route_id"`
	RouteName string    `json:"route_name"`
	Direction string    `json:"direction"`
	BusType   string    `json:"bus_type"`

	DepartureTime   time.Time `json:"departure_time"`
	BookingOpensAt  time.Time `json:"booking_opens_at"`
	BookingClosesAt time.Time `json:"booking_closes_at"`

	Status         string  `json:"status"`
	ManualStatus   *string `json:"manual_status,omitempty"`
	AvailableSeats int32   `json:"available_seats"`
	TotalCapacity  int32   `json:"total_capacity"`
	BasePrice      float64 `json:"base_price"`

	Stops []TripStopItem `json:"stops"`
}

type TripStopItem struct {
	StopID   uuid.UUID `json:"stop_id"`
	StopName string    `json:"stop_name"`
	Sequence int32     `json:"sequence"`
}

type AdminTicketItem struct {
	TicketID          uuid.UUID `json:"ticket_id"`
	SerialNo          int32     `json:"serial_no"`
	TicketCode        string    `json:"ticket_code"`
	PassengerName     string    `json:"passenger_name"`
	PassengerRelation string    `json:"passenger_relation"`
	Status            string    `json:"status"`
	BookingTime       time.Time `json:"booking_time"`
	StatusUpdatedAt   time.Time `json:"status_updated_at,omitempty"`
	UserName          string    `json:"user_name"`
	UserEmail         string    `json:"user_email"`
	TripID            uuid.UUID `json:"trip_id"`
	DepartureTime     time.Time `json:"departure_time"`
	BusType           string    `json:"bus_type"`
	Direction         string    `json:"direction"`
	RouteName         string    `json:"route_name"`
	PickupLocation    string    `json:"pickup_location"`
	DropoffLocation   string    `json:"dropoff_location"`
	Price             int32     `json:"price"`
}

type AdminTicketPaginationResponse struct {
	Data       []AdminTicketItem `json:"data"`
	TotalCount int64             `json:"total_count"`
	Page       int               `json:"page"`
	PageSize   int               `json:"page_size"`
	Stats      *WeeklyStats      `json:"stats,omitempty"`
}

type WeeklyStats struct {
	StudentCount   int64 `json:"student_count"`
	EmployeeCount  int64 `json:"employee_count"`
	TotalConfirmed int64 `json:"total_confirmed"`
}

// --- Requests ---

// Legacy single hold (kept for backward compatibility)
type HoldTicketRequest struct {
	TripID        uuid.UUID `json:"trip_id"`
	PickupStopID  uuid.UUID `json:"pickup_stop_id"`
	DropoffStopID uuid.UUID `json:"dropoff_stop_id"`
}

// Batch hold request (new flow)
type HoldSeatsRequest struct {
	TripID        uuid.UUID `json:"trip_id"`
	Count         int       `json:"count"` // Number of seats to hold
	PickupStopID  uuid.UUID `json:"pickup_stop_id"`
	DropoffStopID uuid.UUID `json:"dropoff_stop_id"`
}

// Batch confirm request
type ConfirmBatchRequest struct {
	Confirmations []ConfirmItem `json:"confirmations"`
}

// Individual confirmation item with passenger details
type ConfirmItem struct {
	HoldID            uuid.UUID `json:"hold_id"`
	PassengerName     string    `json:"passenger_name"`
	PassengerRelation string    `json:"passenger_relation"` // SELF, SPOUSE, CHILD
}

// --- Responses ---

type HoldTicketResponse struct {
	HoldID    uuid.UUID `json:"hold_id"` // Frontend stores this to Confirm later
	ExpiresAt time.Time `json:"expires_at"`
}

// Batch hold response
type HoldSeatsResponse struct {
	Holds []HoldTicketResponse `json:"holds"`
}

type BookTicketResponse struct {
	TicketID uuid.UUID `json:"ticket_id"`
	Status   string    `json:"status"`
}

// Batch confirm response
type ConfirmBatchResponse struct {
	Tickets []BookTicketResponse `json:"tickets"`
}

type QuotaResponse struct {
	Outbound QuotaUsage `json:"outbound"`
	Inbound  QuotaUsage `json:"inbound"`
}

type QuotaUsage struct {
	Limit     int `json:"limit"`
	Used      int `json:"used"`
	Remaining int `json:"remaining"`
}

type QuotaOverrideRequest struct {
	UserIDs       []uuid.UUID `json:"user_ids"`
	Direction     string      `json:"direction"`
	WeekStart     string      `json:"week_start"`
	ExpiresAt     time.Time   `json:"expires_at"`
	ExtraBookings int         `json:"extra_bookings"`
	Reason        string      `json:"reason"`
}

type QuotaOverrideResponse struct {
	AffectedUsers int    `json:"affected_users"`
	Direction     string `json:"direction"`
	WeekStart     string `json:"week_start"`
	ExpiresAt     string `json:"expires_at"`
}

type ActiveHoldResponse struct {
	ID        uuid.UUID `json:"id"`
	TripID    uuid.UUID `json:"trip_id"`
	ExpiresAt time.Time `json:"expires_at"`
	Direction string    `json:"direction"`
	RouteName string    `json:"route_name"`
}

type MyTicketResponse struct {
	TicketID   uuid.UUID `json:"ticket_id"`
	TicketCode string    `json:"ticket_code"`
	SerialNo   int32     `json:"serial_no"`
	Status     string    `json:"status"`

	PassengerName     string `json:"passenger_name"`
	PassengerRelation string `json:"passenger_relation"`
	IsSelf            bool   `json:"is_self"`

	RouteName string `json:"route_name"`
	Direction string `json:"direction"`

	RelevantLocation string `json:"relevant_location"`

	PickupLocation  string `json:"pickup_location"`
	DropoffLocation string `json:"dropoff_location"`

	DepartureTime time.Time `json:"departure_time"`
	BusType       string    `json:"bus_type"`
	Price         float64   `json:"price"`
	IsCancellable bool      `json:"is_cancellable"`
}

func mapDBTicketsToResponse(rows []transport_db.GetUserTicketsByIDRow) []MyTicketResponse {
	tickets := make([]MyTicketResponse, 0, len(rows))

	for _, row := range rows {

		tickets = append(tickets, MyTicketResponse{
			TicketID:   row.TicketID,
			TicketCode: row.TicketCode,
			SerialNo:   row.SerialNo,
			Status:     row.TicketStatus,

			PassengerName:     row.PassengerName,
			PassengerRelation: row.PassengerRelation,
			IsSelf:            row.PassengerRelation == "SELF",

			RouteName: row.RouteName,
			Direction: row.Direction,

			RelevantLocation: row.RelevantLocation,

			PickupLocation:  row.PickupLocation,
			DropoffLocation: row.DropoffLocation,

			DepartureTime: row.DepartureTime,
			BusType:       row.BusType,
			Price:         common.LowestUnitToAmount(row.BasePrice),
			IsCancellable: row.IsCancellable,
		})
	}

	return tickets
}

func mapDbTripsForWeekToResponse(rows []transport_db.GetTripsForWeekWithStopsRow) []TripResponse {

	dtos := make([]TripResponse, 0, len(rows))

	for _, row := range rows {

		var stops []TripStopItem
		if err := json.Unmarshal([]byte(row.StopsJson), &stops); err != nil {
			stops = []TripStopItem{}
		}

		dtos = append(dtos, TripResponse{
			ID:        row.TripID,
			RouteID:   row.RouteID,
			RouteName: row.RouteName,
			Direction: row.Direction,
			BusType:   row.BusType,

			DepartureTime:   row.DepartureTime,
			BookingOpensAt:  row.BookingOpensAt,
			BookingClosesAt: row.BookingClosesAt,

			Status:         row.Status,
			ManualStatus:   common.TextToStringPointer(row.ManualStatus),
			AvailableSeats: row.AvailableSeats,
			TotalCapacity:  row.TotalCapacity,
			BasePrice:      common.LowestUnitToAmount(row.BasePrice),

			Stops: stops,
		})
	}
	return dtos
}

func mapDBRouteTemplateToRouteTemplate(rows []transport_db.GetRouteStopsDetailsRow, weeklyScheduleRows []transport_db.GikiTransportRouteWeeklySchedule) *RouteTemplateResponse {
	if len(rows) == 0 {
		return nil
	}

	firstRow := rows[0]

	response := &RouteTemplateResponse{
		RouteID:   firstRow.RouteID,
		RouteName: firstRow.RouteName,
		Rules: RuleSet{
			OpenMinutesBefore:  common.Int4ToInt(firstRow.DefaultBookingOpenOffsetMinutes),
			CloseMinutesBefore: common.Int4ToInt(firstRow.DefaultBookingCloseOffsetMinutes),
		},
		Stops:      make([]StopItem, 0, len(rows)),
		QuickSlots: make([]QuickSlotItem, 0, len(rows)),
	}

	for _, row := range rows {
		stop := StopItem{
			StopID:   row.StopID,
			Name:     row.StopName,
			Sequence: row.DefaultSequenceOrder,
			IsActive: row.IsDefaultActive,
		}
		response.Stops = append(response.Stops, stop)
	}

	for _, row := range weeklyScheduleRows {
		slot := QuickSlotItem{
			SlotID:        row.ID,
			DayOfWeek:     GetDayLabel(row.DayOfWeek),
			DepartureTime: types.LocalTime{Time: row.DepartureTime},
		}
		response.QuickSlots = append(response.QuickSlots, slot)
	}

	return response
}

func mapAdminTicketsToItem(rows []transport_db.GetTicketsForAdminRow) []AdminTicketItem {
	if rows == nil {
		return []AdminTicketItem{}
	}
	items := make([]AdminTicketItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, AdminTicketItem{
			TicketID:          row.TicketID,
			SerialNo:          row.SerialNo,
			TicketCode:        row.TicketCode,
			PassengerName:     row.PassengerName,
			PassengerRelation: row.PassengerRelation,
			Status:            row.TicketStatus,
			BookingTime:       row.BookingTime,
			UserName:          row.UserName,
			UserEmail:         row.UserEmail,
			TripID:            row.TripID,
			DepartureTime:     row.DepartureTime,
			BusType:           row.BusType,
			Direction:         row.Direction,
			RouteName:         row.RouteName,
			PickupLocation:    row.PickupLocation,
			DropoffLocation:   row.DropoffLocation,
			Price:             row.Price,
		})
	}
	return items
}

func mapDBRouteToRoute(row transport_db.GetAllRoutesRow) Route {
	return Route{
		RouteID:   row.ID,
		RouteName: row.Name,
	}
}

func GetDayLabel(dayOfWeek int32) string {
	days := []string{"", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
	if dayOfWeek >= 1 && dayOfWeek <= 7 {
		return days[dayOfWeek]
	}
	return "Unknown Day"
}
