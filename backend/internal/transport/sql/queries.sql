-- =============================================
-- 1. ROUTE & TRIP MANAGEMENT (Admin/System)
-- =============================================

-- name: GetAllRoutes :many
SELECT id, name FROM giki_transport.routes
WHERE is_active = TRUE
ORDER BY name ASC;

-- name: GetRouteStopsDetails :many
SELECT

    r.id as route_id, r.name as route_name,
    r.default_booking_open_offset_minutes,
    r.default_booking_close_offset_minutes,

    s.id as stop_id, s.address as stop_name,

    rms.default_sequence_order,
    rms.is_default_active

FROM giki_transport.routes as r
JOIN giki_transport.route_master_stops as rms ON r.id = rms.route_id
JOIN giki_transport.stops as s ON rms.stop_id = s.id
WHERE r.id = $1
ORDER BY rms.default_sequence_order ASC;

-- name: GetRouteWeeklySchedule :many

SELECT id, route_id, day_of_week, departure_time, created_at
FROM giki_transport.route_weekly_schedules
WHERE route_id = $1
ORDER BY day_of_week ASC, departure_time ASC;

-- name: CreateTrip :one
INSERT INTO giki_transport.trip(
    route_id,
    departure_time,
    booking_open_offset_minutes,
    booking_close_offset_minutes,
    total_capacity,
    available_seats,
    base_price,
    direction,
    bus_type
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id;

-- name: CreateTripStop :exec
INSERT INTO giki_transport.trip_stops (trip_id, stop_id, sequence_order)
VALUES ($1, $2, $3);

-- name: GetTripsForWeekWithStops :many

SELECT
    t.id as trip_id,
    r.id as route_id,
    r.name as route_name,
    t.direction,
    t.bus_type,
    t.departure_time,
    (t.departure_time - (t.booking_open_offset_minutes * INTERVAL '1 minute'))::TIMESTAMPTZ as booking_opens_at,
    (t.departure_time - (t.booking_close_offset_minutes * INTERVAL '1 minute'))::TIMESTAMPTZ as booking_closes_at,
    
    -- Dynamic Status Calculation
    CASE
        WHEN t.manual_status = 'CANCELLED' THEN 'CANCELLED'
        WHEN t.available_seats <= 0 THEN 'FULL'
        WHEN t.manual_status = 'CLOSED' THEN 'CLOSED'
        WHEN t.manual_status = 'OPEN' THEN 'OPEN'
        WHEN NOW() >= (t.departure_time - (t.booking_close_offset_minutes * INTERVAL '1 minute')) THEN 'CLOSED'
        WHEN NOW() < (t.departure_time - (t.booking_open_offset_minutes * INTERVAL '1 minute')) THEN 'SCHEDULED'
        ELSE 'OPEN'
    END as status,
    
    t.manual_status,
    t.available_seats,
    t.total_capacity,
    t.base_price,
    (
        SELECT COALESCE(JSON_AGG(
            JSON_BUILD_OBJECT(
                'stop_id', s.id,
                'stop_name', s.address,
                'sequence', ts.sequence_order
            ) ORDER BY ts.sequence_order ASC
        ), '[]')::text
        FROM giki_transport.trip_stops ts
        JOIN giki_transport.stops s ON ts.stop_id = s.id
        WHERE ts.trip_id = t.id
    ) as stops_json
FROM giki_transport.trip t
JOIN giki_transport.routes r ON t.route_id = r.id
WHERE
    t.departure_time >= $1
    AND t.departure_time < $2
    AND t.status IS DISTINCT FROM 'DELETED'
ORDER BY t.departure_time ASC;




-- name: UpdateTrip :exec
UPDATE giki_transport.trip
SET
    departure_time = $2,
    booking_open_offset_minutes = $3,
    booking_close_offset_minutes = $4,
    total_capacity = $5,
    -- Adjust available seats by the difference in capacity (if any), ensuring it doesn't go below 0
    available_seats = GREATEST(0, available_seats + ($5 - total_capacity)),
    base_price = $6,
    bus_type = $7,
    updated_at = NOW()
WHERE id = $1;

-- name: DeleteTrip :exec
DELETE FROM giki_transport.trip
WHERE id = $1;


-- name: GetTrip :one
SELECT
    t.*,
    CASE
        WHEN t.manual_status = 'CANCELLED' THEN 'CANCELLED'
        WHEN t.available_seats <= 0 THEN 'FULL'
        WHEN t.manual_status = 'CLOSED' THEN 'CLOSED'
        WHEN t.manual_status = 'OPEN' THEN 'OPEN'
        WHEN NOW() >= (t.departure_time - (t.booking_close_offset_minutes * INTERVAL '1 minute')) THEN 'CLOSED'
        WHEN NOW() < (t.departure_time - (t.booking_open_offset_minutes * INTERVAL '1 minute')) THEN 'SCHEDULED'
        ELSE 'OPEN'
    END::TEXT as computed_status
FROM giki_transport.trip t
WHERE id = $1;

-- name: GetTripPrice :one
SELECT base_price FROM giki_transport.trip WHERE id = $1;

-- name: GetTripForUpdate :one
SELECT id FROM giki_transport.trip WHERE id = $1 FOR UPDATE;


-- =============================================
-- 2. QUOTA & RULES (Smart Logic)
-- =============================================

-- name: GetQuotaRule :one
SELECT weekly_limit, allow_dependent_booking
FROM giki_transport.quota_rules
WHERE user_role = $1 AND direction = $2;



-- name: GetWeeklyTicketCountByDirection :one
-- Counts CONFIRMED tickets + ACTIVE HOLDS for the current calendar week (Mon-Sun) for a specific direction.
SELECT COUNT(*) FROM (
       -- Part 1: Confirmed Tickets (trips departing this calendar week)
       SELECT t.id
       FROM giki_transport.tickets t
                JOIN giki_transport.trip tr ON t.trip_id = tr.id
       WHERE t.user_id = sqlc.arg(user_id)
         AND t.status = 'CONFIRMED'
         AND tr.departure_time >= date_trunc('week', NOW())
         AND tr.departure_time <  date_trunc('week', NOW()) + INTERVAL '7 days'
         AND tr.direction = sqlc.arg(direction)

       UNION ALL

       -- Part 2: Active Holds (for trips departing this calendar week)
       SELECT h.id
       FROM giki_transport.trip_holds h
                JOIN giki_transport.trip tr ON h.trip_id = tr.id
       WHERE h.user_id = sqlc.arg(user_id)
         AND tr.direction = sqlc.arg(direction)
         AND h.expires_at > NOW()
         AND tr.departure_time >= date_trunc('week', NOW())
         AND tr.departure_time <  date_trunc('week', NOW()) + INTERVAL '7 days'
) as total_count;


-- =============================================
-- 3. HOLD SYSTEM (Locking Seats)
-- =============================================

-- name: DecreaseTripSeat :one

UPDATE giki_transport.trip
SET available_seats = available_seats - 1
WHERE id = $1 AND available_seats > 0
RETURNING available_seats;

-- name: CreateBlankHold :one

INSERT INTO giki_transport.trip_holds (
    trip_id, user_id, pickup_stop_id, dropoff_stop_id, expires_at
) VALUES ($1, $2, $3, $4, $5)
RETURNING id, expires_at;

-- name: GetHold :one
SELECT * FROM giki_transport.trip_holds WHERE id = $1;

-- name: DeleteHold :exec
DELETE FROM giki_transport.trip_holds WHERE id = $1;


-- =============================================
-- 4. TICKET CONFIRMATION (Finalizing)
-- =============================================

-- name: ConfirmBookingWithDetails :one

INSERT INTO giki_transport.tickets (
    trip_id, user_id, serial_no, ticket_code, pickup_stop_id, dropoff_stop_id,
    status, passenger_name, passenger_relation, price_paid
)
VALUES ($1, $2, COALESCE((SELECT MAX(serial_no) FROM giki_transport.tickets WHERE trip_id = $1), 0) + 1, $3, $4, $5, 'CONFIRMED', $6, $7, $8)
RETURNING id, serial_no, price_paid;


-- =============================================
-- 5. CANCELLATION & REAPER (Cleanup)
-- =============================================

-- name: IncrementTripSeat :exec

UPDATE giki_transport.trip
SET available_seats = available_seats + 1
WHERE id = $1 AND available_seats < total_capacity;

-- name: GetExpiredHolds :many

SELECT id, trip_id FROM giki_transport.trip_holds
WHERE expires_at < NOW()
FOR UPDATE SKIP LOCKED LIMIT 50;

-- name: GetHoldForUpdate :one
SELECT * FROM giki_transport.trip_holds WHERE id = $1 FOR UPDATE;

-- name: GetRouteDetailsForTrip :one
SELECT r.name as route_name, tr.direction
FROM giki_transport.trip tr
JOIN giki_transport.routes r ON tr.route_id = r.id
WHERE tr.id = $1;

-- name: GetTicketForCancellation :one
SELECT
    t.id, t.trip_id, t.user_id, t.status, t.price_paid as base_price
FROM giki_transport.tickets t
         JOIN giki_transport.trip tr ON t.trip_id = tr.id
WHERE t.id = $1
  AND t.status = 'CONFIRMED'
  -- LOGIC: Allow cancel ONLY IF Current Time < (Departure - Close Offset)
  AND NOW() < (tr.departure_time - (tr.booking_close_offset_minutes * INTERVAL '1 minute'));

-- name: SetTicketCancelled :exec
UPDATE giki_transport.tickets
SET status = 'CANCELLED'
WHERE id = $1 AND status = 'CONFIRMED';

-- name: GetActiveHoldsByUserID :many
SELECT h.id, h.trip_id, h.expires_at, tr.direction, r.name as route_name
FROM giki_transport.trip_holds h
JOIN giki_transport.trip tr ON h.trip_id = tr.id
JOIN giki_transport.routes r ON tr.route_id = r.id
WHERE h.user_id = $1 AND h.expires_at > NOW();

-- name: DeleteAllActiveHoldsByUserID :many
DELETE FROM giki_transport.trip_holds
WHERE user_id = $1 AND expires_at > NOW()
RETURNING trip_id;


-- name: GetUserTicketsByID :many
SELECT
    t.id AS ticket_id,
    t.status AS ticket_status,
    t.passenger_name,
    t.passenger_relation,
    t.serial_no,
    t.ticket_code,
    t.booking_time,

    tr.id AS trip_id,
    tr.departure_time,
    tr.bus_type,
    t.price_paid as base_price,
    tr.direction,

    r.name AS route_name,

    (CASE
        WHEN tr.direction = 'INBOUND' THEN sp.address
        ELSE sd.address
    END)::text AS relevant_location,

    sp.address AS pickup_location,
    sd.address AS dropoff_location,

    (
        t.status = 'CONFIRMED' AND
        tr.status != 'CANCELLED' AND
        NOW() < (tr.departure_time - (tr.booking_close_offset_minutes * INTERVAL '1 minute'))
        )::BOOLEAN AS is_cancellable

FROM giki_transport.tickets t
JOIN giki_transport.trip tr ON t.trip_id = tr.id
JOIN giki_transport.routes r ON tr.route_id = r.id
JOIN giki_transport.stops sp ON t.pickup_stop_id = sp.id
JOIN giki_transport.stops sd ON t.dropoff_stop_id = sd.id
WHERE t.user_id = $1
AND tr.departure_time > (NOW() - INTERVAL '3 hours')
ORDER BY tr.departure_time DESC;


-- name: GetTripsForExport :many
SELECT
    t.id as trip_id,
    r.name as route_name,
    t.departure_time,
    t.bus_type,
    t.direction,
    ti.serial_no,
    ti.ticket_code,
    ti.passenger_name,
    u.phone_number as user_phone_number,
    u.email as user_email,
    s.address as stop_name,
    COALESCE(ts.sequence_order, 999) as stop_sequence
FROM giki_transport.trip t
JOIN giki_transport.routes r ON t.route_id = r.id
JOIN giki_transport.tickets ti ON t.id = ti.trip_id AND ti.status = 'CONFIRMED'
JOIN giki_transport.stops s ON ti.pickup_stop_id = s.id
JOIN giki_wallet.users u ON ti.user_id = u.id
LEFT JOIN giki_transport.trip_stops ts ON (t.id = ts.trip_id AND s.id = ts.stop_id)
WHERE t.id = ANY($1::uuid[])
ORDER BY t.id, COALESCE(ts.sequence_order, 999), ti.serial_no;

-- name: GetTripInfoForExport :many
SELECT
    t.id as trip_id,
    r.name as route_name,
    t.departure_time,
    t.bus_type,
    t.direction
FROM giki_transport.trip t
JOIN giki_transport.routes r ON t.route_id = r.id
WHERE t.id = ANY($1::uuid[])
ORDER BY t.departure_time;


-- name: GetTicketsForAdmin :many
-- Admin query: Get confirmed tickets for a specific week and specific trip filters
SELECT
    t.id as ticket_id,
    t.serial_no,
    t.ticket_code,
    t.passenger_name,
    t.passenger_relation,
    t.status as ticket_status,
    t.booking_time,
    u.name as user_name,
    u.email as user_email,
    tr.id as trip_id,
    tr.departure_time,
    tr.bus_type,
    tr.direction,
    r.name as route_name,
    s_pickup.address as pickup_location,
    s_dropoff.address as dropoff_location,
    t.price_paid as price,
    COUNT(*) OVER() as total_count
FROM giki_transport.tickets t
JOIN giki_transport.trip tr ON t.trip_id = tr.id
JOIN giki_transport.routes r ON tr.route_id = r.id
JOIN giki_wallet.users u ON t.user_id = u.id
JOIN giki_transport.stops s_pickup ON t.pickup_stop_id = s_pickup.id
JOIN giki_transport.stops s_dropoff ON t.dropoff_stop_id = s_dropoff.id
WHERE
    tr.departure_time >= sqlc.arg('start_date')
    AND tr.departure_time < sqlc.arg('end_date')
    AND (sqlc.arg('bus_type')::text = '' OR UPPER(tr.bus_type) = UPPER(sqlc.arg('bus_type')::text))
    AND (sqlc.arg('status')::text = '' OR t.status = sqlc.arg('status')::text)
    AND (
        sqlc.arg('search')::text = '' OR
        t.ticket_code ILIKE '%' || sqlc.arg('search')::text || '%' OR
        t.passenger_name ILIKE '%' || sqlc.arg('search')::text || '%' OR
        u.name ILIKE '%' || sqlc.arg('search')::text || '%' OR
        u.email ILIKE '%' || sqlc.arg('search')::text || '%'
    )
ORDER BY tr.departure_time ASC, t.serial_no ASC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: GetTicketHistoryForAdmin :many
SELECT
    t.id as ticket_id,
    t.serial_no,
    t.ticket_code,
    t.passenger_name,
    t.passenger_relation,
    t.status as ticket_status,
    t.booking_time,
    t.updated_at as status_updated_at,
    u.name as user_name,
    u.email as user_email,
    tr.id as trip_id,
    tr.departure_time,
    tr.bus_type,
    tr.direction,
    r.name as route_name,
    s_pickup.address as pickup_location,
    s_dropoff.address as dropoff_location,
    t.price_paid as price,
    COUNT(*) OVER() as total_count
FROM giki_transport.tickets t
JOIN giki_transport.trip tr ON t.trip_id = tr.id
JOIN giki_transport.routes r ON tr.route_id = r.id
JOIN giki_wallet.users u ON t.user_id = u.id
JOIN giki_transport.stops s_pickup ON t.pickup_stop_id = s_pickup.id
JOIN giki_transport.stops s_dropoff ON t.dropoff_stop_id = s_dropoff.id
WHERE
    t.status != 'CONFIRMED'
ORDER BY t.updated_at DESC
LIMIT $1 OFFSET $2;


-- name: GetUserEmailAndName :one
SELECT name, email FROM giki_wallet.users WHERE id = $1;

-- name: UpdateTripManualStatus :exec
UPDATE giki_transport.trip
SET manual_status = $2, updated_at = NOW()
WHERE id = $1;

-- name: BatchUpdateTripManualStatus :exec
UPDATE giki_transport.trip
SET manual_status = $2, updated_at = NOW()
WHERE id = ANY($1::uuid[]);

-- name: GetConfirmedTicketsForTrip :many
SELECT 
    t.id as ticket_id,
    t.user_id,
    t.ticket_code,
    t.passenger_name,
    t.price_paid as base_price,
    r.name as route_name
FROM giki_transport.tickets t
JOIN giki_transport.trip tr ON t.trip_id = tr.id
JOIN giki_transport.routes r ON tr.route_id = r.id
WHERE t.trip_id = $1 AND t.status = 'CONFIRMED';

-- name: GetTripBookingCount :one
SELECT COUNT(*) as booking_count
FROM giki_transport.tickets
WHERE trip_id = $1 AND status = 'CONFIRMED';

-- name: GetWeeklyTicketStats :one
SELECT
    COUNT(CASE WHEN UPPER(tr.bus_type) = 'STUDENT' THEN 1 END) as student_count,
    COUNT(CASE WHEN UPPER(tr.bus_type) = 'EMPLOYEE' THEN 1 END) as employee_count,
    COUNT(*) as total_confirmed
FROM giki_transport.tickets t
JOIN giki_transport.trip tr ON t.trip_id = tr.id
WHERE
    tr.departure_time >= $1
    AND tr.departure_time < $2
    AND t.status = 'CONFIRMED';

-- name: CancelTicketsByTripID :exec
UPDATE giki_transport.tickets
SET status = 'CANCELLED_BY_ADMIN', updated_at = NOW()
WHERE trip_id = $1 AND status = 'CONFIRMED';
