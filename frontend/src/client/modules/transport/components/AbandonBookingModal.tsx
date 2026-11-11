import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BottomSheet } from '@/shared/components/ui/BottomSheet';
import { formatClock } from '../bookingHelpers';

interface AbandonBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    timeLeft: number;
    /** May return a promise; the sheet stays busy (no double release) until it settles. */
    onAbandon: () => void | Promise<unknown>;
    onStay: () => void;
}

/** "Release your seats?" — shown when leaving the booking flow with seats on hold (v2 bottom sheet). */
export function AbandonBookingModal({ isOpen, onClose, timeLeft, onAbandon, onStay }: AbandonBookingModalProps) {
    const [pending, setPending] = useState(false);

    const release = async () => {
        if (pending) return;
        setPending(true);
        try {
            await onAbandon();
        } finally {
            setPending(false);
        }
    };

    return (
        <BottomSheet open={isOpen} onClose={onClose} busy={pending} title="Release your seats?" subtitle="Leaving now gives your held seats back and frees your weekly quota.">
            <div className="flex items-center gap-3 bg-signal-tint rounded-[18px] px-4 py-3">
                <span className="font-mono font-semibold text-base text-signal-text bg-card px-2.5 py-1.5 rounded-xl tabular">{formatClock(timeLeft)}</span>
                <span className="text-sm font-extrabold text-[#4A2800]">left on your hold</span>
            </div>
            <div className="flex flex-col gap-2.5 mt-1">
                <button
                    type="button"
                    onClick={onStay}
                    disabled={pending}
                    className="h-14 rounded-[18px] bg-ink text-white text-base font-extrabold disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                >
                    Keep my seats
                </button>
                <button
                    type="button"
                    onClick={() => void release()}
                    disabled={pending}
                    className="h-[50px] rounded-2xl border-[1.5px] border-[#F2C4C6] bg-card text-coral text-[15px] font-extrabold flex items-center justify-center gap-2 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-coral"
                >
                    {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                    {pending ? 'Releasing…' : 'Release & leave'}
                </button>
            </div>
        </BottomSheet>
    );
}
