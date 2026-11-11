import { ArrowRight, Check, CircleDashed, PencilLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatTime } from '../utils';
import type { Trip, BookingSelection } from '../validators';
import { useTransportStore } from '../store';

interface SelectionSummaryProps {
    isRoundTrip: boolean;
    allTrips: Trip[];
    outboundSelection: BookingSelection | null;
    returnSelection: BookingSelection | null;
    activeHolds: Array<{ id: string; trip_id: string; direction: string }>;
}

type LegData = { route: string; departure: string; pickup: string; dropoff: string; isHeld: boolean } | null;

const Leg = ({
    label,
    data,
    active,
    onEdit,
    status,
    emptyText,
}: {
    label: string;
    data: LegData;
    active: boolean;
    onEdit: () => void;
    status: 'held' | 'pending' | 'next' | null;
    emptyText: string;
}) => (
    <button
        type="button"
        onClick={onEdit}
        aria-pressed={active}
        className={cn(
            'flex-1 text-left p-4 rounded-2xl transition-colors focus-visible:outline-2 focus-visible:outline-iris',
            active ? 'ring-2 ring-iris' : 'hover:bg-secondary/40',
            data?.isHeld ? 'bg-mint-tint/60' : 'bg-background'
        )}
    >
        <span className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground">{label}</span>
            <span className="flex items-center gap-2">
                {status === 'held' && (
                    <span className="flex items-center gap-1 text-mint text-[11px] font-extrabold uppercase">
                        <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                        Seat held
                    </span>
                )}
                {(status === 'pending' || status === 'next') && (
                    <span className="flex items-center gap-1 text-signal-text text-[11px] font-extrabold uppercase">
                        {status === 'pending' ? 'Pending' : 'Next step'}
                        <CircleDashed className="size-3.5 animate-spin-slow" aria-hidden="true" />
                    </span>
                )}
                <PencilLine className={cn('size-3.5', active ? 'text-ink' : 'text-light-gray')} aria-hidden="true" />
            </span>
        </span>
        {data ? (
            <span className="flex flex-col gap-1">
                <span className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-extrabold text-ink">{data.route}</span>
                    <span className="text-[11px] text-muted-foreground">{data.departure}</span>
                </span>
                <span className="flex items-center gap-2 text-xs text-[#4A4766]">
                    <span className="truncate max-w-[140px]">{data.pickup}</span>
                    <ArrowRight className="size-3 shrink-0 text-light-gray" aria-hidden="true" />
                    <span className="truncate max-w-[140px]">{data.dropoff}</span>
                </span>
            </span>
        ) : (
            <span className="h-10 flex items-center text-xs text-muted-foreground font-semibold">{emptyText}</span>
        )}
    </button>
);

export function SelectionSummary({ isRoundTrip, allTrips, outboundSelection, returnSelection, activeHolds }: SelectionSummaryProps) {
    const { direction, setDirection } = useTransportStore();

    const getTripData = (selection: BookingSelection | null): LegData => {
        if (!selection) return null;
        const trip = allTrips.find((t) => t.id === selection.tripId);
        if (!trip) return null;

        const pickup = trip.stops.find((s) => s.stop_id === selection.pickupId)?.stop_name || '...';
        const dropoff = trip.stops.find((s) => s.stop_id === selection.dropoffId)?.stop_name || '...';
        const isHeld = activeHolds.some((h) => h.trip_id === selection.tripId);

        return {
            route: trip.route_name,
            departure: `${formatDate(trip.departure_time)} @ ${formatTime(trip.departure_time)}`,
            pickup,
            dropoff,
            isHeld,
        };
    };

    const outbound = getTripData(outboundSelection);
    const returnTrip = getTripData(returnSelection);

    if (!outboundSelection && !returnSelection) return null;

    return (
        <div className="bg-card rounded-[22px] p-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-col md:flex-row items-stretch gap-2.5">
                <Leg
                    label="Outbound trip"
                    data={outbound}
                    active={direction === 'OUTBOUND'}
                    onEdit={() => setDirection('OUTBOUND')}
                    status={outbound?.isHeld ? 'held' : outbound ? 'pending' : null}
                    emptyText="Select an outbound trip..."
                />
                {isRoundTrip && (
                    <Leg
                        label="Return trip"
                        data={returnTrip}
                        active={direction === 'INBOUND'}
                        onEdit={() => setDirection('INBOUND')}
                        status={returnTrip?.isHeld ? 'held' : outbound?.isHeld ? 'next' : null}
                        emptyText={outbound?.isHeld ? 'Waiting for selection...' : 'Select outbound first'}
                    />
                )}
            </div>
        </div>
    );
}
