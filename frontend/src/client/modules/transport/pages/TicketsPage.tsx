import { useState, useMemo, useEffect } from 'react'; // You already added this
import { useTransportStore } from '../store';
import { formatDateTime } from '../utils';
import { TicketCard } from '../components/TicketCard';
import { TicketCardSkeleton } from '../components/TicketCardSkeleton';
import { Loader2 } from 'lucide-react';
import { MyTicket } from '../validators';

export const TicketsPage = () => {
    const {
        activeHolds,
        releaseAllHolds,
        fetchUserTickets,
        myTickets,
        loading
    } = useTransportStore();

    useEffect(() => {
        void fetchUserTickets();
    }, [fetchUserTickets]);


    const upcomingTickets = useMemo(() => {
        const now = new Date();
        const cutoff = new Date(now.getTime() - (3 * 60 * 60 * 1000));

        const list: MyTicket[] = [];

        myTickets.forEach(ticket => {
            const departure = new Date(ticket.departure_time);

            if (ticket.status.startsWith('CANCELLED') || departure < cutoff) {
                return;
            }
            list.push(ticket);
        });

        list.sort((a, b) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime());
        return list;
    }, [myTickets]);

    return (
        <div className="space-y-4 max-w-5xl mx-auto pb-20 px-4 md:px-0">
            {/* Simplified Header */}
            <h1 className="text-xl font-bold text-gray-900 mb-4">My Tickets</h1>

            {/* Active Holds Section */}
            {activeHolds.length > 0 && (
                <div className="space-y-3 mb-4">
                    <h2 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                        Active Reservations
                    </h2>
                    <div className="space-y-2">
                        {activeHolds.map(hold => (
                            <div key={hold.id} className="bg-orange-50 p-3 rounded-lg border border-orange-200 flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-orange-900">{hold.route_name}</p>
                                    <p className="text-xs text-orange-700 mt-1">
                                        Expires {formatDateTime(hold.expires_at)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => releaseAllHolds()}
                                    className="px-3 py-1.5 bg-white text-orange-700 text-xs font-medium rounded-md hover:bg-orange-100 border border-orange-300 transition"
                                >
                                    Release
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Confirmed Tickets Section */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-gray-700">Your Schedule</h2>
                    {loading && <span className="text-xs text-gray-400">Syncing...</span>}
                </div>

                {loading && upcomingTickets.length === 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3].map((i) => (
                            <TicketCardSkeleton key={i} />
                        ))}
                    </div>
                ) : upcomingTickets.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                        <p className="text-sm text-gray-500">No upcoming trips.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {upcomingTickets.map(ticket => (
                            <TicketCard key={ticket.ticket_id} ticket={ticket} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};