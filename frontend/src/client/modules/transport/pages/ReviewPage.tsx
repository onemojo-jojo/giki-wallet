import { useEffect, useMemo, useState } from 'react';
import { Link, useBlocker, useNavigate } from 'react-router-dom';
import { Bus, ChevronLeft } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { useAuthStore } from '@/shared/stores/authStore';
import { useWalletModuleStore } from '@/client/modules/wallet/store';
import { useTransportStore } from '../store';
import { useHoldTimer } from '../hooks';
import { HoldTimerBar } from '../components/HoldTimerBar';
import { AbandonBookingModal } from '../components/AbandonBookingModal';
import { cityCode, formatRs, summarizeLeg, TZ, type LegSummary } from '../bookingHelpers';

const BOOKING_FLOW = ['/transport', '/tickets'];

const LegCard = ({ leg, tag }: { leg: LegSummary; tag: string }) => {
    const from = leg.direction === 'OUTBOUND' ? 'GIKI' : cityCode(leg.city);
    const to = leg.direction === 'OUTBOUND' ? cityCode(leg.city) : 'GIKI';
    return (
        <section aria-label={tag} className="bg-card rounded-[22px] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold tracking-[0.06em] text-iris-strong">{tag}</span>
                <span className="text-[13px] font-bold text-muted-foreground">{formatInTimeZone(new Date(leg.departure), TZ, 'EEE d MMM · h:mm a')}</span>
            </div>
            <div className="flex items-center gap-2.5" aria-label={`${leg.routeName}`}>
                <span className="font-display text-[26px] font-extrabold tracking-tight text-ink">{from}</span>
                <span aria-hidden="true" className="flex-1 border-t-2 border-dashed border-input" />
                <Bus className="size-5 text-iris" aria-hidden="true" />
                <span aria-hidden="true" className="flex-1 border-t-2 border-dashed border-input" />
                <span className="font-display text-[26px] font-extrabold tracking-tight text-ink">{to}</span>
            </div>
            <div className="flex items-center justify-between gap-2.5 bg-background rounded-[14px] px-3.5 h-12">
                <span className="text-[13px] text-muted-foreground">{leg.direction === 'OUTBOUND' ? 'Drop-off' : 'Pickup'}</span>
                <span className="text-[15px] font-extrabold text-ink text-right">{leg.stopName}</span>
            </div>
            {leg.seats > 1 && <span className="text-xs font-bold text-muted-foreground">{leg.seats} seats</span>}
        </section>
    );
};

/** Review & pay (students): held seats, stops, balance after, pay with G-Bux. */
export const ReviewPage = () => {
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const { balance, fetchBalance } = useWalletModuleStore();
    const { activeHolds, passengers, allTrips, outboundSelection, returnSelection, confirmBooking, releaseAllHolds, initialized, fetchData } = useTransportStore();
    const timeLeft = useHoldTimer(activeHolds);
    const [paying, setPaying] = useState(false);

    useEffect(() => {
        void fetchBalance();
        if (!initialized) void fetchData(true);
    }, [fetchBalance, fetchData, initialized]);

    // Nothing held (expired, released or opened directly) → back to Rides.
    useEffect(() => {
        if (initialized && activeHolds.length === 0 && !paying) navigate('/transport', { replace: true });
    }, [initialized, activeHolds.length, paying, navigate]);

    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            !paying &&
            activeHolds.length > 0 &&
            currentLocation.pathname !== nextLocation.pathname &&
            !BOOKING_FLOW.some((p) => nextLocation.pathname.startsWith(p))
    );

    const legs = useMemo(
        () => [summarizeLeg(outboundSelection, allTrips), summarizeLeg(returnSelection, allTrips)].filter((l): l is LegSummary => !!l),
        [outboundSelection, returnSelection, allTrips]
    );
    const total = legs.reduce((sum, l) => sum + l.seats * l.priceEach, 0);
    const after = balance - total;
    const short = total > 0 && after < 0;

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
        <div className="max-w-xl mx-auto w-full flex flex-col gap-3.5 pb-52 md:pb-6">
            <HoldTimerBar timeLeft={timeLeft} message="Seats held for you. Pay before the timer ends." />

            <div className="flex items-center gap-3 pt-1">
                <Link
                    to="/transport"
                    aria-label="Back to rides"
                    className="size-11 rounded-[14px] bg-card text-ink flex items-center justify-center focus-visible:outline-2 focus-visible:outline-iris"
                >
                    <ChevronLeft className="size-[22px]" strokeWidth={2.2} />
                </Link>
                <h1 className="font-display font-extrabold text-[22px] text-ink">Review &amp; pay</h1>
            </div>

            {legs.map((l, i) => (
                <LegCard key={l.tripId} leg={l} tag={legs.length > 1 ? (i === 0 ? 'GOING' : 'COMING BACK') : l.direction === 'OUTBOUND' ? 'GOING' : 'COMING BACK'} />
            ))}

            <section aria-label="Payment" className="bg-card rounded-[22px] px-4 py-1">
                <div className="flex justify-between gap-3 py-3">
                    <span className="text-sm text-muted-foreground">Passenger</span>
                    <span className="text-sm font-extrabold text-ink text-right">{user?.name} (you)</span>
                </div>
                <div className="flex justify-between gap-3 py-3 border-t border-[#F0EFF5]">
                    <span className="text-sm text-muted-foreground">G-Bux after paying</span>
                    <span className={short ? 'text-sm font-extrabold text-coral tabular' : 'text-sm font-extrabold text-ink tabular'}>
                        Rs {formatRs(balance)} → Rs {formatRs(after)}
                    </span>
                </div>
            </section>

            {short && (
                <div role="alert" className="bg-coral-tint rounded-2xl p-3.5 flex items-center gap-3">
                    <span className="flex-1 text-sm font-bold text-[#8F1B21]">You need Rs {formatRs(-after)} more in G-Bux.</span>
                    <Link to="/top-up" className="h-10 px-3.5 rounded-xl bg-card text-[#8F1B21] text-sm font-extrabold flex items-center">
                        Add money
                    </Link>
                </div>
            )}

            <div className="fixed md:static left-0 right-0 bottom-[68px] md:bottom-auto z-30 bg-card rounded-t-[24px] md:rounded-[22px] px-5 pt-4 pb-9 md:pb-3 shadow-[0_-1px_0_#E6E5EE] md:shadow-none flex flex-col gap-1.5">
                <button
                    type="button"
                    onClick={() => void pay()}
                    disabled={paying}
                    className="h-[58px] rounded-[18px] bg-ink text-white text-base font-extrabold flex items-center justify-between px-[22px] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                >
                    <span>{paying ? 'Paying…' : 'Pay with G-Bux'}</span>
                    <span className="font-display text-lg text-volt tabular">Rs {formatRs(total)}</span>
                </button>
                <button
                    type="button"
                    disabled={paying}
                    onClick={async () => {
                        await releaseAllHolds();
                        navigate('/transport');
                    }}
                    className="h-10 text-sm font-bold text-[#4A4766] rounded-xl focus-visible:outline-2 focus-visible:outline-iris"
                >
                    {activeHolds.length > 1 ? 'Release all seats' : 'Release seat'}
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

export default ReviewPage;
