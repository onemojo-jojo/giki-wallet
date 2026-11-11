import { useEffect, useState } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
import { useAuthStore } from '@/shared/stores/authStore';
import { useTransportStore } from '../store';
import { useHoldTimer } from '../hooks';
import { PendingReservationBanner } from '../components/PendingReservationBanner';
import { AbandonBookingModal } from '../components/AbandonBookingModal';
import { Select } from '@/shared/components/ui/Select';
import { Input } from '@/shared/components/ui/Input';
import { cn } from '@/lib/utils';
import { User, ChevronLeft } from 'lucide-react';
import { BookingConfirmationModal, TripSummary } from '../components/BookingConfirmationModal';
import { formatDate, formatTime } from '../utils';
import type { BookingSelection, Passenger } from '../validators';

export const PassengerDetailsPage = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const {
        activeHolds,
        passengers,
        updatePassenger,
        releaseAllHolds,
        confirmBooking,
        allTrips,
        outboundSelection,
        returnSelection,
        direction
    } = useTransportStore();

    const timeLeft = useHoldTimer(activeHolds);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirming, setConfirming] = useState(false);

    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            activeHolds.length > 0 &&
            currentLocation.pathname !== nextLocation.pathname &&
            nextLocation.pathname !== '/tickets'
    );

    // Redirect if no holds
    useEffect(() => {
        if (!activeHolds || activeHolds.length === 0) {
            navigate('/transport');
        }
    }, [activeHolds, navigate]);

    // Derived State
    const userName = user?.name || '';
    const isSelfSelected = Object.values(passengers).some(p => p.relation === 'SELF');

    const isValid = activeHolds.every(h => {
        const p = passengers[h.id];
        return p && p.name && (p.relation === 'SELF' || !!p.relation);
    });

    const isStudent = user?.user_type === 'STUDENT';

    // Prepare data for Confirmation Modal (logic copied from TransportPage)
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

    // Filter holds by direction using STORE STATE, not object property which might be inconsistent
    const currentHolds = activeHolds.map(h => ({ hold_id: h.id, expires_at: h.expires_at }));

    // Since we only allow one direction at a time (locked by setDirection), assume all active holds belong to current direction.
    // If we ever support mixed cart, we'd need reliable direction property on ActiveHold.
    const outboundHolds = direction === 'OUTBOUND' ? currentHolds : [];
    const returnHolds = direction === 'INBOUND' ? currentHolds : [];


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

    if (activeHolds.length === 0) return null;

    return (
        <div className="flex flex-col gap-5 max-w-2xl mx-auto w-full pb-32 md:pb-8 pt-1">
            {/* Header / Timer */}
            <div className="sticky top-16 md:top-20 z-10 bg-background/95 backdrop-blur pt-1 pb-2 -mx-1 px-1">
                <PendingReservationBanner
                    count={activeHolds.length}
                    timeLeft={timeLeft}
                    onReleaseAll={async () => {
                        await releaseAllHolds();
                        navigate('/transport');
                    }}
                />
            </div>

            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => navigate('/transport')}
                    aria-label="Back to rides"
                    className="size-11 rounded-[14px] bg-card text-ink flex items-center justify-center focus-visible:outline-2 focus-visible:outline-iris"
                >
                    <ChevronLeft className="size-[22px]" strokeWidth={2.2} />
                </button>
                <div>
                    <h1 className="font-display text-2xl font-extrabold text-ink tracking-tight">Passenger Details</h1>
                    <p className="text-sm text-muted-foreground">Who are these tickets for?</p>
                </div>
            </div>

            <div className="flex flex-col gap-3">
                {activeHolds.map((h, idx) => {
                    // Store inits each hold's passenger; fall back to an empty guest entry.
                    const p = passengers[h.id] || { name: '', relation: 'GUEST' };
                    const isSelf = p.relation === 'SELF';

                    // Only one passenger can be "Myself": hide that option for others once it's taken.
                    const canSelectSelf = !isSelfSelected || isSelf;

                    const options = [
                        { value: 'SELF', label: 'Myself' },
                        { value: 'SPOUSE', label: 'Spouse' },
                        { value: 'CHILD', label: 'Child' },
                        { value: 'PARENT', label: 'Parent' },
                        { value: 'GUEST', label: 'Guest' },
                    ].filter((opt) => opt.value !== 'SELF' || canSelectSelf);

                    return (
                        <section key={h.id} aria-label={`Ticket ${idx + 1}`} className="p-4 rounded-[20px] bg-card flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2.5">
                                    <span
                                        className={cn(
                                            'size-9 rounded-xl flex items-center justify-center font-display font-extrabold text-sm',
                                            isSelf ? 'bg-ink text-volt' : 'bg-iris-tint text-iris-strong'
                                        )}
                                    >
                                        {isSelf ? <User className="size-4" aria-hidden="true" /> : idx + 1}
                                    </span>
                                    <span className="text-xs font-extrabold text-muted-foreground uppercase tracking-[0.06em]">Ticket #{idx + 1}</span>
                                </span>
                                {h.direction && (
                                    <span
                                        className={cn(
                                            'text-[11px] uppercase font-extrabold px-2.5 py-0.5 rounded-full',
                                            h.direction?.toUpperCase() === 'OUTBOUND' ? 'bg-iris-tint text-iris-strong' : 'bg-mint-tint text-mint'
                                        )}
                                    >
                                        {h.direction}
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <div className="sm:col-span-1">
                                    <Select
                                        label="Relation"
                                        options={options}
                                        value={p.relation}
                                        onChange={(val) => {
                                            if (val === 'SELF') {
                                                updatePassenger(h.id, { name: userName, relation: 'SELF' });
                                            } else {
                                                // If switching from SELF, clear name. Else keep it.
                                                const newName = p.relation === 'SELF' ? '' : p.name;
                                                updatePassenger(h.id, { name: newName, relation: val as Passenger['relation'] });
                                            }
                                        }}
                                        placeholder="Select Relation"
                                        className="h-12 rounded-xl bg-card border-input font-semibold"
                                        showLabel={false}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <Input
                                        placeholder="Passenger Name"
                                        aria-label={`Passenger name for ticket ${idx + 1}`}
                                        value={p.name}
                                        onChange={(e) => updatePassenger(h.id, { ...p, name: e.target.value })}
                                        disabled={isSelf}
                                        className={cn('h-12 rounded-xl bg-card', isSelf && 'bg-background text-[#4A4766] cursor-not-allowed')}
                                    />
                                </div>
                            </div>
                        </section>
                    );
                })}
            </div>

            {/* Footer actions */}
            <div className="fixed bottom-[68px] left-0 right-0 p-4 bg-card/95 backdrop-blur-xl border-t border-line z-30 md:static md:bg-transparent md:border-0 md:p-0 md:mt-2">
                <div className="max-w-2xl mx-auto flex gap-3">
                    <button
                        type="button"
                        className="flex-1 h-14 rounded-[18px] border-[1.5px] border-input bg-card text-ink text-[15px] font-extrabold focus-visible:outline-2 focus-visible:outline-iris"
                        onClick={() => navigate('/transport')}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="flex-[2] h-14 rounded-[18px] bg-ink text-white text-[15px] font-extrabold disabled:bg-secondary disabled:text-[#6E6B88] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                        onClick={() => setShowConfirmModal(true)}
                        disabled={!isValid || activeHolds.length === 0}
                    >
                        Review &amp; Confirm
                    </button>
                </div>
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

export default PassengerDetailsPage;
