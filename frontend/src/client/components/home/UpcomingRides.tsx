import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Bus, QrCode } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { useTransportStore } from '@/client/modules/transport/store';
import { getWeeklySummary } from '@/client/modules/transport/api';
import type { MyTicket, Trip } from '@/client/modules/transport/validators';
import { useAuthStore } from '@/shared/stores/authStore';

const TZ = 'Asia/Karachi';
const formatTime12 = (iso: string) => formatInTimeZone(new Date(iso), TZ, 'h:mm a');

const countdown = (target: number, now: number) => {
    const mins = Math.max(0, Math.floor((target - now) / 60000));
    const d = Math.floor(mins / 1440);
    const h = Math.floor((mins % 1440) / 60);
    const m = mins % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
};

const DateChip = ({ iso, tone }: { iso: string; tone: 'iris' | 'signal' }) => (
    <span
        className={
            tone === 'iris'
                ? 'w-[52px] h-14 rounded-[14px] bg-iris-tint text-iris-strong flex flex-col items-center justify-center shrink-0'
                : 'w-[52px] h-14 rounded-[14px] bg-card text-signal-text flex flex-col items-center justify-center shrink-0'
        }
    >
        <span className="text-[11px] font-extrabold uppercase">{formatInTimeZone(new Date(iso), TZ, 'EEE')}</span>
        <span className="font-display text-[22px] font-extrabold leading-none">{formatInTimeZone(new Date(iso), TZ, 'd')}</span>
    </span>
);

/** Next booked rides and the next booking window — the "Your weekend" section on Home. */
export const UpcomingRides = () => {
    const { myTickets, fetchUserTickets } = useTransportStore();
    const user = useAuthStore((s) => s.user);
    const [trips, setTrips] = useState<Trip[]>([]);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        void fetchUserTickets();
        getWeeklySummary()
            .then((data) => setTrips(data ?? []))
            .catch(() => setTrips([]));
    }, [fetchUserTickets]);

    useEffect(() => {
        const t = window.setInterval(() => setNow(Date.now()), 30000);
        return () => window.clearInterval(t);
    }, []);

    // Same rule as the Tickets page: hide cancelled and anything that left more than 3h ago.
    const upcoming = useMemo(() => {
        const cutoff = now - 3 * 60 * 60 * 1000;
        return myTickets
            .filter((t: MyTicket) => t.status !== 'CANCELLED' && new Date(t.departure_time).getTime() >= cutoff)
            .sort((a, b) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime())
            .slice(0, 2);
    }, [myTickets, now]);

    // Earliest trip of the user's bus type whose booking hasn't opened yet.
    const nextOpening = useMemo(() => {
        const role = user?.user_type?.toUpperCase();
        return trips
            .filter((t) => {
                const busType = t.bus_type?.toUpperCase();
                if (role === 'STUDENT' && busType !== 'STUDENT') return false;
                if (role === 'EMPLOYEE' && busType !== 'EMPLOYEE') return false;
                return t.status === 'SCHEDULED' && new Date(t.booking_opens_at).getTime() > now;
            })
            .sort((a, b) => new Date(a.booking_opens_at).getTime() - new Date(b.booking_opens_at).getTime())[0];
    }, [trips, user, now]);

    return (
        <section aria-labelledby="home-upcoming" className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
                <h2 id="home-upcoming" className="font-display font-bold text-xl text-ink">
                    Your rides
                </h2>
                <Link to="/tickets/all" className="text-[13px] font-extrabold text-iris-strong hover:underline">
                    All tickets
                </Link>
            </div>

            {upcoming.map((t) => (
                <Link
                    key={t.ticket_id}
                    to={`/tickets/${t.ticket_id}`}
                    className="flex items-center gap-3.5 bg-card rounded-[20px] p-3.5 hover:shadow-md transition-shadow focus-visible:outline-2 focus-visible:outline-iris"
                >
                    <DateChip iso={t.departure_time} tone="iris" />
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="text-base font-extrabold text-ink truncate">{t.route_name}</span>
                        <span className="text-[13px] text-muted-foreground truncate">
                            {formatTime12(t.departure_time)} · {t.relevant_location || t.pickup_location}
                        </span>
                    </span>
                    <span className="h-9 px-3 rounded-xl bg-ink text-volt text-[13px] font-extrabold flex items-center gap-1.5 shrink-0">
                        <QrCode className="size-4" aria-hidden="true" />
                        Pass
                    </span>
                </Link>
            ))}

            {upcoming.length === 0 && (
                <div className="flex items-center gap-3.5 bg-card rounded-[20px] p-3.5">
                    <span className="size-12 rounded-[14px] bg-iris-tint text-iris-strong flex items-center justify-center shrink-0">
                        <Bus className="size-6" aria-hidden="true" />
                    </span>
                    <span className="flex-1 flex flex-col gap-0.5">
                        <span className="text-[15px] font-extrabold text-ink">No rides booked</span>
                        <span className="text-[13px] text-muted-foreground">Grab a seat on the next bus.</span>
                    </span>
                    <Link
                        to="/transport"
                        className="h-10 px-3.5 rounded-xl bg-iris-tint text-iris-strong text-[13px] font-extrabold flex items-center shrink-0"
                    >
                        Book
                    </Link>
                </div>
            )}

            {nextOpening && (
                <Link
                    to="/transport"
                    className="flex items-center gap-3.5 bg-signal-tint rounded-[20px] p-3.5 focus-visible:outline-2 focus-visible:outline-iris"
                >
                    <DateChip iso={nextOpening.departure_time} tone="signal" />
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="text-[15px] font-extrabold text-[#4A2800] truncate">
                            Seats open {formatInTimeZone(new Date(nextOpening.booking_opens_at), TZ, 'EEE')}{' '}
                            {formatTime12(nextOpening.booking_opens_at)}
                        </span>
                        <span className="text-[13px] text-[#6B3A00] truncate">
                            In <span className="font-mono font-semibold">{countdown(new Date(nextOpening.booking_opens_at).getTime(), now)}</span>
                            {' · '}
                            {nextOpening.route_name}, {formatInTimeZone(new Date(nextOpening.departure_time), TZ, 'EEE')}{' '}
                            {formatTime12(nextOpening.departure_time)}
                        </span>
                    </span>
                    <BellRing className="size-5 text-signal-text shrink-0" aria-hidden="true" />
                </Link>
            )}
        </section>
    );
};
