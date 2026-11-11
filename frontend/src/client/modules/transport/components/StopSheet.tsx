import { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Modal } from '@/shared/components/ui/Modal';
import { cn } from '@/lib/utils';
import type { Trip } from '../validators';
import { cityOf, formatRs, riderStops, timeParts } from '../bookingHelpers';
import { formatDate } from '../utils';

interface StopSheetProps {
    trip: Trip | null;
    direction: 'OUTBOUND' | 'INBOUND';
    isStudent: boolean;
    /** Remaining weekly quota for this direction (null = unknown). */
    quotaRemaining: number | null;
    busy: boolean;
    onClose: () => void;
    onHold: (stopId: string, ticketCount: number) => void;
}

/**
 * Sheet opened from a departure's fare button: choose your stop (and, for
 * staff, how many seats), then hold the seat(s). The backend needs the stop
 * before it can hold a seat.
 */
export const StopSheet = ({ trip, direction, isStudent, quotaRemaining, busy, onClose, onHold }: StopSheetProps) => {
    const stops = useMemo(() => (trip ? riderStops(trip) : []), [trip]);
    // Parent renders this with key={trip.id}, so state starts fresh per trip; auto-pick the only stop.
    const [stopId, setStopId] = useState<string | null>(() => (stops.length === 1 ? stops[0].stop_id : null));
    const [count, setCount] = useState(1);

    const maxTickets = trip ? Math.max(1, Math.min(3, trip.available_seats, quotaRemaining ?? 3)) : 1;
    const seats = isStudent ? 1 : count;

    if (!trip) return null;
    const { time, ampm } = timeParts(trip.departure_time);
    const city = cityOf(trip.route_name);

    return (
        <Modal isOpen={!!trip} onClose={onClose} title={direction === 'OUTBOUND' ? `To ${city}` : `${city} to GIKI`} size="md">
            <div className="flex flex-col gap-4">
                <p className="text-sm font-bold text-[#4A4766] -mt-2">
                    {formatDate(trip.departure_time)} · {time} {ampm} · {trip.available_seats} seats left
                </p>

                <fieldset className="flex flex-col gap-2">
                    <legend className="flex items-center gap-1.5 text-xs font-extrabold text-muted-foreground uppercase tracking-[0.06em] mb-2">
                        <MapPin className="size-3.5" aria-hidden="true" />
                        {direction === 'OUTBOUND' ? 'Drop-off stop' : 'Pickup stop'}
                    </legend>
                    <div className="bg-card rounded-[18px] border border-line overflow-hidden">
                        {stops.map((s, i) => (
                            <label
                                key={s.stop_id}
                                className={cn(
                                    'flex items-center gap-3 px-4 min-h-[52px] cursor-pointer',
                                    i > 0 && 'border-t border-[#F0EFF5]',
                                    stopId === s.stop_id && 'bg-[#F6F4FF]'
                                )}
                            >
                                <input
                                    type="radio"
                                    name="stop"
                                    checked={stopId === s.stop_id}
                                    onChange={() => setStopId(s.stop_id)}
                                    className="size-5 accent-iris"
                                />
                                <span className={cn('flex-1 text-[15px]', stopId === s.stop_id ? 'font-extrabold text-ink' : 'font-semibold text-ink')}>
                                    {s.stop_name}
                                </span>
                                <span className="text-xs font-semibold text-muted-foreground">
                                    {i === 0 ? '1st stop' : i === stops.length - 1 ? 'Last stop' : `Stop ${i + 1}`}
                                </span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                {!isStudent ? (
                    <div className="flex items-center justify-between bg-background rounded-2xl px-4 py-2.5">
                        <span id="seat-count" className="text-sm font-bold text-ink">
                            Seats <span className="text-xs font-semibold text-muted-foreground">(max {maxTickets})</span>
                        </span>
                        <div className="flex items-center gap-3" role="group" aria-labelledby="seat-count">
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
                ) : (
                    <p className="text-xs font-semibold text-muted-foreground">Students book 1 seat per trip.</p>
                )}

                <button
                    type="button"
                    disabled={!stopId || busy}
                    onClick={() => stopId && onHold(stopId, seats)}
                    className="h-14 rounded-[18px] bg-ink text-white text-base font-extrabold flex items-center justify-between px-5 disabled:bg-secondary disabled:text-[#6E6B88] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                >
                    <span>{busy ? 'Holding…' : !stopId ? 'Choose a stop' : `Hold ${seats > 1 ? `${seats} seats` : 'seat'}`}</span>
                    <span className="font-display text-volt tabular">Rs {formatRs(trip.base_price * seats)}</span>
                </button>
            </div>
        </Modal>
    );
};
