import { formatInTimeZone } from 'date-fns-tz';
import type { ActiveHold, BookingSelection, Trip } from './validators';
import { getCityName, getGIKIStopObject } from './utils';

export const TZ = 'Asia/Karachi';

/** Karachi calendar day key (yyyy-MM-dd) for an ISO timestamp. */
export const dayKey = (iso: string | Date) => formatInTimeZone(new Date(iso), TZ, 'yyyy-MM-dd');

/** "Islamabad" from "GIKI → Islamabad" / "Islamabad → GIKI" (falls back to getCityName). */
export const cityOf = (routeName: string) => {
    const parts = routeName.split(/\s*(?:→|->|–|-|to)\s*/i).map((p) => p.trim()).filter(Boolean);
    const other = parts.find((p) => !/^giki$/i.test(p));
    return other || getCityName(routeName);
};

/** Short code for the ticket-style "GIKI → ISB" header. */
export const cityCode = (city: string) => {
    const known: Record<string, string> = { islamabad: 'ISB', rawalpindi: 'RWP', peshawar: 'PEW', lahore: 'LHE', karachi: 'KHI' };
    const k = city.trim().toLowerCase();
    return known[k] ?? city.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
};

/** mm:ss for hold countdowns. */
export const formatClock = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const formatRs = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 2 });

export const timeParts = (iso: string) => {
    const [time, ampm] = formatInTimeZone(new Date(iso), TZ, 'h:mm a').split(' ');
    return { time, ampm };
};

export const countdownText = (targetIso: string, now = Date.now()) => {
    const mins = Math.max(0, Math.floor((new Date(targetIso).getTime() - now) / 60000));
    const d = Math.floor(mins / 1440);
    const h = Math.floor((mins % 1440) / 60);
    const m = mins % 60;
    if (mins <= 1) return 'opening soon';
    if (d > 0) return `in ${d}d ${h}h`;
    if (h > 0) return `in ${h}h ${m}m`;
    return `in ${m}m`;
};

/** Non-GIKI stops of a trip (the ones a rider chooses between). */
export const riderStops = (trip: Trip) => trip.stops.filter((s) => !s.stop_name.toUpperCase().includes('GIKI'));

export type LegSummary = {
    tripId: string;
    direction: 'OUTBOUND' | 'INBOUND';
    routeName: string;
    city: string;
    departure: string;
    stopName: string;
    seats: number;
    priceEach: number;
};

/** Everything the Review / Booked screens need about one selected leg. */
export const summarizeLeg = (selection: BookingSelection | null, trips: Trip[]): LegSummary | null => {
    if (!selection) return null;
    const trip = trips.find((t) => t.id === selection.tripId);
    if (!trip) return null;
    const giki = getGIKIStopObject(trip.stops);
    const direction: 'OUTBOUND' | 'INBOUND' = giki && selection.pickupId === giki.stop_id ? 'OUTBOUND' : 'INBOUND';
    const stopId = direction === 'OUTBOUND' ? selection.dropoffId : selection.pickupId;
    return {
        tripId: trip.id,
        direction,
        routeName: trip.route_name,
        city: cityOf(trip.route_name),
        departure: trip.departure_time,
        stopName: trip.stops.find((s) => s.stop_id === stopId)?.stop_name || '—',
        seats: selection.ticketCount,
        priceEach: trip.base_price,
    };
};

/**
 * Legs for the pay screens, built from the seats actually HELD on the server
 * (what Pay will charge for), enriched with the in-memory selection (stop name)
 * when there is one. `complete` is false if a held trip isn't in the trip list,
 * in which case the total can't be trusted and paying should wait.
 */
export const legsFromHolds = (
    holds: ActiveHold[],
    trips: Trip[],
    selections: Array<BookingSelection | null>
): { legs: LegSummary[]; total: number; complete: boolean } => {
    const byTrip = new Map<string, ActiveHold[]>();
    holds.forEach((h) => byTrip.set(h.trip_id, [...(byTrip.get(h.trip_id) ?? []), h]));

    let complete = true;
    const legs: LegSummary[] = [];
    byTrip.forEach((tripHolds, tripId) => {
        const trip = trips.find((t) => t.id === tripId);
        const sel = selections.find((s) => s?.tripId === tripId) ?? null;
        const fromSel = summarizeLeg(sel, trips);
        if (!trip) complete = false;
        const dir: 'OUTBOUND' | 'INBOUND' = (trip?.direction ?? tripHolds[0].direction ?? '').toUpperCase() === 'INBOUND' ? 'INBOUND' : 'OUTBOUND';
        legs.push({
            tripId,
            direction: fromSel?.direction ?? dir,
            routeName: trip?.route_name ?? tripHolds[0].route_name,
            city: cityOf(trip?.route_name ?? tripHolds[0].route_name),
            departure: trip?.departure_time ?? '',
            stopName: fromSel?.stopName ?? '—',
            seats: tripHolds.length,
            priceEach: trip?.base_price ?? 0,
        });
    });
    legs.sort((a, b) => (a.direction === b.direction ? a.departure.localeCompare(b.departure) : a.direction === 'OUTBOUND' ? -1 : 1));
    return { legs, total: legs.reduce((s, l) => s + l.seats * l.priceEach, 0), complete };
};

/** Escape text for an iCalendar property value (RFC 5545 §3.3.11). */
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Fold lines longer than 75 octets (RFC 5545 §3.1). */
const icsFold = (line: string) => {
    const bytes = new TextEncoder().encode(line);
    if (bytes.length <= 75) return line;
    const out: string[] = [];
    let cur = '';
    let curLen = 0;
    for (const ch of line) {
        const len = new TextEncoder().encode(ch).length;
        if (curLen + len > (out.length ? 74 : 75)) {
            out.push(cur);
            cur = '';
            curLen = 0;
        }
        cur += ch;
        curLen += len;
    }
    out.push(cur);
    return out.join('\r\n ');
};

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Download an .ics file with one event per booked leg (works offline, no backend). */
export const downloadCalendar = (legs: LegSummary[]) => {
    const now = icsDate(new Date());
    const events = legs.map((l, i) => {
        const start = new Date(l.departure);
        const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
        const from = l.direction === 'OUTBOUND' ? 'GIKI' : l.city;
        const to = l.direction === 'OUTBOUND' ? l.city : 'GIKI';
        const where = l.direction === 'OUTBOUND' ? 'GIKI' : l.stopName;
        return [
            'BEGIN:VEVENT',
            `UID:${l.tripId}-${i}@giki-wallet`,
            `DTSTAMP:${now}`,
            `DTSTART:${icsDate(start)}`,
            `DTEND:${icsDate(end)}`,
            `SUMMARY:${icsText(`Bus ${from} → ${to}`)}`,
            `LOCATION:${icsText(where)}`,
            `DESCRIPTION:${icsText(`${l.seats} seat(s). Show your ride pass in GIKI Wallet when boarding.`)}`,
            'BEGIN:VALARM',
            'TRIGGER:-PT30M',
            'ACTION:DISPLAY',
            'DESCRIPTION:Bus leaves in 30 minutes',
            'END:VALARM',
            'END:VEVENT',
        ]
            .map(icsFold)
            .join('\r\n');
    });
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GIKI Wallet//Rides//EN', ...events, 'END:VCALENDAR'].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'giki-bus.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
