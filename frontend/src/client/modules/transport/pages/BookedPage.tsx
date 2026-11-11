import { Link, Navigate, useLocation } from 'react-router-dom';
import { Check } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { downloadCalendar, formatRs, TZ, type LegSummary } from '../bookingHelpers';

type BookedState = { legs: LegSummary[]; total: number } | null;

/** Success screen after paying for a booking. */
export const BookedPage = () => {
    const state = useLocation().state as BookedState;
    if (!state || !state.legs?.length) return <Navigate to="/tickets" replace />;

    const { legs, total } = state;
    const first = legs[0];
    const seats = legs.reduce((n, l) => n + l.seats, 0);
    const headline = first.direction === 'OUTBOUND' ? `You're going to ${first.city}.` : "You're heading back to GIKI.";

    return (
        <div className="-mx-4 lg:-mx-6 -mt-4 md:mt-0 md:mx-auto md:max-w-xl md:rounded-[28px] relative overflow-hidden bg-ink text-white px-5 pt-6 pb-16 md:pb-8 min-h-[calc(100vh-5rem)] md:min-h-0 flex flex-col gap-6">
            <svg aria-hidden="true" className="absolute left-0 top-0 w-full h-[360px] pointer-events-none" viewBox="0 0 390 360" preserveAspectRatio="none" fill="none">
                <path d="M-10 300 C 80 250, 120 140, 200 160 S 330 80, 400 40" stroke="#C8F04A" strokeOpacity="0.4" strokeWidth="2.5" strokeDasharray="1 11" strokeLinecap="round" />
            </svg>

            <div className="relative mt-14 flex flex-col gap-3" role="status">
                <span className="self-start flex items-center gap-1.5 text-xs font-extrabold text-ink bg-volt px-3 py-1.5 rounded-full">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                    Paid Rs {formatRs(total)}
                </span>
                <h1 className="font-display font-extrabold text-[40px] leading-none tracking-tight">{headline}</h1>
                <p className="text-[15px] text-[#D9D6F2]">
                    {seats === 1 ? 'Your pass is ready in My Tickets.' : `${seats} passes are ready in My Tickets.`} Show it to the driver when you board.
                </p>
            </div>

            <ul className="relative flex flex-col gap-2.5">
                {legs.map((l) => (
                    <li key={l.tripId} className="flex items-center gap-3.5 bg-ink-2 rounded-[20px] p-3.5">
                        <span className="w-[50px] h-[54px] rounded-[14px] bg-card text-ink flex flex-col items-center justify-center shrink-0">
                            <span className="text-[11px] font-extrabold uppercase">{formatInTimeZone(new Date(l.departure), TZ, 'EEE')}</span>
                            <span className="font-display text-xl font-extrabold leading-none">{formatInTimeZone(new Date(l.departure), TZ, 'd')}</span>
                        </span>
                        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <span className="text-[15px] font-extrabold truncate">{l.routeName}</span>
                            <span className="text-[13px] text-[#D9D6F2] truncate">
                                {formatInTimeZone(new Date(l.departure), TZ, 'h:mm a')} · {l.stopName}
                            </span>
                        </span>
                        {l.seats > 1 && <span className="font-mono text-xs text-volt shrink-0">×{l.seats}</span>}
                    </li>
                ))}
            </ul>

            <div className="relative mt-auto flex flex-col gap-2.5">
                <Link to="/tickets" className="h-14 rounded-[18px] bg-volt text-ink text-base font-extrabold flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt">
                    View passes
                </Link>
                <button
                    type="button"
                    onClick={() => downloadCalendar(legs)}
                    className="h-[50px] rounded-2xl border-[1.5px] border-[#4A4580] text-white text-[15px] font-bold focus-visible:outline-2 focus-visible:outline-volt"
                >
                    {legs.length > 1 ? 'Add both to calendar' : 'Add to calendar'}
                </button>
                <Link to="/" className="h-10 flex items-center justify-center text-sm font-bold text-[#D9D6F2] rounded-xl focus-visible:outline-2 focus-visible:outline-volt">
                    Back to home
                </Link>
            </div>
        </div>
    );
};

export default BookedPage;
