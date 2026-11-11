import type { ReactNode } from 'react';
import { Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Trip } from '../validators';
import { cityOf, countdownText, formatRs, riderStops, timeParts } from '../bookingHelpers';
import { formatTime12 } from '../utils';

interface DepartureRowProps {
    trip: Trip;
    isHeld: boolean;
    now: number;
    onBook: (trip: Trip) => void;
    /** The fare was tapped: the stop picker (children) shows inside the row. */
    expanded?: boolean;
    children?: ReactNode;
}

/** One departure on the Rides board: time · city · seats/opening · fare button (expands in place to book). */
export const DepartureRow = ({ trip, isHeld, now, onBook, expanded, children }: DepartureRowProps) => {
    const status = trip.status.toUpperCase();
    const full = trip.available_seats <= 0 || status === 'FULL';
    const scheduled = status === 'SCHEDULED';
    const closed = status === 'CLOSED';
    const cancelled = status === 'CANCELLED';
    const open = !full && !scheduled && !closed && !cancelled;
    const low = open && trip.available_seats <= 5;

    const { time, ampm } = timeParts(trip.departure_time);
    const city = cityOf(trip.route_name);
    const stops = riderStops(trip).map((s) => s.stop_name);

    let sub: string;
    let subClass: string;
    if (cancelled) {
        sub = 'Cancelled';
        subClass = 'text-coral';
    } else if (closed) {
        sub = 'Booking closed';
        subClass = 'text-muted-foreground';
    } else if (scheduled) {
        sub = `Opens at ${formatTime12(trip.booking_opens_at)} · ${countdownText(trip.booking_opens_at, now)}`;
        subClass = 'text-signal-text';
    } else if (full) {
        sub = 'No seats left';
        subClass = 'text-muted-foreground';
    } else if (low) {
        sub = `Only ${trip.available_seats} seat${trip.available_seats === 1 ? '' : 's'} left`;
        subClass = 'text-[#B35F00]';
    } else {
        sub = `${trip.available_seats} seats${stops.length ? ` · ${stops.join(', ')}` : ''}`;
        subClass = 'text-mint';
    }

    return (
        <li className={cn('bg-card rounded-[20px] px-4 py-3.5', expanded && 'ring-2 ring-iris')}>
            <div className="flex items-center gap-3.5">
            <span className="flex flex-col w-[58px] shrink-0">
                <span className={cn('font-display text-[22px] font-extrabold tracking-tight leading-none', open ? 'text-ink' : 'text-[#4A4766]')}>{time}</span>
                <span className="text-[11px] font-extrabold text-muted-foreground">{ampm}</span>
            </span>
            <span className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="text-base font-extrabold text-ink truncate">{city}</span>
                <span className={cn('text-xs font-bold line-clamp-2', subClass)}>{sub}</span>
            </span>
            {isHeld ? (
                <span className="h-11 px-3 rounded-[14px] bg-mint-tint text-mint text-[13px] font-extrabold flex items-center gap-1.5 shrink-0">
                    <Check className="size-4" strokeWidth={3} aria-hidden="true" />
                    Held
                </span>
            ) : open ? (
                <button
                    type="button"
                    onClick={() => onBook(trip)}
                    id={`fare-${trip.id}`}
                    aria-expanded={expanded ? true : false}
                    aria-controls={`picker-${trip.id}`}
                    aria-label={`Book ${city}, ${time} ${ampm}, Rs ${formatRs(trip.base_price)}`}
                    className={cn(
                        'h-11 px-4 rounded-[14px] text-sm font-extrabold shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris',
                        expanded ? 'bg-iris text-white' : 'bg-ink text-white'
                    )}
                >
                    Rs {formatRs(trip.base_price)}
                </button>
            ) : scheduled ? (
                <span
                    className="size-11 rounded-[14px] bg-signal-tint text-signal-text flex items-center justify-center shrink-0"
                    title={`Booking opens at ${formatTime12(trip.booking_opens_at)}`}
                >
                    <Lock className="size-5" aria-hidden="true" />
                    <span className="sr-only">Not open yet</span>
                </span>
            ) : (
                <span className="h-11 px-3.5 rounded-[14px] bg-secondary text-[#4A4766] text-sm font-extrabold flex items-center shrink-0">
                    {cancelled ? 'Cancelled' : closed ? 'Closed' : 'Full'}
                </span>
            )}
            </div>
            {expanded && open && !isHeld && <div id={`picker-${trip.id}`}>{children}</div>}
        </li>
    );
};
