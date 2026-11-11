import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LogoMark } from '@/shared/components/ui/Logo';
import { useTransportStore } from '../store';
import { formatRs } from '../bookingHelpers';
import { PILL_CLASS, fmt, isCancelledStatus, isUpcoming, passengerLabel, splitTickets, ticketEnds, ticketPill } from '../ticketHelpers';
import type { MyTicket } from '../validators';
import { useWalletModuleStore } from '@/client/modules/wallet/store';
import { QrCode } from '../components/QrCode';
import { CancelRideSheet } from '../components/CancelRideSheet';

/** Keep the screen awake while a pass is showing (where the browser supports it). */
const useWakeLock = () => {
    useEffect(() => {
        let lock: WakeLockSentinel | null = null;
        let cancelled = false;
        const request = async () => {
            try {
                const l = await navigator.wakeLock?.request('screen');
                if (cancelled) void l?.release();
                else lock = l ?? null;
            } catch {
                /* not supported or not allowed */
            }
        };
        void request();
        const onVisible = () => document.visibilityState === 'visible' && void request();
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onVisible);
            void lock?.release();
        };
    }, []);
};

/**
 * Boarding pass (v2-Pass). /tickets shows the next upcoming pass; /tickets/:id a specific one.
 * Swipe or use the dots to move between upcoming passes.
 */
