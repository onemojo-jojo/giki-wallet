import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useBlocker } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { useAuthStore } from '@/shared/stores/authStore';
import { useWalletModuleStore } from '@/client/modules/wallet/store';
import { cn } from '@/lib/utils';
import { useTransportStore } from '../store';
import { useHoldTimer } from '../hooks';
import { HoldTimerBar } from '../components/HoldTimerBar';
import { AbandonBookingModal } from '../components/AbandonBookingModal';
import { formatRs, summarizeLeg, TZ, type LegSummary } from '../bookingHelpers';
import type { Passenger } from '../validators';

const BOOKING_FLOW = ['/transport', '/tickets'];

const RELATIONS: { value: Passenger['relation']; label: string }[] = [
    { value: 'SELF', label: 'Myself' },
    { value: 'SPOUSE', label: 'Spouse' },
    { value: 'CHILD', label: 'Child' },
    { value: 'PARENT', label: 'Parent' },
    { value: 'GUEST', label: 'Guest' },
];

/** "Who's travelling?" — staff name each held seat, then pay. */
export const PassengerDetailsPage = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { balance, fetchBalance } = useWalletModuleStore();
    const { activeHolds, passengers, updatePassenger, releaseAllHolds, confirmBooking, allTrips, outboundSelection, returnSelection, initialized, fetchData } =
        useTransportStore();
    const timeLeft = useHoldTimer(activeHolds);
    const [paying, setPaying] = useState(false);

    useEffect(() => {
        void fetchBalance();
        if (!initialized) void fetchData(true);
    }, [fetchBalance, fetchData, initialized]);

    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            !paying &&
            activeHolds.length > 0 &&
            currentLocation.pathname !== nextLocation.pathname &&
            !BOOKING_FLOW.some((p) => nextLocation.pathname.startsWith(p))
    );

    // Redirect if no holds
    useEffect(() => {
        if (initialized && (!activeHolds || activeHolds.length === 0) && !paying) navigate('/transport', { replace: true });
    }, [activeHolds, initialized, paying, navigate]);

    const userName = user?.name || '';
    const isSelfSelected = Object.values(passengers).some((p) => p.relation === 'SELF');
    const isValid = activeHolds.every((h) => {
        const p = passengers[h.id];
        return p && p.name && (p.relation === 'SELF' || !!p.relation);
    });

    const legs = useMemo(
        () => [summarizeLeg(outboundSelection, allTrips), summarizeLeg(returnSelection, allTrips)].filter((l): l is LegSummary => !!l),
        [outboundSelection, returnSelection, allTrips]
    );
    const total = legs.reduce((sum, l) => sum + l.seats * l.priceEach, 0);
    const short = total > 0 && balance - total < 0;
    const tripLine = legs
        .map((l) => `${formatInTimeZone(new Date(l.departure), TZ, 'EEE d MMM · h:mm a')} · ${l.routeName}`)
        .join('  +  ');

    const pay = async () => {
        setPaying(true);
        try {
            const confirmations = activeHolds.map((h) => ({
                holdId: h.id,
                passengerName: passengers[h.id]?.name || user?.name || '',
                passengerRelation: passengers[h.id]?.relation || 'SELF',
            }));
            await confirmBooking(confirmations);
            void fetchBalance();
            navigate('/transport/booked', { replace: true, state: { legs, total } });
        } catch (error) {
            console.error('Failed to confirm booking:', error);
            setPaying(false);
        }
    };

    if (activeHolds.length === 0) return null;

    return (
        <div className="max-w-xl mx-auto w-full flex flex-col gap-3.5 pb-44 md:pb-6">
            <HoldTimerBar
                timeLeft={timeLeft}
                message={`${activeHolds.length} seat${activeHolds.length === 1 ? '' : 's'} held on the employee bus`}
                actions={[
                    {
                        label: 'Release All',
                        onClick: async () => {
                            await releaseAllHolds();
                            navigate('/transport');
                        },
                    },
                ]}
            />

            <div className="flex items-center gap-3 pt-1">
                <Link
                    to="/transport"
                    aria-label="Back to rides"
                    className="size-11 rounded-[14px] bg-card text-ink flex items-center justify-center shrink-0 focus-visible:outline-2 focus-visible:outline-iris"
                >
                    <ChevronLeft className="size-[22px]" strokeWidth={2.2} />
                </Link>
                <div className="flex flex-col min-w-0">
                    <h1 className="font-display font-extrabold text-[22px] text-ink">Who's travelling?</h1>
                    <span className="text-[13px] text-muted-foreground truncate">{tripLine}</span>
                </div>
            </div>

            {activeHolds.map((h, idx) => {
                const p = passengers[h.id] || { name: '', relation: 'GUEST' as const };
                const isSelf = p.relation === 'SELF';
                // Only one passenger can be "Myself".
                const canSelectSelf = !isSelfSelected || isSelf;
                const options = RELATIONS.filter((o) => o.value !== 'SELF' || canSelectSelf);

                return (
                    <section key={h.id} aria-label={`Seat ${idx + 1}`} className="bg-card rounded-[20px] px-4 py-3.5 flex flex-col gap-2.5">
                        <div className="flex items-center gap-2.5">
                            <span
                                className={cn(
                                    'size-9 rounded-xl flex items-center justify-center font-display font-extrabold text-sm',
                                    isSelf ? 'bg-ink text-volt' : 'bg-iris-tint text-iris-strong'
                                )}
                            >
                                {idx + 1}
                            </span>
                            <span className="flex-1 text-[13px] font-extrabold text-muted-foreground">SEAT {idx + 1}</span>
                            {h.direction && (
                                <span
                                    className={cn(
                                        'text-[11px] uppercase font-extrabold px-2.5 py-0.5 rounded-full',
                                        h.direction.toUpperCase() === 'OUTBOUND' ? 'bg-iris-tint text-iris-strong' : 'bg-mint-tint text-mint'
                                    )}
                                >
                                    {h.direction.toUpperCase() === 'OUTBOUND' ? 'Going' : 'Return'}
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-[3fr_2fr] gap-2">
                            <label className="flex flex-col gap-1 text-xs font-bold text-[#4A4766] min-w-0">
                                Name
                                <input
                                    type="text"
                                    value={p.name}
                                    placeholder="Full name"
                                    disabled={isSelf}
                                    onChange={(e) => updatePassenger(h.id, { ...p, name: e.target.value })}
                                    className="h-[46px] rounded-xl border-[1.5px] border-input bg-card px-3 text-[15px] font-semibold text-ink min-w-0 outline-none focus:border-iris focus:border-2 disabled:bg-background disabled:text-[#4A4766]"
                                />
                            </label>
                            <label className="flex flex-col gap-1 text-xs font-bold text-[#4A4766]">
                                Relation
                                <select
                                    value={p.relation}
                                    onChange={(e) => {
                                        const val = e.target.value as Passenger['relation'];
                                        if (val === 'SELF') {
                                            updatePassenger(h.id, { name: userName, relation: 'SELF' });
                                        } else {
                                            // If switching from SELF, clear name. Else keep it.
                                            const newName = p.relation === 'SELF' ? '' : p.name;
                                            updatePassenger(h.id, { name: newName, relation: val });
                                        }
                                    }}
                                    className="h-[46px] rounded-xl border-[1.5px] border-input bg-card px-2.5 text-[15px] font-semibold text-ink outline-none focus:border-iris focus:border-2"
                                >
                                    {options.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </section>
                );
            })}

            <p className="text-xs text-center text-muted-foreground">Employees can book up to 3 seats per trip for themselves and family.</p>

            {short && (
                <div role="alert" className="bg-coral-tint rounded-2xl p-3.5 flex items-center gap-3">
                    <span className="flex-1 text-sm font-bold text-[#8F1B21]">You need Rs {formatRs(total - balance)} more in G-Bux.</span>
                    <Link to="/top-up" className="h-10 px-3.5 rounded-xl bg-card text-[#8F1B21] text-sm font-extrabold flex items-center">
                        Add money
                    </Link>
                </div>
            )}

            <div className="fixed md:static left-0 right-0 bottom-[68px] md:bottom-auto z-30 bg-card rounded-t-[24px] md:rounded-[22px] px-5 pt-4 pb-9 md:pb-4 shadow-[0_-1px_0_#E6E5EE] md:shadow-none">
                <button
                    type="button"
                    onClick={() => void pay()}
                    disabled={!isValid || paying}
                    className="w-full h-[58px] rounded-[18px] bg-ink text-white text-base font-extrabold flex items-center justify-between px-[22px] disabled:bg-secondary disabled:text-[#6E6B88] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                >
                    <span>
                        {paying ? 'Paying…' : !isValid ? 'Add a name for every seat' : `Pay for ${activeHolds.length} seat${activeHolds.length === 1 ? '' : 's'}`}
                    </span>
                    <span className="font-display text-lg text-volt tabular">Rs {formatRs(total)}</span>
                </button>
            </div>

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
