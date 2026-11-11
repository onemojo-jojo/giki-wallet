import { BottomSheet } from '@/shared/components/ui/BottomSheet';
import { formatClock } from '../bookingHelpers';

interface AbandonBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    timeLeft: number;
    onAbandon: () => void;
    onStay: () => void;
}

/** "Release your seats?" — shown when leaving the booking flow with seats on hold (v2 bottom sheet). */
export function AbandonBookingModal({ isOpen, onClose, timeLeft, onAbandon, onStay }: AbandonBookingModalProps) {
    return (
        <BottomSheet open={isOpen} onClose={onClose} title="Release your seats?" subtitle="Leaving now gives your held seats back and frees your weekly quota.">
            <div className="flex items-center gap-3 bg-signal-tint rounded-[18px] px-4 py-3">
                <span className="font-mono font-semibold text-base text-signal-text bg-card px-2.5 py-1.5 rounded-xl tabular">{formatClock(timeLeft)}</span>
                <span className="text-sm font-extrabold text-[#4A2800]">left on your hold</span>
            </div>
            <div className="flex flex-col gap-2.5 mt-1">
                <button
                    type="button"
                    onClick={onStay}
                    className="h-14 rounded-[18px] bg-ink text-white text-base font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                >
                    Keep my seats
                </button>
                <button
                    type="button"
                    onClick={onAbandon}
                    className="h-[50px] rounded-2xl border-[1.5px] border-[#F2C4C6] bg-card text-coral text-[15px] font-extrabold focus-visible:outline-2 focus-visible:outline-coral"
                >
                    Release &amp; leave
                </button>
            </div>
        </BottomSheet>
    );
}
