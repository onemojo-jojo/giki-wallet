import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bus, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTransportStore } from '../store';
import { formatDateTime } from '../utils';
import { PILL_CLASS, fmt, groupPast, splitTickets, ticketEnds, ticketPill } from '../ticketHelpers';

type Tab = 'upcoming' | 'past';

/** My tickets (v2-Tickets): upcoming passes and past rides. Route: /tickets/all */
export const TicketsPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { activeHolds, releaseAllHolds, fetchUserTickets, myTickets, loading } = useTransportStore();
    const [tab, setTab] = useState<Tab>('upcoming');
    const [loaded, setLoaded] = useState(false);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        void fetchUserTickets().finally(() => setLoaded(true));
    }, [fetchUserTickets]);

    // Re-split every minute so a ride moves to Past while the page is open.
    useEffect(() => {
        const t = window.setInterval(() => setNow(Date.now()), 60000);
        return () => window.clearInterval(t);
    }, []);

    const { upcoming, past } = useMemo(() => splitTickets(myTickets, now), [myTickets, now]);
    const pastGroups = useMemo(() => groupPast(past), [past]);

    // Back returns to wherever the user came from (the pass, Home…); a fresh visit goes to Rides.
    const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate('/transport'));

    return (
        <div className="max-w-xl mx-auto w-full flex flex-col gap-3.5 pt-1">
            <header className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={goBack}
                    aria-label="Back"
                    className="size-11 rounded-[14px] bg-card text-ink flex items-center justify-center shrink-0 focus-visible:outline-2 focus-visible:outline-iris"
                >
                    <ChevronLeft className="size-[22px]" strokeWidth={2.2} />
                </button>
                <h1 className="font-display font-extrabold text-2xl text-ink">My tickets</h1>
                {loading && <span className="ml-auto text-xs font-bold text-muted-foreground">Syncing…</span>}
            </header>

            {/* Seats held but not paid for yet — kept from the old page so they can still be released. */}
            {activeHolds.length > 0 && (
                <section aria-label="Seats on hold" className="flex flex-col gap-2">
                    {activeHolds.map((hold) => (
                        <div key={hold.id} className="flex items-center gap-3 bg-signal-tint rounded-[18px] px-4 py-3">
                            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                                <span className="text-sm font-extrabold text-[#4A2800] truncate">{hold.route_name}</span>
                                <span className="text-xs text-signal-text">Seat on hold · expires {formatDateTime(hold.expires_at)}</span>
                            </span>
                            <button
                                type="button"
                                onClick={() => void releaseAllHolds()}
                                className="h-9 px-3.5 rounded-xl bg-card text-signal-text text-[13px] font-extrabold shrink-0 focus-visible:outline-2 focus-visible:outline-signal"
                            >
                                Release
                            </button>
                        </div>
                    ))}
                </section>
            )}

            <div role="tablist" aria-label="Ticket filter" className="grid grid-cols-2 gap-1 bg-[#ECEBF2] rounded-2xl p-1">
                {(['upcoming', 'past'] as const).map((t) => (
                    <button
                        key={t}
                        type="button"
                        role="tab"
                        id={`tab-${t}`}
                        aria-selected={tab === t}
                        aria-controls={`panel-${t}`}
                        tabIndex={tab === t ? 0 : -1}
                        onClick={() => setTab(t)}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                                const next = t === 'upcoming' ? 'past' : 'upcoming';
                                setTab(next);
                                document.getElementById(`tab-${next}`)?.focus();
                            }
                        }}
                        className={cn(
                            'h-[42px] rounded-xl text-sm focus-visible:outline-2 focus-visible:outline-iris',
                            tab === t ? 'bg-card text-ink font-extrabold shadow-sm' : 'text-[#4A4766] font-semibold'
                        )}
                    >
                        {t === 'upcoming' ? `Upcoming${upcoming.length ? ` · ${upcoming.length}` : ''}` : 'Past'}
                    </button>
                ))}
            </div>

            {!loaded && myTickets.length === 0 ? (
                <div aria-busy="true" className="flex flex-col gap-3">
                    {[0, 1].map((i) => (
                        <div key={i} className="h-[92px] rounded-[22px] bg-card animate-pulse" />
                    ))}
                </div>
            ) : tab === 'upcoming' ? (
                <div role="tabpanel" id="panel-upcoming" aria-labelledby="tab-upcoming" className="flex flex-col gap-3">
                    {upcoming.length === 0 ? (
                        <div className="flex items-center gap-3.5 bg-card rounded-[22px] p-4">
                            <span className="size-12 rounded-[14px] bg-iris-tint text-iris-strong flex items-center justify-center shrink-0">
                                <Bus className="size-6" aria-hidden="true" />
                            </span>
                            <span className="flex-1 flex flex-col gap-0.5">
                                <span className="text-[15px] font-extrabold text-ink">No upcoming rides</span>
                                <span className="text-[13px] text-muted-foreground">Your passes show up here after you book.</span>
                            </span>
                            <Link to="/transport" className="h-10 px-3.5 rounded-xl bg-iris-tint text-iris-strong text-[13px] font-extrabold flex items-center shrink-0">
                                Book
                            </Link>
                        </div>
                    ) : (
                        upcoming.map((t, i) => {
                            const ends = ticketEnds(t);
                            const pill = ticketPill(t, now);
                            return (
                                <Link
                                    key={t.ticket_id}
                                    to={`/tickets/${t.ticket_id}`}
                                    state={{ fromList: true }}
                                    aria-label={`${ends.route}, ${fmt(t.departure_time, 'EEE d MMM, h:mm a')}. Open pass`}
                                    className="flex bg-card rounded-[22px] overflow-hidden text-ink hover:shadow-md transition-shadow focus-visible:outline-2 focus-visible:outline-iris"
                                >
                                    <span
                                        className={cn(
                                            'w-[74px] flex flex-col items-center justify-center gap-0.5 shrink-0',
                                            i === 0 ? 'bg-ink text-volt' : 'bg-iris-tint text-iris-strong'
                                        )}
                                    >
                                        <span className="text-[11px] font-extrabold uppercase">{fmt(t.departure_time, 'EEE')}</span>
                                        <span className="font-display text-[26px] font-extrabold leading-none">{fmt(t.departure_time, 'd')}</span>
                                        <span className="text-[11px] font-bold uppercase">{fmt(t.departure_time, 'MMM')}</span>
                                    </span>
                                    <span className="flex-1 min-w-0 px-4 py-3.5 flex flex-col gap-1.5 border-l-2 border-dashed border-line">
                                        <span className="flex items-center justify-between gap-2">
                                            <span className="text-base font-extrabold truncate">{ends.route}</span>
                                            <span className={cn('text-[11px] font-extrabold px-2.5 py-[3px] rounded-full shrink-0', PILL_CLASS[pill.tone])}>{pill.label}</span>
                                        </span>
                                        <span className="text-[13px] text-[#4A4766] truncate">
                                            {fmt(t.departure_time, 'h:mm a')} · {ends.riderStop}
                                        </span>
                                        <span className="font-mono text-xs text-muted-foreground truncate">
                                            {t.ticket_code} · #{String(t.serial_no).padStart(3, '0')}
                                            {!t.is_self && ` · ${t.passenger_name}`}
                                        </span>
                                    </span>
                                </Link>
                            );
                        })
                    )}
                </div>
            ) : (
                <div role="tabpanel" id="panel-past" aria-labelledby="tab-past" className="flex flex-col gap-3">
                    {pastGroups.length === 0 ? (
                        <p className="bg-card rounded-[22px] p-5 text-center text-sm font-semibold text-[#4A4766]">No cancelled or recently departed rides.</p>
                    ) : (
                        pastGroups.map((g) => (
                            <section key={g.key} aria-labelledby={`past-${g.key}`} className="flex flex-col gap-2.5">
                                <h2 id={`past-${g.key}`} className="mt-2 px-1 text-xs font-extrabold tracking-[0.08em] text-muted-foreground">
                                    {g.label}
                                </h2>
                                {g.tickets.map((t) => {
                                    const pill = ticketPill(t, now);
                                    return (
                                        <div key={t.ticket_id} className="flex items-center gap-3 bg-card rounded-[18px] px-4 py-3">
                                            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                                                <span className="text-sm font-extrabold text-ink truncate">{ticketEnds(t).route}</span>
                                                <span className="text-xs text-muted-foreground truncate">
                                                    {fmt(t.departure_time, 'EEE d MMM · h:mm a')}
                                                    {!t.is_self && ` · ${t.passenger_name}`}
                                                </span>
                                            </span>
                                            <span className={cn('text-[11px] font-extrabold px-2.5 py-[3px] rounded-full shrink-0', PILL_CLASS[pill.tone])}>{pill.label}</span>
                                        </div>
                                    );
                                })}
                            </section>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
