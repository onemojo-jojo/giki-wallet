import { formatInTimeZone } from 'date-fns-tz';
import type { MyTicket } from './validators';
import { TZ, cityCode, cityOf, formatRs } from './bookingHelpers';

/** A ticket stays "upcoming" until 3 h after departure (same rule the app has always used). */
const UPCOMING_GRACE_MS = 3 * 60 * 60 * 1000;

const byDeparture = (a: MyTicket, b: MyTicket) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime();

export const isUpcoming = (t: MyTicket, now = Date.now()) =>
    t.status !== 'CANCELLED' && new Date(t.departure_time).getTime() >= now - UPCOMING_GRACE_MS;

/** Upcoming soonest-first; past (departed or cancelled) newest-first. */
export const splitTickets = (tickets: MyTicket[], now = Date.now()) => {
    const upcoming = tickets.filter((t) => isUpcoming(t, now)).sort(byDeparture);
    const past = tickets.filter((t) => !isUpcoming(t, now)).sort((a, b) => byDeparture(b, a));
    return { upcoming, past };
};

/** Both ends of the ride: GIKI → city when outbound, city → GIKI when inbound. */
export const ticketEnds = (t: MyTicket) => {
    const city = cityOf(t.route_name);
    const inbound = t.direction?.toUpperCase() === 'INBOUND';
    const from = inbound ? city : 'GIKI';
    const to = inbound ? 'GIKI' : city;
    return {
        from,
        to,
        fromCode: from === 'GIKI' ? 'GIKI' : cityCode(from),
        toCode: to === 'GIKI' ? 'GIKI' : cityCode(to),
        fromStop: t.pickup_location,
        toStop: t.dropoff_location,
        route: `${from} → ${to}`,
        /** The stop the rider cares about: where they get on (inbound) or off (outbound). */
        riderStop: inbound ? `Pickup ${t.pickup_location}` : `Drop-off ${t.dropoff_location}`,
    };
};

export const fmt = (iso: string, pattern: string) => formatInTimeZone(new Date(iso), TZ, pattern);

export const RELATION_LABEL: Record<string, string> = { SELF: 'You', SPOUSE: 'Spouse', CHILD: 'Child', PARENT: 'Parent' };

export const passengerLabel = (t: MyTicket) =>
    t.is_self ? t.passenger_name : `${t.passenger_name} · ${RELATION_LABEL[t.passenger_relation?.toUpperCase()] ?? t.passenger_relation}`;

export type Pill = { label: string; tone: 'paid' | 'done' | 'refunded' | 'cancelled' };

export const ticketPill = (t: MyTicket, now = Date.now()): Pill => {
    if (t.status === 'CANCELLED') return t.price > 0 ? { label: `Refunded Rs ${formatRs(t.price)}`, tone: 'refunded' } : { label: 'Cancelled', tone: 'cancelled' };
    if (!isUpcoming(t, now)) return { label: 'Ridden', tone: 'done' };
    return { label: t.price > 0 ? 'Paid' : 'Booked', tone: 'paid' };
};

export const PILL_CLASS: Record<Pill['tone'], string> = {
    paid: 'text-[#0E5E43] bg-mint-tint',
    done: 'text-[#4A4766] bg-[#ECEBF2]',
    refunded: 'text-iris-strong bg-iris-tint',
    cancelled: 'text-[#8F1B21] bg-coral-tint',
};

/** Past tickets grouped under month headings ("EARLIER THIS MONTH", "OCTOBER 2026", …). */
export const groupPast = (past: MyTicket[], now = Date.now()) => {
    const thisMonth = formatInTimeZone(new Date(now), TZ, 'yyyy-MM');
    const groups: { key: string; label: string; tickets: MyTicket[] }[] = [];
    for (const t of past) {
        const key = fmt(t.departure_time, 'yyyy-MM');
        let g = groups.find((x) => x.key === key);
        if (!g) {
            g = { key, label: key === thisMonth ? 'EARLIER THIS MONTH' : fmt(t.departure_time, 'MMMM yyyy').toUpperCase(), tickets: [] };
            groups.push(g);
        }
        g.tickets.push(t);
    }
    return groups;
};
