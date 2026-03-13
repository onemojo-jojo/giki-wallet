import { useState, useMemo, useEffect } from 'react';
import { Bus, Clock, MapPin, Users, Lock, ChevronDown } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
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

    return (
        <div className={cn(
            "bg-white border-2 rounded-2xl transition-all duration-300 overflow-hidden",
            expanded
                ? (selectedTripId ? "border-primary shadow-lg" : "border-gray-300 shadow-md")
                : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
        )}>
            {/* Clickable Header — Always Visible */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full p-4 flex items-center justify-between gap-3 text-left"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                        expanded ? "bg-primary/15" : "bg-gray-100"
                    )}>
                        <Bus className={cn("w-5 h-5", expanded ? "text-primary" : "text-gray-500")} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-base text-gray-900 truncate">{cityName}</h3>
                        {!expanded && (
                            <p className="text-xs text-gray-500 mt-0.5">
                                {summaryInfo.allFull
                                    ? <span className="text-red-500 font-semibold">All trips full</span>
                                    : summaryInfo.allScheduled
                                        ? <span className="text-blue-600 font-semibold">Not open yet</span>
                                        : <span>{summaryInfo.totalTrips} trip{summaryInfo.totalTrips !== 1 ? 's' : ''} • {summaryInfo.totalSeats} seats</span>
                                }
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {!expanded && (
                        <span className={cn(
                            "px-2 py-0.5 text-[10px] rounded-full font-semibold uppercase",
                            trips[0]?.bus_type === 'EMPLOYEE'
                                ? "bg-primary/10 text-primary"
                                : "bg-accent/10 text-accent"
                        )}>
                            {trips[0]?.bus_type || 'STUDENT'}
                        </span>
                    )}
                    {isHeld && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">
                            Reserved
                        </span>
                    )}
                    <ChevronDown className={cn(
                        "w-5 h-5 text-gray-400 transition-transform duration-300",
                        expanded && "rotate-180"
                    )} />
                </div>
            </button>

            {/* Expandable Content */}
            <div className={cn(
                "transition-all duration-300 ease-in-out overflow-hidden",
                expanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
            )}>
                <div className="px-4 pb-4 space-y-4">
                    {/* Time Slots */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Select Trip
                        </label>
                        <div className="space-y-2">
                            {trips.length === 0 ? (
                                <div className="text-center py-6 text-gray-400 text-sm">
                                    No trips available
                                </div>
                            ) : (
                                trips.map((trip) => {
                                    const tripFull = trip.available_seats <= 0 || trip.status === 'FULL';
                                    const tripScheduled = trip.status === 'SCHEDULED';
                                    const tripCancelled = trip.status === 'CANCELLED';
                                    const tripClosed = trip.status === 'CLOSED';
                                    const isDisabled = tripFull || tripScheduled || tripCancelled || tripClosed;

                                    return (
                                        <label
                                            key={trip.id}
                                            className={cn(
                                                "flex items-center justify-between gap-2 p-2 sm:p-3 border-2 rounded-xl cursor-pointer transition-all",
                                                selectedTripId === trip.id
                                                    ? "border-primary bg-primary/5"
                                                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                                                isDisabled && "opacity-60 cursor-not-allowed",
                                                tripScheduled && "bg-blue-50/50 border-blue-200",
                                                tripCancelled && "bg-red-50 border-red-200"
                                            )}
                                        >
                                            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
                                                <input
                                                    type="radio"
                                                    name={`trip-${routeId}`}
                                                    value={trip.id}
                                                    checked={selectedTripId === trip.id}
                                                    onChange={() => {
                                                        if (!isDisabled) {
                                                            setSelectedTripId(trip.id);
                                                            setSelectedStopId(null);
                                                            setTicketCount(1);
                                                        }
                                                    }}
                                                    disabled={isDisabled}
                                                    className="w-4 h-4 text-primary"
                                                />
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-4 h-4 text-gray-400" />
                                                        <span className="font-semibold text-sm">
                                                            {formatTime12(trip.departure_time)}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-gray-400 font-medium ml-6">
                                                        {formatDate(trip.departure_time)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 min-w-0 flex-shrink-0">
                                                {tripCancelled ? (
                                                    <span className="text-xs text-red-700 font-bold uppercase whitespace-nowrap">CANCELLED</span>
                                                ) : tripClosed ? (
                                                    <span className="text-xs text-gray-500 font-bold uppercase whitespace-nowrap">CLOSED</span>
                                                ) : tripScheduled ? (
                                                    <>
                                                        <div className="flex items-center gap-1 bg-blue-100 px-1.5 py-0.5 rounded-md">
                                                            <Lock className="w-3 h-3 text-blue-700 flex-shrink-0" />
                                                            <span className="text-[10px] text-blue-700 font-bold uppercase whitespace-nowrap">
                                                                Locked
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-blue-600 font-semibold whitespace-nowrap">
                                                            {getTimeRemaining(trip.booking_opens_at)}
                                                        </span>
                                                        <span className="text-[9px] text-gray-500 whitespace-nowrap">
                                                            @ {formatTime12(trip.booking_opens_at)}
                                                        </span>
                                                    </>
                                                ) : tripFull ? (
                                                    <span className="text-xs text-red-600 font-bold whitespace-nowrap">FULL</span>
                                                ) : (
                                                    <div className="flex items-center gap-1.5">
                                                        <Users className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                                                        <span className="font-bold text-sm text-gray-900">
                                                            {trip.available_seats}
                                                        </span>
                                                        <span className="text-xs text-gray-400 font-medium">
                                                            / {trip.total_capacity}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Stop Selection — Tappable Chips */}
                    {selectedTripId && stopOptions.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                                <MapPin className="w-3 h-3" />
                                {direction === 'OUTBOUND' ? 'Drop-off Location' : 'Pickup Location'}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {stopOptions.map(stop => (
                                    <button
                                        key={stop.value}
                                        onClick={() => setSelectedStopId(stop.value)}
                                        className={cn(
                                            "px-3 py-2 rounded-xl text-sm font-medium transition-all border-2",
                                            selectedStopId === stop.value
                                                ? "border-primary bg-primary/10 text-primary shadow-sm"
                                                : "border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-gray-100"
                                        )}
                                    >
                                        {stop.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Ticket Count (only if stop selected) */}
                    {selectedTripId && selectedStopId && !isStudent && (
                        <div>
                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
                                Number of Tickets
                            </label>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}
                                    disabled={ticketCount <= 1}
                                    className="w-10 h-10 rounded-lg border-2 border-gray-300 hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg"
                                >
                                    −
                                </button>
                                <span className="text-2xl font-bold text-gray-900 min-w-[3ch] text-center">
                                    {ticketCount}
                                </span>
                                <button
                                    onClick={() => setTicketCount(Math.min(maxTickets, ticketCount + 1))}
                                    disabled={ticketCount >= maxTickets}
                                    className="w-10 h-10 rounded-lg border-2 border-gray-300 hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg"
                                >
                                    +
                                </button>
                                <span className="text-xs text-gray-500 ml-2">
                                    Max: {maxTickets}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Book Button */}
                    <Button
                        className="w-full h-12 text-base font-bold"
                        disabled={!canBook}
                        onClick={handleBook}
                    >
                        {isHeld ? 'Reserved' : isClosed ? 'Closed' : (isFull ? 'Fully Booked' : (isScheduled ? 'Not Open Yet' : (isRoundTrip ? 'Select Trip' : 'Book Now →')))}
                    </Button>
                </div>
            </div>
        </div>
    );
};
