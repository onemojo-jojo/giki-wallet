import { useState, useMemo, useEffect } from 'react';
import { Bus, MapPin, Users, Lock, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTime12, formatDate, getCityName } from '../utils';
import type { Trip } from '../validators';

interface RouteCardProps {
    routeName: string;
    routeId: string;
    direction: 'OUTBOUND' | 'INBOUND';
    trips: Trip[];
    activeHolds: any[];
    isStudent: boolean;
    quota: { limit: number; used: number; remaining: number } | null;
    isRoundTrip?: boolean;
    onBook: (tripId: string, stopId: string, ticketCount: number) => void;
    /** If true, card starts expanded (e.g. when only 1 route exists) */
    defaultExpanded?: boolean;
}

export const RouteCard = ({
    routeName,
    routeId,
    direction,
    trips,
    activeHolds,
    isStudent,
    quota,
    isRoundTrip = false,
    onBook,
    defaultExpanded = false,
}: RouteCardProps) => {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
    const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
    const [ticketCount, setTicketCount] = useState(1);
    const [currentTime, setCurrentTime] = useState(Date.now());

    // Update current time every minute for live countdown
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(Date.now());
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    // Helper to format time remaining
    const getTimeRemaining = (opensAt: string) => {
        const now = currentTime;
        const openTime = new Date(opensAt).getTime();
        const diff = openTime - now;

        if (diff <= 60000) return 'Opening soon...';

        const totalMinutes = Math.floor(diff / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        const remainingMinutes = totalMinutes % 60;

        if (days > 0) return `Opens in ${days}d ${remainingHours}h`;
        if (hours > 0) return `Opens in ${hours}h ${remainingMinutes}m`;
        if (totalMinutes > 0) return `Opens in ${totalMinutes}m`;

        return 'Opening soon...';
    };

    // Get selected trip
    const selectedTrip = trips.find(t => t.id === selectedTripId);

    // Get stops for selected trip
    const stopOptions = useMemo(() => {
        if (!selectedTrip) return [];

        return selectedTrip.stops
            .filter((s) => !s.stop_name.includes('GIKI'))
            .map((s) => ({
                value: s.stop_id,
                label: s.stop_name
            }));
    }, [selectedTrip]);

    // Auto-select stop if only one option
    useMemo(() => {
        if (stopOptions.length === 1 && !selectedStopId) {
            setSelectedStopId(stopOptions[0].value);
        }
    }, [stopOptions, selectedStopId]);

    // Check if trip is held
    const isHeld = selectedTrip ? activeHolds.some(h => h.trip_id === selectedTrip.id) : false;

    // Check if trip is full, scheduled, or closed
    const isFull = selectedTrip ? (selectedTrip.available_seats <= 0 || selectedTrip.status === 'FULL') : false;
    const isScheduled = selectedTrip?.status === 'SCHEDULED';
    const isClosed = selectedTrip?.status === 'CLOSED';

    // Calculate max tickets
    const quotaRemaining = quota?.remaining ?? 3;
    const maxTickets = Math.min(
        3,
        selectedTrip?.available_seats || 0,
        quotaRemaining
    );

    const handleBook = () => {
        if (!selectedTripId || !selectedStopId) return;
        onBook(selectedTripId, selectedStopId, ticketCount);
    };

    const canBook = selectedTripId && selectedStopId && !isFull && !isScheduled && !isClosed;

    // Collapsed summary info
    const summaryInfo = useMemo(() => {
        const openTrips = trips.filter(t => t.status === 'OPEN');
        const totalSeats = openTrips.reduce((sum, t) => sum + t.available_seats, 0);
        const allFull = trips.every(t => t.available_seats <= 0 || t.status === 'FULL');
        const allScheduled = trips.every(t => t.status === 'SCHEDULED');
        return { openTrips: openTrips.length, totalSeats, allFull, allScheduled, totalTrips: trips.length };
    }, [trips]);

    // Shortened city name
    const cityName = getCityName(routeName);

    const busType = (trips[0]?.bus_type || 'STUDENT').toUpperCase();

    return (
        <div
            className={cn(
                'bg-card rounded-[22px] transition-shadow overflow-hidden',
                expanded ? (selectedTripId ? 'ring-2 ring-iris shadow-md' : 'shadow-sm') : 'hover:shadow-sm'
            )}
        >
            {/* Header — always visible */}
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
                className="w-full p-4 flex items-center justify-between gap-3 text-left rounded-[22px] focus-visible:outline-2 focus-visible:outline-iris"
            >
                <span className="flex items-center gap-3 min-w-0">
                    <span className={cn('size-11 rounded-[14px] flex items-center justify-center shrink-0', expanded ? 'bg-iris text-white' : 'bg-iris-tint text-iris-strong')}>
                        <Bus className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex flex-col gap-0.5">
                        <span className="font-display font-extrabold text-lg text-ink leading-tight break-words">{cityName}</span>
                        {!expanded && (
                            <span className="text-xs font-semibold">
                                {summaryInfo.allFull ? (
                                    <span className="text-coral">All trips full</span>
                                ) : summaryInfo.allScheduled ? (
                                    <span className="text-signal-text">Not open yet</span>
                                ) : (
                                    <span className="text-muted-foreground">
                                        {summaryInfo.totalTrips} trip{summaryInfo.totalTrips !== 1 ? 's' : ''} · {summaryInfo.totalSeats} seats
                                    </span>
                                )}
                            </span>
                        )}
                    </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                    {!expanded && (
                        <span className={cn('px-2.5 py-0.5 text-[11px] rounded-full font-extrabold uppercase', busType === 'EMPLOYEE' ? 'bg-ink text-white' : 'bg-iris-tint text-iris-strong')}>
                            {busType}
                        </span>
                    )}
                    {isHeld && <span className="px-2.5 py-0.5 bg-mint-tint text-mint text-[11px] font-extrabold rounded-full">Reserved</span>}
                    <ChevronDown className={cn('size-5 text-light-gray transition-transform duration-300', expanded && 'rotate-180')} aria-hidden="true" />
                </span>
            </button>

            {/* Expandable content */}
            <div className={cn('transition-all duration-300 ease-in-out overflow-hidden', expanded ? 'max-h-[1400px] opacity-100' : 'max-h-0 opacity-0')}>
                <div className="px-4 pb-4 flex flex-col gap-4">
                    <fieldset className="flex flex-col gap-2">
                        <legend className="text-xs font-extrabold text-muted-foreground uppercase tracking-[0.06em] mb-2">Select trip</legend>
                        {trips.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground text-sm">No trips available</div>
                        ) : (
                            trips.map((trip) => {
                                const tripFull = trip.available_seats <= 0 || trip.status === 'FULL';
                                const tripScheduled = trip.status === 'SCHEDULED';
                                const tripCancelled = trip.status === 'CANCELLED';
                                const tripClosed = trip.status === 'CLOSED';
                                const isDisabled = tripFull || tripScheduled || tripCancelled || tripClosed;
                                const selected = selectedTripId === trip.id;
                                const lowSeats = !isDisabled && trip.available_seats <= 5;
                                const [time, ampm] = formatTime12(trip.departure_time).split(' ');

                                return (
                                    <label
                                        key={trip.id}
                                        className={cn(
                                            'flex items-center gap-3 p-3 rounded-2xl transition-colors',
                                            selected ? 'bg-[#F6F4FF] ring-2 ring-iris' : 'bg-background',
                                            isDisabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-secondary/60',
                                            tripScheduled && !selected && 'bg-signal-tint/60',
                                            tripCancelled && 'bg-coral-tint'
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name={`trip-${routeId}`}
                                            value={trip.id}
                                            checked={selected}
                                            onChange={() => {
                                                if (!isDisabled) {
                                                    setSelectedTripId(trip.id);
                                                    setSelectedStopId(null);
                                                    setTicketCount(1);
                                                }
                                            }}
                                            disabled={isDisabled}
                                            className="size-5 accent-iris shrink-0"
                                        />
                                        <span className="flex flex-col w-16 shrink-0">
                                            <span className={cn('font-display text-xl font-extrabold leading-none tracking-tight', isDisabled ? 'text-muted-foreground' : 'text-ink')}>{time}</span>
                                            <span className="text-[11px] font-extrabold text-muted-foreground">{ampm}</span>
                                        </span>
                                        <span className="flex-1 min-w-0 text-xs font-semibold text-muted-foreground">{formatDate(trip.departure_time)}</span>
                                        <span className="flex flex-col items-end gap-0.5 shrink-0 text-right">
                                            {tripCancelled ? (
                                                <span className="text-xs text-coral font-extrabold uppercase">Cancelled</span>
                                            ) : tripClosed ? (
                                                <span className="text-xs text-muted-foreground font-extrabold uppercase">Closed</span>
                                            ) : tripScheduled ? (
                                                <>
                                                    <span className="flex items-center gap-1 text-[11px] font-extrabold uppercase text-signal-text">
                                                        <Lock className="size-3" aria-hidden="true" />
                                                        Locked
                                                    </span>
                                                    <span className="text-[11px] font-bold text-signal-text whitespace-nowrap">{getTimeRemaining(trip.booking_opens_at)}</span>
                                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">@ {formatTime12(trip.booking_opens_at)}</span>
                                                </>
                                            ) : tripFull ? (
                                                <span className="text-xs text-coral font-extrabold uppercase">Full</span>
                                            ) : (
                                                <span className="flex items-center gap-1.5">
                                                    <Users className={cn('size-3.5', lowSeats ? 'text-[#B35F00]' : 'text-mint')} aria-hidden="true" />
                                                    <span className={cn('font-extrabold text-sm', lowSeats ? 'text-[#B35F00]' : 'text-ink')}>{trip.available_seats}</span>
                                                    <span className="text-xs text-muted-foreground font-semibold">/ {trip.total_capacity}</span>
                                                </span>
                                            )}
                                        </span>
                                    </label>
                                );
                            })
                        )}
                    </fieldset>

                    {/* Stop selection */}
                    {selectedTripId && stopOptions.length > 0 && (
                        <div role="group" aria-label={direction === 'OUTBOUND' ? 'Drop-off location' : 'Pickup location'}>
                            <div className="flex items-center gap-1.5 text-xs font-extrabold text-muted-foreground uppercase tracking-[0.06em] mb-2">
                                <MapPin className="size-3.5" aria-hidden="true" />
                                {direction === 'OUTBOUND' ? 'Drop-off location' : 'Pickup location'}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {stopOptions.map((stop) => (
                                    <button
                                        key={stop.value}
                                        type="button"
                                        aria-pressed={selectedStopId === stop.value}
                                        onClick={() => setSelectedStopId(stop.value)}
                                        className={cn(
                                            'h-10 px-3.5 rounded-xl text-sm transition-colors focus-visible:outline-2 focus-visible:outline-iris',
                                            selectedStopId === stop.value
                                                ? 'bg-iris text-white font-extrabold'
                                                : 'bg-background border-[1.5px] border-input text-ink font-semibold hover:bg-secondary'
                                        )}
                                    >
                                        {stop.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Ticket count (employees) */}
                    {selectedTripId && selectedStopId && !isStudent && (
                        <div>
                            <span id={`tickets-${routeId}`} className="text-xs font-extrabold text-muted-foreground uppercase tracking-[0.06em] block mb-2">
                                Number of tickets
                            </span>
                            <div className="flex items-center gap-3" role="group" aria-labelledby={`tickets-${routeId}`}>
                                <button
                                    type="button"
                                    onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}
                                    disabled={ticketCount <= 1}
                                    aria-label="One fewer ticket"
                                    className="size-11 rounded-xl bg-secondary text-ink font-extrabold text-xl disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-iris"
                                >
                                    −
                                </button>
                                <span className="font-display text-2xl font-extrabold text-ink min-w-[2ch] text-center" aria-live="polite">
                                    {ticketCount}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setTicketCount(Math.min(maxTickets, ticketCount + 1))}
                                    disabled={ticketCount >= maxTickets}
                                    aria-label="One more ticket"
                                    className="size-11 rounded-xl bg-secondary text-ink font-extrabold text-xl disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-iris"
                                >
                                    +
                                </button>
                                <span className="text-xs font-semibold text-muted-foreground ml-1">Max: {maxTickets}</span>
                            </div>
                        </div>
                    )}

                    <button
                        type="button"
                        disabled={!canBook}
                        onClick={handleBook}
                        className="min-h-[52px] rounded-2xl bg-ink text-white text-base font-extrabold disabled:bg-secondary disabled:text-[#6E6B88] disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                    >
                        {isHeld ? 'Reserved' : isClosed ? 'Closed' : isFull ? 'Fully Booked' : isScheduled ? 'Not Open Yet' : isRoundTrip ? 'Select Trip' : 'Book Now →'}
                    </button>
                </div>
            </div>
        </div>
    );
};
