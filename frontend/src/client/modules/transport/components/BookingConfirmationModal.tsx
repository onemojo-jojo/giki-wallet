import { Modal } from '@/shared/components/ui/Modal';
import { Select } from '@/shared/components/ui/Select';
import { Passenger } from '../validators';

export interface TripSummary {
    route: string | null;
    when: string;
    pickup: string;
    dropoff: string;
    seats: number;
    priceEach: number;
}

export type HeldSeat = {
    hold_id: string;
    expires_at: string;
};

export interface BookingConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    confirming: boolean;
    onConfirm: () => void;
    outboundSummary: TripSummary | null;
    returnSummary: TripSummary | null;
    outboundHolds: HeldSeat[];
    returnHolds: HeldSeat[];
    passengers: Record<string, Passenger>;
    onUpdatePassenger: (holdId: string, data: Passenger) => void;
    isStudent?: boolean;
}

const formatRs = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 2 });

const LegSummary = ({ label, s }: { label: string; s: TripSummary }) => (
    <div className="p-4 rounded-2xl bg-background flex flex-col gap-1.5">
        <span className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-iris-strong">{label}</span>
            <span className="text-xs font-bold text-muted-foreground">
                {s.seats} seat{s.seats === 1 ? '' : 's'}
            </span>
        </span>
        <span className="font-display text-lg font-extrabold text-ink leading-tight">{s.route}</span>
        <span className="text-[13px] text-[#4A4766]">{s.when}</span>
        <span className="text-[13px] font-bold text-ink">
            {s.pickup} → {s.dropoff}
        </span>
    </div>
);

export function BookingConfirmationModal({
    isOpen,
    onClose,
    confirming,
    onConfirm,
    outboundSummary,
    returnSummary,
    outboundHolds,
    returnHolds,
    passengers,
    onUpdatePassenger,
    isStudent = false,
}: BookingConfirmationModalProps) {
    const allHolds = [...outboundHolds, ...returnHolds];
    const total =
        (outboundSummary ? outboundSummary.seats * outboundSummary.priceEach : 0) +
        (returnSummary ? returnSummary.seats * returnSummary.priceEach : 0);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Confirm booking"
            footer={
                <div className="flex gap-3">
                    <button
                        type="button"
                        className="flex-1 h-14 rounded-[18px] border-[1.5px] border-input bg-card text-ink text-[15px] font-extrabold disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-iris"
                        disabled={confirming}
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="flex-[1.4] h-14 rounded-[18px] bg-ink text-white text-[15px] font-extrabold flex items-center justify-between px-5 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                        disabled={confirming}
                        onClick={onConfirm}
                    >
                        <span>{confirming ? 'Confirming…' : 'Confirm'}</span>
                        {total > 0 && <span className="font-display text-volt tabular">Rs {formatRs(total)}</span>}
                    </button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                {outboundSummary && <LegSummary label="Outbound trip" s={outboundSummary} />}
                {returnSummary && <LegSummary label="Return trip" s={returnSummary} />}

                <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-[0.06em]">Passenger details</h3>
                    {allHolds.map((h, idx) => {
                        const p = passengers[h.hold_id] || { name: '', relation: 'SELF' as const };
                        return (
                            <div key={h.hold_id} className="p-4 rounded-2xl bg-card border border-line flex flex-col gap-2.5">
                                <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-[0.06em]">Seat #{idx + 1}</span>
                                <label className="flex flex-col gap-1 text-xs font-bold text-[#4A4766]">
                                    Passenger name
                                    <input
                                        className="h-12 rounded-xl border-[1.5px] border-input bg-card px-3.5 text-[15px] font-semibold text-ink placeholder:text-light-gray outline-none focus:border-iris focus:border-2 disabled:bg-background disabled:text-[#4A4766]"
                                        placeholder="Enter passenger name"
                                        value={p.name}
                                        onChange={(e) => onUpdatePassenger(h.hold_id, { ...p, name: e.target.value })}
                                        disabled={isStudent} // Students usually just use their name which is prefilled
                                    />
                                </label>
                                {!isStudent && (
                                    <Select
                                        options={[
                                            { value: 'SELF', label: 'Myself' },
                                            { value: 'SPOUSE', label: 'Spouse' },
                                            { value: 'CHILD', label: 'Child' },
                                            { value: 'PARENT', label: 'Parent' },
                                            { value: 'GUEST', label: 'Guest' },
                                        ]}
                                        value={p.relation}
                                        onChange={(v) => onUpdatePassenger(h.hold_id, { ...p, relation: v as Passenger['relation'] })}
                                        placeholder="Select relation"
                                        className="h-12 rounded-xl bg-card border-input font-semibold text-sm"
                                        showLabel={false}
                                    />
                                )}
                                {isStudent && <span className="text-xs font-bold text-muted-foreground">Relation: Self</span>}
                            </div>
                        );
                    })}
                </div>
            </div>
        </Modal>
    );
}
