import { formatInTimeZone } from 'date-fns-tz';
import type { BookingSelection, Trip } from './validators';
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
            `SUMMARY:Bus ${from} → ${to}`,
            `LOCATION:${where}`,
            `DESCRIPTION:${l.seats} seat(s). Show your ride pass in GIKI Wallet when boarding.`,
            'BEGIN:VALARM',
            'TRIGGER:-PT30M',
            'ACTION:DISPLAY',
            'DESCRIPTION:Bus leaves in 30 minutes',
            'END:VALARM',
            'END:VEVENT',
        ].join('\r\n');
    });
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GIKI Wallet//Rides//EN', ...events, 'END:VCALENDAR'].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'giki-bus.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
