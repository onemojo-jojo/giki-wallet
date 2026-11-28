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
        <div className="max-w-2xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">Confirm Booking Details</h1>

            <div className="space-y-4">
                {activeHolds.map((hold, idx) => (
                    <div key={hold.id} className="bg-white rounded-lg shadow p-4">
                        <h3 className="font-semibold mb-3">Ticket {idx + 1}</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Passenger Name
                                </label>
                                <input
                                    type="text"
                                    value={passengers[hold.id]?.name || ''}
                                    onChange={(e) => updatePassenger(hold.id, {
                                        ...passengers[hold.id],
                                        name: e.target.value
                                    })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Relation
                                </label>
                                <select
                                    value={passengers[hold.id]?.relation || 'SELF'}
                                    onChange={(e) => updatePassenger(hold.id, {
                                        ...passengers[hold.id],
                                        relation: e.target.value as 'SELF' | 'SPOUSE' | 'CHILD'
                                    })}
                                    className="w-full px-3 py-2 border rounded-lg"
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
                className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
                {submitting ? 'Confirming...' : 'Confirm Booking'}
            </button>
        </div>
    );
}
