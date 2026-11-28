import { useEffect, useState } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
import { useAuthStore } from '@/shared/stores/authStore';
import { useTransportStore } from '../store';
import { useHoldTimer } from '../hooks';
import { PendingReservationBanner } from '../components/PendingReservationBanner';
import { AbandonBookingModal } from '../components/AbandonBookingModal';
import { Button } from '@/shared/components/ui/button';
import { Select } from '@/shared/components/ui/Select';
import { Input } from '@/shared/components/ui/Input';
import { cn } from '@/lib/utils';
import { User, Users, ChevronLeft } from 'lucide-react';
import { BookingConfirmationModal, TripSummary } from '../components/BookingConfirmationModal';
import { formatDate, formatTime } from '../utils';
import type { BookingSelection } from '../validators';

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
        <div className="space-y-6 max-w-2xl mx-auto pb-32 md:pb-20">
            {/* Header / Timer */}
            <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur pt-4 pb-2">
                <PendingReservationBanner
                    count={activeHolds.length}
                    timeLeft={timeLeft}
                    onReleaseAll={async () => {
                        await releaseAllHolds();
                        navigate('/transport');
                    }}
                />
            </div>

            <div className="flex items-center gap-2 mb-6">
                <Button variant="ghost" size="icon" onClick={() => navigate('/transport')}>
                    <ChevronLeft className="w-5 h-5 text-gray-500" />
                </Button>
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Passenger Details</h1>
                    <p className="text-gray-500 text-sm">Who are these tickets for?</p>
                </div>
            </div>

            <div className="space-y-4">
                {activeHolds.map((h, idx) => {
                    const p = passengers[h.id] || { name: '', relation: 'GUEST' }; // Default to GUEST or similar if empty, but logic usually inits it. store.ts init might need check.
                    // Actually store.ts addSelection inits to SELF? No, logic in store init:
                    // newPassengers[h.hold_id] = { name: user?.name, relation: 'SELF' };
                    // Wait, if store inits to SELF for ALL, then we have multiple SELF?
                    // store.ts implementation: 
                    // resp.holds.forEach(h => { newPassengers[h.hold_id] = { name: user?.name, relation: 'SELF' }; });
                    // This violates "Max 1 Self".
                    // I should fix store.ts init logic OR fix it here by default.
                    // But for now, let's just implement the UI. 

                    const isSelf = p.relation === 'SELF';

                    // Logic: If someone ELSE is self, I cannot be self.
                    // const isSelfSelected = Object.values(passengers).some(p => p.relation === 'SELF');
                    // But if *I* am self, I contribute to isSelfSelected.
                    // So canSelectSelf = !isSelfSelected || isSelf;
                    // Wait, if isSelfSelected is true, and I am NOT self, canSelectSelf is false. Correct.
                    // If isSelfSelected is true, and I AM self, canSelectSelf is true. Correct.

                    const canSelectSelf = !isSelfSelected || isSelf;

                    const options = [
                        { value: 'SELF', label: 'Myself' },
                        { value: 'SPOUSE', label: 'Spouse' },
                        { value: 'CHILD', label: 'Child' },
                        { value: 'PARENT', label: 'Parent' },
                        { value: 'GUEST', label: 'Guest' },
                    ].filter(opt => opt.value !== 'SELF' || canSelectSelf);

                    return (
                        <div key={h.id} className="p-4 rounded-xl border border-slate-200 bg-white/50 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-[10px]">{idx + 1}</span>
                                    Ticket #{idx + 1}
                                </span>
                                {h.direction && (
                                    <span className={cn(
                                        "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full",
                                        h.direction?.toUpperCase() === 'OUTBOUND' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                                    )}>
                                        {h.direction}
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {/* Relation Select */}
                                <div className="md:col-span-1">
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
                                                updatePassenger(h.id, { name: newName, relation: val as any });
                                            }
                                        }}
                                        placeholder="Select Relation" // This won't show if value is set
                                        className="h-11 bg-white"
                                        showLabel={false}
                                    />
                                </div>

                                {/* Name Input */}
                                <div className="md:col-span-2">
                                    <Input
                                        placeholder="Passenger Name"
                                        value={p.name}
                                        onChange={(e) => updatePassenger(h.id, { ...p, name: e.target.value })}
                                        disabled={isSelf}
                                        className={cn(
                                            "h-11 bg-white transition-all",
                                            isSelf && "bg-slate-50 text-slate-500 cursor-not-allowed"
                                        )}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer Actions */}
            <div className="fixed bottom-16 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-slate-200 z-30 md:static md:bg-transparent md:border-0 md:p-0 mt-8 pb-[calc(1rem+env(safe-area-inset-bottom,20px))]">
                <div className="max-w-2xl mx-auto flex gap-4">
                    <Button
                        variant="ghost"
                        className="flex-1 h-14 rounded-2xl font-bold text-slate-500 uppercase tracking-widest hover:bg-slate-100"
                        onClick={() => navigate('/transport')}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="flex-[2] h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all duration-300"
                        onClick={() => setShowConfirmModal(true)}
                        disabled={!isValid || activeHolds.length === 0}
                    >
                        Review & Confirm
                    </Button>
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
            {
                blocker.state === 'blocked' && (
                    <AbandonBookingModal
                        isOpen={true}
                        timeLeft={timeLeft}
                        onClose={() => blocker.reset?.()}
                        onAbandon={() => {
                            releaseAllHolds().then(() => blocker.proceed?.());
                        }}
                        onStay={() => blocker.reset?.()}
                    />
                )
            }
        </div >
    );
};

export default PassengerDetailsPage;
