import { formatInTimeZone } from 'date-fns-tz';
import { cn } from '@/lib/utils';
import { TZ } from '../bookingHelpers';

export type Day = { key: string; date: Date; hasTrips: boolean };

interface DayStripProps {
    days: Day[];
    selected: string;
    onSelect: (key: string) => void;
    label?: string;
}

/** Row of day chips (WED 13 …) with a dot on days that have buses. */
export const DayStrip = ({ days, selected, onSelect, label = 'Day' }: DayStripProps) => (
    <div role="tablist" aria-label={label} className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {days.map((d) => {
            const sel = d.key === selected;
            return (
                <button
                    key={d.key}
                    type="button"
                    role="tab"
                    aria-selected={sel}
                    aria-label={`${formatInTimeZone(d.date, TZ, 'EEEE d MMMM')}${d.hasTrips ? '' : ', no buses'}`}
                    onClick={() => onSelect(d.key)}
                    className={cn(
                        'min-w-[62px] flex-1 h-[62px] rounded-2xl flex flex-col items-center justify-center gap-0.5 snap-start shrink-0',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris',
                        sel ? 'bg-ink text-white' : 'bg-card text-ink'
                    )}
                >
                    <span className="text-[11px] font-extrabold uppercase">{formatInTimeZone(d.date, TZ, 'EEE')}</span>
                    <span className="font-display text-xl font-extrabold leading-none">{formatInTimeZone(d.date, TZ, 'd')}</span>
                    <span
                        aria-hidden="true"
                        className={cn('size-[5px] rounded-full', d.hasTrips ? (sel ? 'bg-volt' : 'bg-iris') : 'bg-transparent')}
                    />
                </button>
            );
        })}
    </div>
);
