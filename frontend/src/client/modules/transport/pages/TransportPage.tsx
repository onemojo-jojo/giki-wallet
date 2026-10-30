import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/shared/stores/authStore';
import { useTransportStore } from '../store';
import { useHoldTimer } from '../hooks';
import { TransportBookingModeSelector } from '../components/TransportBookingModeSelector';
import { PendingReservationBanner } from '../components/PendingReservationBanner';
import { AbandonBookingModal } from '../components/AbandonBookingModal';
import { TransportBookingCard } from '../components/TransportBookingCard'; // OLD UI - kept for rollback
import { RouteGrid } from '../components/RouteGrid'; // NEW TILE-BASED UI
import { BookingConfirmationModal, TripSummary } from '../components/BookingConfirmationModal';
import { SelectionSummary } from '../components/SelectionSummary';
import { formatDate, formatTime } from '../utils';
import type { BookingSelection } from '../validators';
import { toast } from 'sonner';

export const TransportPage = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const {
        allTrips,
        activeHolds,
        passengers,
        updatePassenger,
        confirmBooking,
        loading: tripsLoading,
        initialized,
        fetchData,
        releaseAllHolds,
        direction,
        setDirection,
        addSelection,
        outboundSelection,
        returnSelection,
        isRoundTrip,
        setRoundTrip,
    } = useTransportStore();

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const timeLeft = useHoldTimer(activeHolds);

    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            activeHolds.length > 0 &&
            currentLocation.pathname !== nextLocation.pathname &&
            !nextLocation.pathname.includes('/transport/passengers')
    );

    useEffect(() => {
        void fetchData(true);
    }, [fetchData]);

    useEffect(() => {
        // Only show expiration if timer has actually counted down (add 1s grace period)
        // This prevents false "expired" on initial hold creation when timeLeft starts at 0
        if (activeHolds.length > 0 && timeLeft === 0 && !tripsLoading && initialized) {
            // Double-check holds are actually expired by checking the timestamp
            const now = Date.now();
            const hasExpiredHold = activeHolds.some(h => new Date(h.expires_at).getTime() < now);
            
            if (hasExpiredHold) {
                toast.error("Reservation expired. Please try again.");
                fetchData(false);
                useTransportStore.getState().resetBookingFlow();
            }
        }
    }, [activeHolds.length, timeLeft, tripsLoading, fetchData, initialized, activeHolds]);

    const nextBookingOpening = useMemo(() => {
        const now = Date.now();
        return allTrips.reduce<number | null>((soonest, trip) => {
            if (trip.status !== 'SCHEDULED') return soonest;

            const opensAt = new Date(trip.booking_opens_at).getTime();
            if (!Number.isFinite(opensAt) || opensAt <= now) return soonest;
            return soonest === null || opensAt < soonest ? opensAt : soonest;
        }, null);
    }, [allTrips]);

    // Stagger refreshes so clients do not all hit the API at the same instant.
    useEffect(() => {
        if (tripsLoading || !initialized || nextBookingOpening === null) return;

        const maxJitterMs = 10_000;
        const pollIntervalMs = 30_000;
        const timeUntilOpen = Math.max(0, nextBookingOpening - Date.now());

        const openTimer = window.setTimeout(() => {
            void fetchData(false);
            toast.info('Booking now open!', { duration: 3000 });
        }, timeUntilOpen + Math.random() * maxJitterMs);

        if (timeUntilOpen <= 5 * 60 * 1000) {
            let pollTimer: number | undefined;
            let cancelled = false;

            const schedulePoll = (delayMs: number) => {
                pollTimer = window.setTimeout(() => {
                    void fetchData(false);
                    if (!cancelled) {
                        schedulePoll(pollIntervalMs + Math.random() * maxJitterMs);
                    }
                }, delayMs);
            };

            schedulePoll(Math.random() * maxJitterMs);
            return () => {
                cancelled = true;
                if (pollTimer !== undefined) window.clearTimeout(pollTimer);
                window.clearTimeout(openTimer);
            };
        }

        return () => window.clearTimeout(openTimer);
    }, [nextBookingOpening, tripsLoading, initialized, fetchData]);

    const isStudent = user?.user_type === 'STUDENT';

    const handleBook = async (selection: BookingSelection) => {
        try {
            await addSelection(selection);
            const state = useTransportStore.getState();

            if (state.isRoundTrip) {
                if (state.outboundSelection && state.returnSelection) {
                    if (isStudent) {
                        setShowConfirmModal(true);
                    } else {
                        navigate('/transport/passengers');
                    }
                } else { }
            } else {
                if (isStudent) {
                    setShowConfirmModal(true);
                } else {
                    navigate('/transport/passengers');
                }
            }

        } catch (error) {
            console.error('handleBook error:', error);
        }
    };

    const handleConfirmBooking = async () => {
        setConfirming(true);
        try {
            const confirmations = activeHolds.map(h => ({
                holdId: h.id,
                passengerName: passengers[h.id]?.name || user?.name || '',
                passengerRelation: passengers[h.id]?.relation || 'SELF'
            }));
            await confirmBooking(confirmations);
            setShowConfirmModal(false);
            navigate('/transport/tickets');
        } catch (error) {
            console.error('Failed to confirm booking:', error);
        } finally {
            setConfirming(false);
        }
    };

    if (!initialized) {
        return (
            <div className="flex items-center justify-center py-16 text-gray-600">
                Loading…
            </div>
        );
    }

    const getTripSummary = (selection: BookingSelection | null): TripSummary | null => {
        if (!selection) return null;
        const trip = allTrips.find(t => t.id === selection.tripId);
        if (!trip) return null;

        const pickup = trip.stops.find(s => s.stop_id === selection.pickupId)?.stop_name || 'Unknown';
        const dropoff = trip.stops.find(s => s.stop_id === selection.dropoffId)?.stop_name || 'Unknown';

        return {
            route: trip.route_name,
            when: `${formatDate(trip.departure_time)} • ${formatTime(trip.departure_time)}`,
            pickup,
            dropoff,
            seats: selection.ticketCount,
            priceEach: trip.base_price,
        };
    };

    const outboundSummary = getTripSummary(outboundSelection);
    const returnSummary = getTripSummary(returnSelection);

    const outboundHolds = activeHolds
        .filter(h => h.direction?.toUpperCase() === 'OUTBOUND')
        .map(h => ({ hold_id: h.id, expires_at: h.expires_at }));

    const returnHolds = activeHolds
        .filter(h => h.direction?.toUpperCase() === 'INBOUND')
        .map(h => ({ hold_id: h.id, expires_at: h.expires_at }));

    return (
        <div className="space-y-4">
            <PendingReservationBanner
                count={activeHolds.length}
                timeLeft={timeLeft}
                onReleaseAll={releaseAllHolds}
            />

            {/* Dynamic Selection Summary (Cart) */}
            <SelectionSummary
                isRoundTrip={isRoundTrip}
                allTrips={allTrips}
                outboundSelection={outboundSelection}
                returnSelection={returnSelection}
                activeHolds={activeHolds}
            />

            <div className="grid gap-4">
                <TransportBookingModeSelector
                    direction={direction}
                    onDirectionChange={setDirection}
                    isRoundTrip={isRoundTrip}
                    onRoundTripChange={setRoundTrip}
                    quota={useTransportStore.getState().quota}
                />

                {/* ROUND-TRIP MODE: Show both directions side-by-side */}
                {isRoundTrip ? (
                    <div className="space-y-4">
                        {/* Simplified Round Trip Banner */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-blue-900">
                                ↔ Round Trip • Select both
                            </div>
                        </div>

                        {/* Outbound Section */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 px-2">
                                <div className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold",
                                    outboundSelection ? "bg-green-500 text-white" : "bg-gray-300 text-gray-600"
                                )}>
                                    {outboundSelection ? '✓' : '1'}
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900">
                                     From GIKI
                                </h2>
                            </div>
                            <RouteGrid
                                direction="OUTBOUND"
                                onBook={handleBook}
                            />
                        </div>

                        {/* Simple Divider */}
                        <div className="flex items-center gap-2 px-2">
                            <div className="flex-1 h-px bg-gray-200" />
                            <span className="text-xs text-gray-400">Then</span>
                            <div className="flex-1 h-px bg-gray-200" />
                        </div>

                        {/* Return Section */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 px-2">
                                <div className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold",
                                    returnSelection ? "bg-green-500 text-white" : "bg-gray-300 text-gray-600"
                                )}>
                                    {returnSelection ? '✓' : '2'}
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900">
                                     To GIKI
                                </h2>
                            </div>
                            <RouteGrid
                                direction="INBOUND"
                                onBook={handleBook}
                            />
                        </div>
                    </div>
                ) : (
                    /* SINGLE-TRIP MODE: Show only selected direction */
                    <div className="space-y-3">
                        <h2 className="text-2xl font-bold text-gray-900 px-2">
                            {direction === 'OUTBOUND' ? ' From GIKI' : ' To GIKI'}
                        </h2>
                        
                        <RouteGrid
                            direction={direction}
                            onBook={handleBook}
                        />
                    </div>
                )}

                {activeHolds.length > 0 && (
                    <div className="pt-3 flex flex-col items-center gap-2 sticky bottom-6 z-10">
                        {/* Compact Progress Indicator for Round Trip */}
                        {isRoundTrip && (
                            <div className="bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm">
                                <div className="flex items-center gap-1.5 text-xs">
                                    <span className={outboundSelection ? "text-green-600" : "text-gray-400"}>
                                        {outboundSelection ? "✓" : "○"}
                                    </span>
                                    <span className="text-gray-300">•</span>
                                    <span className={returnSelection ? "text-green-600" : "text-gray-400"}>
                                        {returnSelection ? "✓" : "○"}
                                    </span>
                                </div>
                            </div>
                        )}
                        
                        <button
                            className={cn(
                                "px-8 py-3 rounded-xl font-semibold text-sm shadow-lg transition-all",
                                (isRoundTrip && outboundSelection && returnSelection) || (!isRoundTrip && (outboundSelection || returnSelection))
                                    ? "bg-gray-900 text-white hover:bg-gray-800"
                                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                            )}
                            disabled={!useTransportStore.getState().canProceed()}
                            onClick={() => {
                                if (useTransportStore.getState().canProceed()) {
                                    if (isStudent) {
                                        setShowConfirmModal(true);
                                    } else {
                                        navigate('/transport/passengers');
                                    }
                                }
                            }}
                        >
                            {isRoundTrip
                                ? (outboundSelection && returnSelection ? "Confirm Booking" : "Select Both Trips")
                                : "Continue"}
                        </button>
                    </div>
                )}
            </div>

            <BookingConfirmationModal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                confirming={confirming}
                onConfirm={handleConfirmBooking}
                outboundSummary={outboundSummary}
                returnSummary={returnSummary}
                outboundHolds={outboundHolds}
                returnHolds={returnHolds}
                passengers={passengers}
                onUpdatePassenger={(holdId, data) => updatePassenger(holdId, data)}
                isStudent={isStudent}
            />

            {blocker.state === 'blocked' && (
                <AbandonBookingModal
                    isOpen={true}
                    timeLeft={timeLeft}
                    onClose={() => blocker.reset?.()}
                    onAbandon={() => {
                        releaseAllHolds().then(() => blocker.proceed?.());
                    }}
                    onStay={() => blocker.reset?.()}
                />
            )}
        </div>
    );
};

export default TransportPage;
