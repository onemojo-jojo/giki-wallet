import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useBlocker } from 'react-router-dom';
import { ArrowLeftRight, Check, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Switch } from '@/shared/components/ui/switch';
import { useAuthStore } from '@/shared/stores/authStore';
import { useTransportStore } from '../store';
import { useHoldTimer } from '../hooks';
import { AbandonBookingModal } from '../components/AbandonBookingModal';
import { DayStrip, type Day } from '../components/DayStrip';
import { DepartureRow } from '../components/DepartureRow';
import { InlineStopPicker } from '../components/InlineStopPicker';
import { HoldTimerBar } from '../components/HoldTimerBar';
import { getGIKIStopObject } from '../utils';
import { dayKey, formatClock, formatRs, summarizeLeg, TZ } from '../bookingHelpers';
import type { BookingSelection, Trip } from '../validators';
import { formatInTimeZone } from 'date-fns-tz';

/** Routes inside the booking flow that keep seats held (no "abandon?" prompt). */
const BOOKING_FLOW = ['/transport/review', '/transport/passengers', '/transport/booked'];

export const TransportPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    // Opened from the web home's departures table: that bus's stop picker starts open.
    const handoff = location.state as { openTripId?: string; direction?: 'OUTBOUND' | 'INBOUND'; day?: string } | null;
    const { user } = useAuthStore();
    const {
        allTrips,
        activeHolds,
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
        quota,
    } = useTransportStore();

    const timeLeft = useHoldTimer(activeHolds);
    // The departure whose fare was tapped: its stop picker opens inside the row.
    const [openTripId, setOpenTripId] = useState<string | null>(handoff?.openTripId ?? null);
    const [holding, setHolding] = useState(false);
    const [pickedDay, setPickedDay] = useState<string | null>(handoff?.day ?? null);
    const [confirmRelease, setConfirmRelease] = useState(false);
    const [now, setNow] = useState(() => Date.now());

    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            activeHolds.length > 0 &&
            currentLocation.pathname !== nextLocation.pathname &&
            !BOOKING_FLOW.some((p) => nextLocation.pathname.startsWith(p))
    );

    useEffect(() => {
        void fetchData(true);
    }, [fetchData]);

    useEffect(() => {
        if (handoff?.direction && handoff.direction !== useTransportStore.getState().direction) setDirection(handoff.direction);
        // Only on arrival.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Live "opens in" text.
    useEffect(() => {
        const t = window.setInterval(() => setNow(Date.now()), 30000);
        return () => window.clearInterval(t);
    }, []);

    useEffect(() => {
        // Only show expiration if timer has actually counted down (add 1s grace period)
        // This prevents false "expired" on initial hold creation when timeLeft starts at 0
        if (activeHolds.length > 0 && timeLeft === 0 && !tripsLoading && initialized) {
            const nowMs = Date.now();
            const hasExpiredHold = activeHolds.some((h) => new Date(h.expires_at).getTime() < nowMs);
            if (hasExpiredHold) {
                toast.error('Reservation expired. Please try again.');
                fetchData(false);
                useTransportStore.getState().resetBookingFlow();
            }
        }
    }, [activeHolds.length, timeLeft, tripsLoading, fetchData, initialized, activeHolds]);

    const nextBookingOpening = useMemo(() => {
        const nowMs = Date.now();
        return allTrips.reduce<number | null>((soonest, trip) => {
            if (trip.status !== 'SCHEDULED') return soonest;
            const opensAt = new Date(trip.booking_opens_at).getTime();
            if (!Number.isFinite(opensAt) || opensAt <= nowMs) return soonest;
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
    const heldTripIds = useMemo(() => new Set(activeHolds.map((h) => h.trip_id)), [activeHolds]);
    const dirQuota = direction === 'OUTBOUND' ? quota?.outbound ?? null : quota?.inbound ?? null;
    const canBookRoundTrip = quota ? quota.outbound.remaining >= 1 && quota.inbound.remaining >= 1 : true;

    // Trips for the current direction (same filter as before: not cancelled/deleted).
    const dirTrips = useMemo(() => {
        const target = direction.toUpperCase();
        return allTrips
            .filter((t) => t.direction.toUpperCase().trim() === target)
            .filter((t) => !['CANCELLED', 'DELETED'].includes(t.status.toUpperCase().trim()))
            .sort((a, b) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime());
    }, [allTrips, direction]);

    // Day chips: the next 7 days, plus any later day that has buses.
    const days: Day[] = useMemo(() => {
        const keys = new Set<string>();
        for (let i = 0; i < 7; i++) keys.add(dayKey(new Date(now + i * 864e5)));
        dirTrips.forEach((t) => keys.add(dayKey(t.departure_time)));
        const withTrips = new Set(dirTrips.map((t) => dayKey(t.departure_time)));
        return [...keys]
            .sort()
            .map((k) => ({ key: k, date: new Date(`${k}T12:00:00+05:00`), hasTrips: withTrips.has(k) }));
    }, [dirTrips, now]);

    // Round trip with one leg held: the other leg's view. Default its day to on/after the held bus.
    const heldLeg = summarizeLeg(outboundSelection ?? returnSelection, allTrips);
    const pickingSecondLeg = isRoundTrip && !!heldLeg && !(outboundSelection && returnSelection);
    const todayKey = dayKey(new Date(now));
    const minDay = pickingSecondLeg && heldLeg?.direction === 'OUTBOUND' && heldLeg.departure ? dayKey(heldLeg.departure) : todayKey;
    const firstDayWithTrips =
        days.find((d) => d.hasTrips && d.key >= minDay)?.key ?? days.find((d) => d.hasTrips)?.key ?? days[0]?.key ?? '';
    const selectedDay = pickedDay && days.some((d) => d.key === pickedDay) ? pickedDay : firstDayWithTrips;
    const dayTrips = dirTrips.filter((t) => dayKey(t.departure_time) === selectedDay);

    const handleHold = async (stopId: string, ticketCount: number) => {
        const trip = allTrips.find((t) => t.id === openTripId);
        if (!trip) return;
        const gikiStop = getGIKIStopObject(trip.stops);
        if (!gikiStop) {
            toast.error('GIKI Stop not found');
            return;
        }
        const tripDirection = trip.direction.toUpperCase() === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND';
        const selection: BookingSelection = {
            tripId: trip.id,
            pickupId: tripDirection === 'OUTBOUND' ? gikiStop.stop_id : stopId,
            dropoffId: tripDirection === 'OUTBOUND' ? stopId : gikiStop.stop_id,
            ticketCount,
        };

        setHolding(true);
        try {
            await addSelection(selection);
        } finally {
            setHolding(false);
        }

        const state = useTransportStore.getState();
        const held = state.outboundSelection?.tripId === trip.id || state.returnSelection?.tripId === trip.id;
        if (!held) return; // store already showed the error
        setOpenTripId(null);
        setPickedDay(null);

        const done = state.isRoundTrip ? !!(state.outboundSelection && state.returnSelection) : true;
        if (done) navigate(isStudent ? '/transport/review' : '/transport/passengers');
    };

    const goToPayment = () => navigate(isStudent ? '/transport/review' : '/transport/passengers');

    if (!initialized) {
        return (
            <div className="max-w-3xl mx-auto w-full flex flex-col gap-3 pt-1" aria-busy="true" aria-label="Loading rides">
                <div className="h-8 w-32 rounded-lg bg-secondary" />
                <div className="h-12 rounded-2xl bg-secondary" />
                <div className="h-16 rounded-2xl bg-secondary" />
                {[0, 1, 2].map((i) => (
                    <div key={i} className="h-[76px] rounded-[20px] bg-card" />
                ))}
            </div>
        );
    }

    const renderRow = (t: Trip) => (
        <DepartureRow
            key={t.id}
            trip={t}
            isHeld={heldTripIds.has(t.id)}
            now={now}
            expanded={openTripId === t.id}
            onBook={(trip) => setOpenTripId((cur) => (cur === trip.id ? null : trip.id))}
        >
            <InlineStopPicker
                key={t.id}
                trip={t}
                isStudent={isStudent}
                quotaRemaining={dirQuota?.remaining ?? null}
                busy={holding}
                onHold={handleHold}
                onCancel={() => setOpenTripId(null)}
            />
        </DepartureRow>
    );

    const abandon = blocker.state === 'blocked' && (
        <AbandonBookingModal
            isOpen={true}
            timeLeft={timeLeft}
            onClose={() => blocker.reset?.()}
            onAbandon={() => {
                releaseAllHolds().then(() => blocker.proceed?.());
            }}
            onStay={() => blocker.reset?.()}
        />
    );

    // ---------- Round trip: one leg held, pick the other ----------

    if (pickingSecondLeg && heldLeg) {
        const wantsReturn = heldLeg.direction === 'OUTBOUND';
        return (
            <div className="max-w-3xl mx-auto w-full flex flex-col gap-3.5 pt-1 pb-44 md:pb-8">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setConfirmRelease(true)}
                        aria-label="Back to rides"
                        className="size-11 rounded-[14px] bg-card text-ink flex items-center justify-center focus-visible:outline-2 focus-visible:outline-iris"
                    >
                        <ChevronLeft className="size-[22px]" strokeWidth={2.2} />
                    </button>
                    <h1 className="flex-1 font-display font-extrabold text-xl text-ink">Round trip</h1>
                    <span role="timer" aria-label={`${formatClock(timeLeft)} left on your held seat`} className="font-mono text-[13px] font-semibold text-signal-text bg-signal-tint px-2.5 py-1.5 rounded-[10px] tabular">
                        {formatClock(timeLeft)}
                    </span>
                </div>

                <ol className="bg-card rounded-[22px] overflow-hidden">
                    <li className="flex items-center gap-3 px-4 py-3.5">
                        <span className="size-[30px] rounded-full bg-mint text-white flex items-center justify-center shrink-0">
                            <Check className="size-4" strokeWidth={3} aria-hidden="true" />
                        </span>
                        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <span className="text-xs font-extrabold text-mint">{wantsReturn ? 'GOING' : 'COMING BACK'} · SEAT HELD</span>
                            <span className="text-[15px] font-extrabold text-ink truncate">
                                {formatInTimeZone(new Date(heldLeg.departure), TZ, 'EEE d · h:mm a')} · {heldLeg.routeName}
                            </span>
                        </span>
                        <button type="button" onClick={() => setConfirmRelease(true)} className="h-11 px-1 text-[13px] font-extrabold text-iris-strong focus-visible:outline-2 focus-visible:outline-iris rounded-lg">
                            Change
                        </button>
                    </li>
                    <li className="flex items-center gap-3 px-4 py-3.5 bg-[#F6F4FF] border-t border-secondary">
                        <span className="size-[30px] rounded-full bg-iris text-white flex items-center justify-center text-sm font-extrabold shrink-0">2</span>
                        <span className="flex-1 flex flex-col gap-0.5">
                            <span className="text-xs font-extrabold text-iris-strong">{wantsReturn ? 'COMING BACK' : 'GOING'}</span>
                            <span className="text-[15px] font-extrabold text-ink">{wantsReturn ? 'Pick a return bus' : 'Pick the bus leaving GIKI'}</span>
                        </span>
                    </li>
                </ol>

                <DayStrip days={days} selected={selectedDay} onSelect={setPickedDay} label={wantsReturn ? 'Return day' : 'Departure day'} />

                <h2 className="px-1 pt-1 text-xs font-extrabold tracking-[0.08em] uppercase text-muted-foreground">
                    {wantsReturn ? `${heldLeg.city} → GIKI` : `GIKI → ${heldLeg.city}`}
                </h2>
                {dayTrips.length === 0 ? (
                    <div className="bg-card rounded-[20px] p-6 text-center text-sm font-bold text-[#4A4766]">No buses on this day. Try another day.</div>
                ) : (
                    <ul className="flex flex-col gap-2.5">
                        {dayTrips.map(renderRow)}
                    </ul>
                )}

                <div className="fixed md:static left-0 right-0 bottom-[68px] md:bottom-auto z-30 bg-card md:rounded-[22px] rounded-t-[24px] px-5 pt-4 pb-9 md:pb-4 shadow-[0_-1px_0_#E6E5EE] md:shadow-none flex items-center justify-between gap-3">
                    <span className="text-sm text-[#4A4766]">
                        {heldLeg.seats} seat{heldLeg.seats === 1 ? '' : 's'} held · pick the {wantsReturn ? 'return' : 'outbound'} bus to continue
                    </span>
                    <span className="font-display text-lg font-extrabold text-ink tabular shrink-0">Rs {formatRs(heldLeg.seats * heldLeg.priceEach)}</span>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        // Same as switching Round trip off on the old screen: keep the held leg, pay for it alone.
                        setRoundTrip(false);
                        goToPayment();
                    }}
                    className="self-center h-11 px-4 rounded-xl text-sm font-extrabold text-iris-strong focus-visible:outline-2 focus-visible:outline-iris"
                >
                    Book one way instead
                </button>

                {abandon}
                <AbandonBookingModal
                    isOpen={confirmRelease}
                    timeLeft={timeLeft}
                    onClose={() => setConfirmRelease(false)}
                    onAbandon={() => {
                        setConfirmRelease(false);
                        void releaseAllHolds();
                    }}
                    onStay={() => setConfirmRelease(false)}
                />
            </div>
        );
    }

    // ---------- Rides board ----------
    return (
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-3.5 pt-1">
            {activeHolds.length > 0 && (
                <HoldTimerBar
                    timeLeft={timeLeft}
                    message={`${activeHolds.length} seat${activeHolds.length === 1 ? '' : 's'} held for you`}
                    actions={[
                        { label: 'Release All', onClick: () => void releaseAllHolds() },
                        // Held seats can always be paid for (even after a reload wipes the in-memory selection).
                        { label: 'Continue', onClick: goToPayment, primary: true },
                    ]}
                />
            )}

            <header className="flex items-center justify-between gap-3 flex-wrap">
                <h1 className="font-display font-extrabold text-[32px] tracking-tight text-ink leading-none">Rides</h1>
                {dirQuota && (
                    <span className="text-xs font-extrabold text-ink bg-card px-3 py-1.5 rounded-full">
                        {dirQuota.remaining} of {dirQuota.limit} seats left this week
                    </span>
                )}
            </header>

            <div role="tablist" aria-label="Direction" className="grid grid-cols-2 bg-secondary rounded-2xl p-1 gap-1">
                {(['OUTBOUND', 'INBOUND'] as const).map((d) => (
                    <button
                        key={d}
                        type="button"
                        role="tab"
                        aria-selected={direction === d}
                        onClick={() => {
                            setDirection(d);
                            setPickedDay(null);
                            setOpenTripId(null);
                        }}
                        className={cn(
                            'h-[42px] rounded-xl text-sm focus-visible:outline-2 focus-visible:outline-iris',
                            direction === d ? 'bg-card text-ink font-extrabold shadow-sm' : 'text-[#4A4766] font-semibold'
                        )}
                    >
                        {d === 'OUTBOUND' ? 'Leaving GIKI' : 'Back to GIKI'}
                    </button>
                ))}
            </div>

            <DayStrip days={days} selected={selectedDay} onSelect={setPickedDay} />

            <label
                className="flex items-center gap-3 bg-card rounded-2xl px-3.5 py-2.5"
                title={!canBookRoundTrip ? 'Insufficient quota for Round Trip (Requires 1 Outbound + 1 Inbound)' : undefined}
            >
                <ArrowLeftRight className="size-5 text-ink shrink-0" aria-hidden="true" />
                <span className="flex-1 text-sm font-bold text-ink">
                    Round trip{' '}
                    <span className="font-medium text-muted-foreground">
                        {!canBookRoundTrip && !isRoundTrip ? '· needs 1 seat each way in your quota' : '· book both ways'}
                    </span>
                </span>
                <Switch checked={isRoundTrip} onCheckedChange={setRoundTrip} disabled={!canBookRoundTrip && !isRoundTrip} aria-label="Round trip" />
            </label>

            {dirTrips.length === 0 ? (
                <div className="bg-card rounded-[22px] p-6 text-center flex flex-col items-center gap-2">
                    <span className="font-display text-lg font-extrabold text-ink">
                        No {direction === 'OUTBOUND' ? 'outbound' : 'return'} trips this week
                    </span>
                    <span className="text-[13px] text-muted-foreground">New buses appear here as soon as they're scheduled.</span>
                </div>
            ) : dayTrips.length === 0 ? (
                <div className="bg-card rounded-[22px] p-6 text-center flex flex-col items-center gap-2.5">
                    <span className="font-display text-lg font-extrabold text-ink">
                        No buses on {formatInTimeZone(new Date(`${selectedDay}T12:00:00+05:00`), TZ, 'EEEE')}
                    </span>
                    <button
                        type="button"
                        onClick={() => setPickedDay(firstDayWithTrips)}
                        className="h-11 px-4 rounded-[14px] bg-iris-tint text-[#2E1A99] text-sm font-extrabold focus-visible:outline-2 focus-visible:outline-iris"
                    >
                        Show {formatInTimeZone(new Date(`${firstDayWithTrips}T12:00:00+05:00`), TZ, 'EEEE')}
                    </button>
                </div>
            ) : (
                <ul className="flex flex-col gap-2.5">
                    {dayTrips.map(renderRow)}
                </ul>
            )}

            {abandon}
        </div>
    );
};

export default TransportPage;
