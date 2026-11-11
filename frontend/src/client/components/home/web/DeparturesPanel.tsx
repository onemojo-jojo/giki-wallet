import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import { cn } from '@/lib/utils';
import { useTransportStore } from '@/client/modules/transport/store';
import { TZ, cityOf, dayKey, formatRs, riderStops } from '@/client/modules/transport/bookingHelpers';
import type { Trip } from '@/client/modules/transport/validators';

type Dir = 'OUTBOUND' | 'INBOUND';

const rowState = (t: Trip) => {
    const status = t.status.toUpperCase();
    if (status === 'SCHEDULED') return 'soon' as const;
    if (status === 'CLOSED') return 'closed' as const;
    if (t.available_seats <= 0 || status === 'FULL') return 'full' as const;
    return 'open' as const;
};

/** Web home departures table (v2-Web): next day with buses, either direction. Book opens Rides with that bus's stop picker. */
export const DeparturesPanel = () => {
    const { allTrips, initialized, fetchData } = useTransportStore();
    const [dir, setDir] = useState<Dir>('OUTBOUND');
    const [now] = useState(() => Date.now());

    useEffect(() => {
        void fetchData(!initialized);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { day, trips } = useMemo(() => {
        const today = dayKey(new Date(now));
        const list = allTrips
            .filter((t) => t.direction.toUpperCase() === dir && !['CANCELLED', 'DELETED'].includes(t.status.toUpperCase()))
            .filter((t) => dayKey(t.departure_time) >= today)
            .sort((a, b) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime());
        const first = list[0] ? dayKey(list[0].departure_time) : null;
        return { day: first, trips: first ? list.filter((t) => dayKey(t.departure_time) === first) : [] };
    }, [allTrips, dir, now]);

    const dayLabel = day ? formatInTimeZone(new Date(`${day}T12:00:00+05:00`), TZ, 'EEEE d MMM') : null;

    return (
        <section aria-labelledby="web-departures" className="bg-card rounded-3xl p-5 flex flex-col gap-3.5">
            <div className="flex flex-wrap justify-between items-center gap-3">
                <h2 id="web-departures" className="font-display text-xl font-extrabold text-ink">
                    {dir === 'OUTBOUND' ? 'Leaving GIKI' : 'Back to GIKI'}
                    {dayLabel ? ` · ${dayLabel}` : ''}
                </h2>
                <div role="tablist" aria-label="Direction" className="flex bg-[#ECEBF2] rounded-[14px] p-1 gap-1">
                    {(['OUTBOUND', 'INBOUND'] as const).map((d) => (
                        <button
                            key={d}
                            type="button"
                            role="tab"
                            aria-selected={dir === d}
                            onClick={() => setDir(d)}
                            className={cn(
                                'h-9 px-3.5 rounded-[10px] text-[13px] focus-visible:outline-2 focus-visible:outline-iris',
                                dir === d ? 'bg-card text-ink font-extrabold' : 'text-[#4A4766] font-semibold'
                            )}
                        >
                            {d === 'OUTBOUND' ? 'Leaving' : 'Back to GIKI'}
                        </button>
                    ))}
                </div>
            </div>

            {!initialized ? (
                <div aria-busy="true" className="flex flex-col gap-2">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-12 rounded-xl bg-background" />
                    ))}
                </div>
            ) : trips.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                    No {dir === 'OUTBOUND' ? 'buses leaving GIKI' : 'buses back to GIKI'} scheduled yet.{' '}
                    <Link to="/transport" className="font-extrabold text-iris-strong hover:underline">
                        Open Rides
                    </Link>
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] border-collapse text-sm">
                        <thead>
                            <tr className="text-left text-xs text-muted-foreground">
                                <th scope="col" className="px-2.5 py-2 font-extrabold">TIME</th>
                                <th scope="col" className="px-2.5 py-2 font-extrabold">{dir === 'OUTBOUND' ? 'TO' : 'FROM'}</th>
                                <th scope="col" className="px-2.5 py-2 font-extrabold">STOPS</th>
                                <th scope="col" className="px-2.5 py-2 font-extrabold">SEATS</th>
                                <th scope="col" className="px-2.5 py-2"><span className="sr-only">Action</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {trips.map((t) => {
                                const state = rowState(t);
                                const city = cityOf(t.route_name);
                                const time = formatInTimeZone(new Date(t.departure_time), TZ, 'h:mm a');
                                const seats =
                                    state === 'soon'
                                        ? `Opens ${formatInTimeZone(new Date(t.booking_opens_at), TZ, 'h:mm a')}`
                                        : state === 'full'
                                          ? 'Full'
                                          : state === 'closed'
                                            ? 'Closed'
                                            : `${t.available_seats} left`;
                                const seatClass =
                                    state === 'soon' ? 'text-signal-text' : state === 'open' ? (t.available_seats <= 5 ? 'text-[#B35F00]' : 'text-mint') : 'text-muted-foreground';
                                return (
                                    <tr key={t.id} className="border-t border-[#F0EFF5]">
                                        <td className="px-2.5 py-3.5 font-display text-lg font-extrabold text-ink whitespace-nowrap">{time}</td>
                                        <td className="px-2.5 py-3.5 font-extrabold text-ink">{city}</td>
                                        <td className="px-2.5 py-3.5 text-[#4A4766]">{riderStops(t).map((s) => s.stop_name).join(', ')}</td>
                                        <td className={cn('px-2.5 py-3.5 font-bold whitespace-nowrap', seatClass)}>{seats}</td>
                                        <td className="px-2.5 py-3.5 text-right">
                                            {state === 'open' ? (
                                                <Link
                                                    to="/transport"
                                                    state={{ openTripId: t.id, direction: dir, day }}
                                                    aria-label={`Book ${city}, ${time}, Rs ${formatRs(t.base_price)}`}
                                                    className="inline-flex items-center h-[38px] px-3.5 rounded-xl bg-ink text-white text-[13px] font-extrabold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                                                >
                                                    Book · Rs {formatRs(t.base_price)}
                                                </Link>
                                            ) : (
                                                <span
                                                    className={cn(
                                                        'inline-flex items-center h-[38px] px-3.5 rounded-xl text-[13px] font-extrabold whitespace-nowrap',
                                                        state === 'soon' ? 'bg-signal-tint text-signal-text' : 'bg-[#ECEBF2] text-[#4A4766]'
                                                    )}
                                                >
                                                    {state === 'soon' ? 'Not open yet' : state === 'closed' ? 'Closed' : 'Full'}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};
