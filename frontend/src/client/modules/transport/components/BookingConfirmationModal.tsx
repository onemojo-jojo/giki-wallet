import { Button } from '@/shared/components/ui/button';
import { Modal } from '@/shared/components/ui/Modal';
import { Select } from '@/shared/components/ui/Select';

export interface TripSummary {
    route: string | null;
    when: string;
    pickup: string;
    dropoff: string;
    seats: number;
    priceEach: number;
}

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

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Confirm booking"
            footer={
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        className="flex-1 h-14 rounded-2xl border-slate-200 font-bold text-xs text-slate-500 uppercase tracking-widest hover:bg-slate-50"
                        disabled={confirming}
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="flex-1 h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all duration-300"
                        disabled={confirming}
                        onClick={onConfirm}
                    >
                        {confirming ? 'Confirming…' : 'Confirm'}
                    </Button>
                </div>
            }
        >
            <div className="space-y-6">
                {outboundSummary && (
                    <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Outbound Trip</p>
                        <h4 className="text-sm font-bold text-slate-900 tracking-tight">{outboundSummary.route}</h4>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                            <p className="text-xs text-slate-500 font-medium">
                                {outboundSummary.when}
                            </p>
                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                            <p className="text-xs text-slate-500 font-bold">
                                {outboundSummary.seats} Seat(s)
                            </p>
                        </div>
                        <p className="text-[10px] font-black text-iris-strong uppercase tracking-widest mt-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                            {outboundSummary.pickup} → {outboundSummary.dropoff}
                        </p>
                    </div>
                )}

                {returnSummary && (
                    <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Return Trip</p>
                        <h4 className="text-sm font-bold text-slate-900 tracking-tight">{returnSummary.route}</h4>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                            <p className="text-xs text-slate-500 font-medium">
                                {returnSummary.when}
                            </p>
                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                            <p className="text-xs text-slate-500 font-bold">
                                {returnSummary.seats} Seat(s)
                            </p>
                        </div>
                        <p className="text-[10px] font-black text-iris-strong uppercase tracking-widest mt-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            {returnSummary.pickup} → {returnSummary.dropoff}
                        </p>
                    </div>
                )}

                <div className="pt-2">
                    <div className="flex items-center gap-2.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                        Passenger Details
                    </div>
                    <div className="space-y-4">
                        {allHolds.map((h, idx) => {
                            const p = passengers[h.hold_id] || { name: '', relation: 'SELF' as const };
                            return (
                                <div key={h.hold_id} className="p-5 rounded-2xl border border-slate-100 bg-white shadow-sm ring-1 ring-slate-200/5">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Seat #{idx + 1}</p>
                                    <div className="space-y-3">
                                        <input
                                            className="w-full h-12 border border-slate-100 rounded-xl px-4 text-sm font-bold text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all bg-slate-50/50 shadow-inner"
                                            placeholder="Enter passenger name"
                                            value={p.name}
                                            onChange={(e) => onUpdatePassenger(h.hold_id, { ...p, name: e.target.value })}
                                            disabled={isStudent} // Students usually just use their name which is prefilled
                                        />
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
                                                className="h-12 rounded-xl bg-slate-50/50 border-slate-100 font-bold text-sm shadow-inner"
                                                showLabel={false}
                                            />
                                        )}
                                        {isStudent && (
                                            <div className="px-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                Relation: Self
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
