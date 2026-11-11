import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTransportStore } from '../store';

export default function BookingConfirmationPage() {
    const navigate = useNavigate();
    const {
        activeHolds,
        passengers,
        updatePassenger,
        confirmBooking,
        loading
    } = useTransportStore();

    const [submitting, setSubmitting] = useState(false);

    const handleConfirm = async () => {
        setSubmitting(true);
        try {
            const confirmations = activeHolds.map(h => ({
                holdId: h.id,
                passengerName: passengers[h.id]?.name || '',
                passengerRelation: passengers[h.id]?.relation || 'SELF'
            }));

            await confirmBooking(confirmations);
            navigate('/tickets');
        } catch (e) {
            setSubmitting(false);
        }
    };

    if (activeHolds.length === 0) {
        navigate('/transport');
        return null;
    }

    return (
        <div className="max-w-2xl mx-auto w-full pt-1 flex flex-col gap-5">
            <h1 className="font-display text-2xl font-extrabold text-ink tracking-tight">Confirm Booking Details</h1>

            <div className="flex flex-col gap-3">
                {activeHolds.map((hold, idx) => (
                    <div key={hold.id} className="bg-card rounded-[20px] p-4">
                        <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-[0.06em] mb-3">Ticket {idx + 1}</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-[#4A4766] mb-1">
                                    Passenger Name
                                </label>
                                <input
                                    type="text"
                                    value={passengers[hold.id]?.name || ''}
                                    onChange={(e) => updatePassenger(hold.id, {
                                        ...passengers[hold.id],
                                        name: e.target.value
                                    })}
                                    className="w-full h-12 px-3.5 rounded-xl border-[1.5px] border-input bg-card text-[15px] font-semibold text-ink outline-none focus:border-iris focus:border-2"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-[#4A4766] mb-1">
                                    Relation
                                </label>
                                <select
                                    value={passengers[hold.id]?.relation || 'SELF'}
                                    onChange={(e) => updatePassenger(hold.id, {
                                        ...passengers[hold.id],
                                        relation: e.target.value as 'SELF' | 'SPOUSE' | 'CHILD'
                                    })}
                                    className="w-full h-12 px-3.5 rounded-xl border-[1.5px] border-input bg-card text-[15px] font-semibold text-ink outline-none focus:border-iris focus:border-2"
                                >
                                    <option value="SELF">Self</option>
                                    <option value="SPOUSE">Spouse</option>
                                    <option value="CHILD">Child</option>
                                </select>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <button
                onClick={handleConfirm}
                disabled={submitting || loading}
                className="w-full h-14 rounded-[18px] bg-ink text-white text-base font-extrabold disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
            >
                {submitting ? 'Confirming...' : 'Confirm Booking'}
            </button>
        </div>
    );
}
