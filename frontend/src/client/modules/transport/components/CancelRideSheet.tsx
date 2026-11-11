import { useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { useAuthStore } from '@/shared/stores/authStore';
import { useWalletModuleStore } from '@/client/modules/wallet/store';
import type { MyTicket } from '../validators';
import { formatRs } from '../bookingHelpers';
import { fmt, ticketEnds } from '../ticketHelpers';

interface CancelRideSheetProps {
    ticket: MyTicket;
    /** Other upcoming tickets the user holds (they stay booked). */
    otherUpcoming: number;
    pending: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

/** "Cancel this ride?" bottom sheet (v2-Cancel). */
export const CancelRideSheet = ({ ticket, otherUpcoming, pending, onConfirm, onClose }: CancelRideSheetProps) => {
    const { balance, fetchBalance, dataError } = useWalletModuleStore();
    // Only show the new balance once a fresh balance has arrived.
    const [balanceReady, setBalanceReady] = useState(false);
    const isEmployee = useAuthStore((s) => s.user?.user_type?.toUpperCase() === 'EMPLOYEE');
    const keepRef = useRef<HTMLButtonElement>(null);
    const sheetRef = useRef<HTMLElement>(null);
    const ends = ticketEnds(ticket);
    const refund = ticket.price;

    useEffect(() => {
        void fetchBalance().finally(() => setBalanceReady(true));
        keepRef.current?.focus();
    }, [fetchBalance]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !pending) onClose();
            // Keep Tab inside the sheet.
            if (e.key === 'Tab' && sheetRef.current) {
                const items = [...sheetRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')];
                if (items.length === 0) return;
                const first = items[0];
                const last = items[items.length - 1];
                if (!sheetRef.current.contains(document.activeElement)) {
                    e.preventDefault();
                    first.focus();
                } else if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [pending, onClose]);

    return (
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
            <div aria-hidden="true" className="absolute inset-0 bg-ink/60" onClick={() => !pending && onClose()} />
            <section
                ref={sheetRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="cancel-title"
                className="relative w-full max-w-[480px] bg-card rounded-t-[28px] px-5 pt-3 pb-7 flex flex-col gap-4 animate-in slide-in-from-bottom-8 duration-200"
            >
                <span aria-hidden="true" className="self-center w-10 h-[5px] rounded-full bg-[#D9D7E5]" />
                <div className="flex flex-col gap-1.5">
                    <h2 id="cancel-title" className="font-display font-extrabold text-[26px] tracking-tight text-ink">
                        Cancel this ride?
                    </h2>
                    <p className="text-[15px] text-[#4A4766]">
                        {fmt(ticket.departure_time, 'EEE d MMM · h:mm a')} · {ends.route}
                        {!ticket.is_self && ` · ${ticket.passenger_name}`}
                    </p>
                </div>

                {refund > 0 && (
                    <div className="flex items-center gap-3.5 bg-mint-tint rounded-[18px] px-4 py-3.5">
                        <span className="size-11 rounded-[14px] bg-card text-[#0E5E43] flex items-center justify-center shrink-0">
                            <RotateCcw className="size-[22px]" aria-hidden="true" />
                        </span>
                        <span className="flex-1 flex flex-col gap-0.5 text-[#0E5E43]">
                            <span className="text-[15px] font-extrabold">Rs {formatRs(refund)} back to G-Bux</span>
                            <span className="text-[13px]">
                                Instantly.
                                {balanceReady && !dataError && ` New balance Rs ${formatRs(balance + refund)}.`}
                            </span>
                        </span>
                    </div>
                )}

                <ul className="list-disc pl-[18px] flex flex-col gap-1.5 text-sm text-[#4A4766]">
                    <li>Your seat goes back to other {isEmployee ? 'riders' : 'students'}.</li>
                    {otherUpcoming > 0 && <li>Your other {otherUpcoming === 1 ? 'ticket stays' : 'tickets stay'} booked.</li>}
                    <li>You can cancel until booking closes for this bus.</li>
                </ul>

                <div className="flex flex-col gap-2.5 mt-1">
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={pending}
                        className="h-14 rounded-[18px] bg-coral text-white text-base font-extrabold flex items-center justify-center gap-2 disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
                    >
                        {pending && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
                        {pending ? 'Cancelling…' : refund > 0 ? `Cancel & refund Rs ${formatRs(refund)}` : 'Cancel ride'}
                    </button>
                    <button
                        ref={keepRef}
                        type="button"
                        onClick={onClose}
                        disabled={pending}
                        className="h-[50px] rounded-2xl border-[1.5px] border-[#D9D7E5] text-ink text-[15px] font-extrabold disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-iris"
                    >
                        Keep my seat
                    </button>
                </div>
            </section>
        </div>
    );
};
