import { Modal } from '@/shared/components/ui/Modal';

interface AbandonBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    timeLeft: number;
    onAbandon: () => void;
    onStay: () => void;
}

export function AbandonBookingModal({ isOpen, onClose, timeLeft, onAbandon, onStay }: AbandonBookingModalProps) {
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Abandon Booking?">
            <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3 bg-signal-tint rounded-2xl p-3.5">
                    <span className="font-mono font-semibold text-base text-signal-text bg-card px-2.5 py-1.5 rounded-xl tabular">{formatTime(timeLeft)}</span>
                    <span className="text-sm font-extrabold text-[#4A2800]">Active reservation</span>
                </div>

                <p className="text-[15px] text-[#4A4766] leading-relaxed">
                    You have seats on hold. Leaving this page will <strong className="text-ink">release your seats</strong> and free up your weekly
                    quota. Do you want to proceed?
                </p>

                <div className="flex flex-col gap-2.5">
                    <button
                        type="button"
                        onClick={onAbandon}
                        className="h-14 rounded-[18px] bg-coral text-white text-base font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
                    >
                        Yes, Release &amp; Leave
                    </button>
                    <button
                        type="button"
                        onClick={onStay}
                        className="h-12 rounded-2xl border-[1.5px] border-input bg-card text-ink text-[15px] font-extrabold focus-visible:outline-2 focus-visible:outline-iris"
                    >
                        No, Stay Here
                    </button>
                </div>
            </div>
        </Modal>
    );
}
