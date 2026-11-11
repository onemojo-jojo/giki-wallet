import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/shared/stores/authStore';
import { useTransportStore } from '../store';
import { useHoldTimer } from '../hooks';
import { TransportBookingModeSelector } from '../components/TransportBookingModeSelector';
import { PendingReservationBanner } from '../components/PendingReservationBanner';
import { AbandonBookingModal } from '../components/AbandonBookingModal';
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
            !nextLocation.pathname.includes('/transport/passengers') &&
            // After a confirmed booking we go to My Tickets; never ask to "abandon" there.
            nextLocation.pathname !== '/tickets'
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
            navigate('/tickets');
        } catch (error) {
            console.error('Failed to confirm booking:', error);
        } finally {
            setConfirming(false);
        }
    };

    if (!initialized) {
        return (
            <div className="max-w-5xl mx-auto w-full flex flex-col gap-3 pt-1" aria-busy="true" aria-label="Loading rides">
                <div className="h-8 w-32 rounded-lg bg-secondary" />
                <div className="h-12 rounded-2xl bg-secondary" />
                {[0, 1, 2].map((i) => (
                    <div key={i} className="h-[76px] rounded-[22px] bg-card" />
                ))}
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

    const quota = useTransportStore.getState().quota;
    const canContinue = useTransportStore.getState().canProceed();

    const SectionTitle = ({ step, done, children }: { step?: string; done?: boolean; children: ReactNode }) => (
        <div className="flex items-center gap-2.5 px-1">
            {step && (
                <span
                    className={cn(
                        'size-7 rounded-full flex items-center justify-center text-xs font-extrabold',
                        done ? 'bg-mint text-white' : 'bg-secondary text-[#4A4766]'
                    )}
                    aria-hidden="true"
                >
                    {done ? '✓' : step}
                </span>
            )}
            <h2 className="font-display text-xl font-extrabold text-ink">{children}</h2>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto w-full flex flex-col gap-4 pt-1">
            <header className="flex items-center justify-between gap-3 flex-wrap">
                <h1 className="font-display font-extrabold text-[32px] tracking-tight text-ink leading-none">Rides</h1>
                {quota && (
                    <span className="text-xs font-extrabold text-ink bg-card px-3 py-1.5 rounded-full">
                        Weekly quota · {quota.outbound.remaining} out · {quota.inbound.remaining} back
                    </span>
                )}
            </header>

            <PendingReservationBanner count={activeHolds.length} timeLeft={timeLeft} onReleaseAll={releaseAllHolds} />

            {/* Dynamic Selection Summary (Cart) */}
            <SelectionSummary
                isRoundTrip={isRoundTrip}
                allTrips={allTrips}
                outboundSelection={outboundSelection}
                returnSelection={returnSelection}
                activeHolds={activeHolds}
            />

            <div className="flex flex-col gap-4">
                <TransportBookingModeSelector
                    direction={direction}
                    onDirectionChange={setDirection}
                    isRoundTrip={isRoundTrip}
                    onRoundTripChange={setRoundTrip}
                    quota={quota}
                />

                {isRoundTrip ? (
                    <div className="flex flex-col gap-4">
                        <p className="text-center text-sm font-bold text-iris-strong bg-iris-tint rounded-2xl py-2.5">Round trip · pick both buses</p>

                        <div className="flex flex-col gap-3">
                            <SectionTitle step="1" done={!!outboundSelection}>
                                From GIKI
                            </SectionTitle>
                            <RouteGrid direction="OUTBOUND" onBook={handleBook} />
                        </div>

                        <div className="flex items-center gap-2 px-1" aria-hidden="true">
                            <div className="flex-1 h-px bg-line" />
                            <span className="text-xs font-bold text-muted-foreground">Then</span>
                            <div className="flex-1 h-px bg-line" />
                        </div>

                        <div className="flex flex-col gap-3">
                            <SectionTitle step="2" done={!!returnSelection}>
                                To GIKI
                            </SectionTitle>
                            <RouteGrid direction="INBOUND" onBook={handleBook} />
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        <SectionTitle>{direction === 'OUTBOUND' ? 'From GIKI' : 'To GIKI'}</SectionTitle>
                        <RouteGrid direction={direction} onBook={handleBook} />
                    </div>
                )}

                {activeHolds.length > 0 && (
                    <div className="sticky bottom-[84px] md:bottom-6 z-10 flex flex-col items-center gap-2 pt-2">
                        {isRoundTrip && (
                            <div className="bg-card rounded-full px-3 py-1 shadow-sm text-xs font-bold flex items-center gap-1.5">
                                <span className={outboundSelection ? 'text-mint' : 'text-light-gray'}>{outboundSelection ? '✓ Going' : '○ Going'}</span>
                                <span className="text-light-gray">·</span>
                                <span className={returnSelection ? 'text-mint' : 'text-light-gray'}>{returnSelection ? '✓ Return' : '○ Return'}</span>
                            </div>
                        )}
                        <button
                            type="button"
                            className="w-full max-w-md h-14 rounded-[18px] bg-ink text-white text-base font-extrabold shadow-lg shadow-ink/20 disabled:bg-secondary disabled:text-[#6E6B88] disabled:shadow-none disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                            disabled={!canContinue}
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
                            {isRoundTrip ? (outboundSelection && returnSelection ? 'Confirm Booking' : 'Select Both Trips') : 'Continue'}
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
