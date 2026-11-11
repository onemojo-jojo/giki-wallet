import { ArrowLeftRight } from 'lucide-react';
import { Switch } from '@/shared/components/ui/switch';
import { cn } from '@/lib/utils';

interface TransportBookingModeSelectorProps {
    direction: 'OUTBOUND' | 'INBOUND';
    onDirectionChange: (direction: 'OUTBOUND' | 'INBOUND') => void;
    isRoundTrip: boolean;
    onRoundTripChange: (enabled: boolean) => void;
    quota: { outbound: { remaining: number }; inbound: { remaining: number } } | null;
}

export function TransportBookingModeSelector({
    direction,
    onDirectionChange,
    isRoundTrip,
    onRoundTripChange,
    quota
}: TransportBookingModeSelectorProps) {
    const canBookRoundTrip = quota ? quota.outbound.remaining >= 1 && quota.inbound.remaining >= 1 : true;
    const disabledRoundTrip = !canBookRoundTrip;

    return (
        <div className="flex flex-col gap-3">
            {/* Direction (hidden in round-trip mode — both sections are shown) */}
            {!isRoundTrip && (
                <div role="tablist" aria-label="Direction" className="grid grid-cols-2 bg-secondary rounded-2xl p-1 gap-1">
                    {(['OUTBOUND', 'INBOUND'] as const).map((d) => (
                        <button
                            key={d}
                            type="button"
                            role="tab"
                            aria-selected={direction === d}
                            onClick={() => onDirectionChange(d)}
                            className={cn(
                                'h-11 rounded-xl text-sm transition-colors focus-visible:outline-2 focus-visible:outline-iris',
                                direction === d ? 'bg-card text-ink font-extrabold shadow-sm' : 'text-[#4A4766] font-semibold hover:text-ink'
                            )}
                        >
                            {d === 'OUTBOUND' ? 'From GIKI' : 'To GIKI'}
                        </button>
                    ))}
                </div>
            )}

            {/* Round trip */}
            <label
                className={cn('flex items-center gap-3 bg-card rounded-2xl px-4 py-3', isRoundTrip && 'ring-2 ring-iris')}
                title={disabledRoundTrip ? 'Insufficient quota for Round Trip (Requires 1 Outbound + 1 Inbound)' : undefined}
            >
                <ArrowLeftRight className="size-5 text-ink shrink-0" aria-hidden="true" />
                <span className="flex-1 flex flex-col">
                    <span className="text-sm font-extrabold text-ink">Round trip</span>
                    <span className="text-xs text-muted-foreground">
                        {disabledRoundTrip && !isRoundTrip ? 'Needs 1 outbound + 1 return seat left in your quota' : 'Book going and coming back together'}
                    </span>
                </span>
                <Switch
                    checked={isRoundTrip}
                    onCheckedChange={onRoundTripChange}
                    disabled={disabledRoundTrip && !isRoundTrip}
                    aria-label="Round trip"
                />
            </label>
        </div>
    );
}