export const PassPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { myTickets, fetchUserTickets, cancelTicket } = useTransportStore();
    const [loaded, setLoaded] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    // The ticket the cancel sheet is about — pinned when it opens so nothing can swap it mid-flow.
    const [cancelTarget, setCancelTarget] = useState<MyTicket | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const touch = useRef<{ x: number; y: number } | null>(null);
    const cancelBtnRef = useRef<HTMLButtonElement>(null);
    const fromList = !!(location.state as { fromList?: boolean } | null)?.fromList;
    useWakeLock();

    useEffect(() => {
        void fetchUserTickets().finally(() => setLoaded(true));
    }, [fetchUserTickets]);

    useEffect(() => {
        const t = window.setInterval(() => setNow(Date.now()), 60000);
        return () => window.clearInterval(t);
    }, []);

    const { upcoming } = useMemo(() => splitTickets(myTickets, now), [myTickets, now]);
    const current = id ? myTickets.find((t) => t.ticket_id === id) : upcoming[0];
    // While the sheet is open, keep showing the ticket being cancelled.
    const ticket = cancelTarget ?? current;
    const index = ticket ? upcoming.findIndex((t) => t.ticket_id === ticket.ticket_id) : -1;

    const close = () => (location.key !== 'default' ? navigate(-1) : navigate('/'));
    const goTo = (i: number) => {
        const t = upcoming[i];
        if (t && !cancelTarget) navigate(`/tickets/${t.ticket_id}`, { replace: true, state: location.state });
    };
    const closeSheet = () => {
        setCancelTarget(null);
        window.setTimeout(() => cancelBtnRef.current?.focus(), 0);
    };

    if (!ticket) {
        if (!loaded) {
            return (
                <div className="fixed inset-0 z-[60] bg-volt flex items-center justify-center" aria-busy="true">
                    <span className="text-sm font-extrabold text-ink">Loading your pass…</span>
                </div>
            );
        }
        // Nothing to show: the ticket list explains why and offers booking.
        return <Navigate to="/tickets/all" replace />;
    }

    const ends = ticketEnds(ticket);
    const pill = ticketPill(ticket, now);
    const isCancelled = isCancelledStatus(ticket.status);
    // Only a live, upcoming ticket gets a scannable code.
    const valid = isUpcoming(ticket, now);
    const canCancel = valid && ticket.is_cancellable;
    const busLabel = `${(ticket.bus_type || 'Student').toUpperCase()} BUS`;

    const confirmCancel = async () => {
        if (!cancelTarget || cancelling) return;
        setCancelling(true);
        // The store shows success / "too late" / error toasts itself.
        const ok = await cancelTicket(cancelTarget.ticket_id);
        setCancelling(false);
        if (ok) {
            setCancelTarget(null);
            void useWalletModuleStore.getState().fetchBalance();
            navigate('/tickets/all', { replace: true });
        } else {
            closeSheet();
        }
    };

    return (
        <>
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pass-title"
            inert={cancelTarget ? true : undefined}
            className="fixed inset-0 z-[60] bg-volt text-ink overflow-y-auto"
            onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
            onTouchEnd={(e) => {
                const start = touch.current;
                touch.current = null;
                if (!start || index < 0 || cancelTarget) return;
                const dx = e.changedTouches[0].clientX - start.x;
                const dy = e.changedTouches[0].clientY - start.y;
                if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) goTo(dx < 0 ? index + 1 : index - 1);
            }}
        >
            <div className="max-w-[430px] min-h-full mx-auto px-5 pt-4 pb-6 flex flex-col gap-3.5">
                <header className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={close}
                        aria-label="Close"
                        className="size-11 rounded-[14px] bg-ink/[0.08] text-ink flex items-center justify-center focus-visible:outline-2 focus-visible:outline-ink"
                    >
                        <X className="size-5" strokeWidth={2.4} />
                    </button>
                    <h1 id="pass-title" className="text-sm font-extrabold">{index >= 0 ? `Pass ${index + 1} of ${upcoming.length}` : 'Your pass'}</h1>
                    {/* A reminder for the gate scanner, not a control. */}
                    <span className="text-xs font-extrabold bg-ink text-volt px-2.5 py-1.5 rounded-[10px]" aria-label="Tip: turn your screen brightness up">
                        Brightness max
                    </span>
                </header>

                <article className={cn('bg-card rounded-[28px] overflow-hidden', isCancelled && 'opacity-70')} aria-label={`Pass for ${ends.route}`}>
                    <div className="bg-ink text-white px-5 py-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 text-xs font-extrabold tracking-[0.08em] text-ink-muted">
                                <LogoMark size={20} tone="volt" />
                                {busLabel}
                            </span>
                            <span className={cn('text-xs font-extrabold px-2.5 py-1 rounded-full', pill.tone === 'paid' ? 'bg-volt text-ink' : PILL_CLASS[pill.tone])}>{pill.label}</span>
                        </div>
                        <div className="flex items-end justify-between gap-2">
                            <span className="flex flex-col min-w-0">
                                <span className="font-display text-[44px] font-extrabold tracking-[-0.04em] leading-none">{ends.fromCode}</span>
                                <span className="text-xs text-ink-muted truncate">{ends.fromStop}</span>
                            </span>
                            <span className="font-display text-lg font-extrabold text-volt pb-5 shrink-0">{fmt(ticket.departure_time, 'h:mm a')}</span>
                            <span className="flex flex-col items-end min-w-0">
                                <span className="font-display text-[44px] font-extrabold tracking-[-0.04em] leading-none">{ends.toCode}</span>
                                <span className="text-xs text-ink-muted truncate">{ends.toStop}</span>
                            </span>
                        </div>
                    </div>

                    <div className="px-5 pt-[18px] pb-1.5 flex flex-col items-center gap-3">
                        {valid ? (
                            <div role="img" aria-label={`Boarding QR code for ticket ${ticket.ticket_code}`} className="p-2.5 rounded-2xl border-[1.5px] border-line text-ink">
                                <QrCode value={ticket.ticket_code} size={176} />
                            </div>
                        ) : (
                            // Cancelled or departed: no scannable code.
                            <div className="size-[198px] rounded-2xl border-[1.5px] border-dashed border-[#D9D7E5] bg-background flex flex-col items-center justify-center gap-1 text-center px-4">
                                <span className="text-base font-extrabold text-ink">{isCancelled ? 'Ride cancelled' : 'Bus has left'}</span>
                                <span className="text-xs text-muted-foreground">This pass can't be used to board.</span>
                            </div>
                        )}
                        <span className={cn('font-mono text-xl font-semibold tracking-[0.1em]', !valid && 'line-through text-muted-foreground')}>{ticket.ticket_code}</span>
                    </div>

                    <div aria-hidden="true" className="relative h-6">
                        <span className="absolute -left-3 top-0 size-6 rounded-full bg-volt" />
                        <span className="absolute left-5 right-5 top-[11px] border-t-2 border-dashed border-line" />
                        <span className="absolute -right-3 top-0 size-6 rounded-full bg-volt" />
                    </div>

                    <dl className="px-5 pt-1 pb-[18px] grid grid-cols-3 gap-2.5">
                        <div>
                            <dt className="text-[11px] text-muted-foreground">Date</dt>
                            <dd className="mt-0.5 text-sm font-extrabold">{fmt(ticket.departure_time, 'EEE d MMM')}</dd>
                        </div>
                        <div>
                            <dt className="text-[11px] text-muted-foreground">Serial</dt>
                            <dd className="mt-0.5 text-sm font-extrabold font-mono">#{String(ticket.serial_no).padStart(3, '0')}</dd>
                        </div>
                        <div>
                            <dt className="text-[11px] text-muted-foreground">Fare</dt>
                            <dd className="mt-0.5 text-sm font-extrabold">{ticket.price > 0 ? `Rs ${formatRs(ticket.price)}` : 'Free'}</dd>
                        </div>
                        <div className="col-span-3">
                            <dt className="text-[11px] text-muted-foreground">Passenger</dt>
                            <dd className="mt-0.5 text-sm font-extrabold">{passengerLabel(ticket)}</dd>
                        </div>
                    </dl>
                </article>

                {upcoming.length > 1 && index >= 0 && (
                    <div className="flex justify-center gap-1.5">
                        {upcoming.map((t, i) => (
                            <button
                                key={t.ticket_id}
                                type="button"
                                onClick={() => goTo(i)}
                                aria-label={`Pass ${i + 1} of ${upcoming.length}`}
                                aria-current={i === index ? 'true' : undefined}
                                className="h-6 flex items-center focus-visible:outline-2 focus-visible:outline-ink rounded"
                            >
                                <span className={cn('h-1.5 rounded-full', i === index ? 'w-[22px] bg-ink' : 'w-1.5 bg-ink/30')} />
                            </button>
                        ))}
                    </div>
                )}

                {!canCancel && !isCancelled && pill.tone === 'paid' && (
                    <p className="text-center text-[13px] font-semibold text-ink/80">Booking has closed for this bus, so it can't be cancelled.</p>
                )}

                <div className={cn('mt-auto grid gap-2.5', canCancel ? 'grid-cols-2' : 'grid-cols-1')}>
                    {fromList ? (
                        // Came from the list: go back instead of stacking another list entry.
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="h-[50px] rounded-2xl bg-ink text-white text-[15px] font-extrabold flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                        >
                            All tickets
                        </button>
                    ) : (
                        <Link
                            to="/tickets/all"
                            className="h-[50px] rounded-2xl bg-ink text-white text-[15px] font-extrabold flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                        >
                            All tickets
                        </Link>
                    )}
                    {canCancel && (
                        <button
                            type="button"
                            ref={cancelBtnRef}
                            onClick={() => setCancelTarget(ticket)}
                            className="h-[50px] rounded-2xl border-2 border-ink text-ink text-[15px] font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                        >
                            Cancel ride
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* Outside the swipeable overlay so drags on the sheet can't change passes. */}
        {cancelTarget && (
            <CancelRideSheet
                ticket={cancelTarget}
                otherUpcoming={upcoming.filter((t) => t.ticket_id !== cancelTarget.ticket_id).length}
                pending={cancelling}
                onConfirm={() => void confirmCancel()}
                onClose={closeSheet}
            />
        )}
        </>
    );
};

export default PassPage;
