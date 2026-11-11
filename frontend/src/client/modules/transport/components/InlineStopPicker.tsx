import { useMemo, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Trip } from '../validators';
import { formatRs, riderStops } from '../bookingHelpers';

const lastStopKey = (trip: Trip) => `gw.lastStop.${trip.route_id}.${trip.direction.toUpperCase()}`;

const readLastStop = (trip: Trip) => {
    try {
        return localStorage.getItem(lastStopKey(trip));
    } catch {
        return null;
    }
};

const rememberStop = (trip: Trip, stopId: string) => {
    try {
        localStorage.setItem(lastStopKey(trip), stopId);
    } catch {
        /* storage unavailable */
    }
};

interface InlineStopPickerProps {
    trip: Trip;
    isStudent: boolean;
    /** Remaining weekly quota for this direction (null = unknown). */
    quotaRemaining: number | null;
    busy: boolean;
    onHold: (stopId: string, ticketCount: number) => void;
    onCancel: () => void;
}

/**
 * Opens inside a departure row (no popup): pick your stop — and for staff, how many
 * seats — then hold. The backend needs the stop before it can hold a seat.
 */
export const InlineStopPicker = ({ trip, isStudent, quotaRemaining, busy, onHold, onCancel }: InlineStopPickerProps) => {
    const stops = useMemo(() => riderStops(trip), [trip]);
    const outbound = trip.direction.toUpperCase() === 'OUTBOUND';
    // Pre-pick: the only stop, else the one used last time on this route.
    const [stopId, setStopId] = useState<string | null>(() => {
        if (stops.length === 1) return stops[0].stop_id;
        const last = readLastStop(trip);
        return stops.some((s) => s.stop_id === last) ? last : null;
    });
    const [count, setCount] = useState(1);
    const maxTickets = Math.max(1, Math.min(3, trip.available_seats, quotaRemaining ?? 3));
    const seats = isStudent ? 1 : count;

    return (
        <div className="mt-3 pt-3 border-t border-[#F0EFF5] flex flex-col gap-3">
            <fieldset className="flex flex-col gap-2">
                <legend className="flex items-center gap-1.5 text-xs font-extrabold text-muted-foreground uppercase tracking-[0.06em] mb-2">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {outbound ? 'Where do you get off?' : 'Where do you get on?'}
                </legend>
                <div className="flex flex-wrap gap-2">
                    {stops.map((s) => {
                        const on = stopId === s.stop_id;
                        return (
                            <label
                                key={s.stop_id}
                                className={cn(
                                    'h-11 px-3.5 rounded-[14px] flex items-center text-sm cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-iris',
                                    on ? 'bg-ink text-white font-extrabold' : 'bg-background text-ink font-semibold'
                                )}
                            >
                                <input type="radio" name={`stop-${trip.id}`} checked={on} onChange={() => setStopId(s.stop_id)} className="sr-only" />
                                {s.stop_name}
                            </label>
                        );
                    })}
                </div>
            </fieldset>

            {!isStudent && (
                <div className="flex items-center justify-between bg-background rounded-2xl px-4 py-1.5">
                    <span id={`seats-${trip.id}`} className="text-sm font-bold text-ink">
                        Seats <span className="text-xs font-semibold text-muted-foreground">(you + family, max {maxTickets})</span>
                    </span>
                    <div className="flex items-center gap-3" role="group" aria-labelledby={`seats-${trip.id}`}>
                        <button
                            type="button"
                            onClick={() => setCount((c) => Math.max(1, c - 1))}
                            disabled={count <= 1}
                            aria-label="One fewer seat"
                            className="size-11 rounded-xl bg-card text-ink font-extrabold text-xl disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-iris"
                        >
                            −
                        </button>
                        <span className="font-display text-2xl font-extrabold text-ink min-w-[2ch] text-center" aria-live="polite">
                            {count}
                        </span>
                        <button
                            type="button"
                            onClick={() => setCount((c) => Math.min(maxTickets, c + 1))}
                            disabled={count >= maxTickets}
                            aria-label="One more seat"
                            className="size-11 rounded-xl bg-card text-ink font-extrabold text-xl disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-iris"
                        >
                            +
                        </button>
                    </div>
                </div>
            )}

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={busy}
                    className="h-[50px] px-4 rounded-2xl text-sm font-extrabold text-[#4A4766] focus-visible:outline-2 focus-visible:outline-iris"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={!stopId || busy}
                    onClick={() => {
                        if (!stopId) return;
                        rememberStop(trip, stopId);
                        onHold(stopId, seats);
                    }}
                    className="flex-1 h-[50px] rounded-2xl bg-ink text-white text-[15px] font-extrabold flex items-center justify-between px-4 disabled:bg-secondary disabled:text-[#6E6B88] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                >
                    <span className="flex items-center gap-2">
                        {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                        {busy ? 'Holding…' : !stopId ? 'Pick your stop' : `Hold ${seats > 1 ? `${seats} seats` : 'seat'}`}
                    </span>
                    <span className="font-display text-volt tabular">Rs {formatRs(trip.base_price * seats)}</span>
                </button>
            </div>
        </div>
    );
};
