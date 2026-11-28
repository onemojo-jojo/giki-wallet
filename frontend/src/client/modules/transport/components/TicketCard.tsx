import { MyTicket } from '../validators';
import { formatDateTime } from '../utils';
import { cn } from '@/lib/utils';
import { Ticket, Bus, MapPin, Calendar, User, Loader2, Hash, Clock, Navigation, AlertTriangle } from 'lucide-react';
import { useTransportStore } from '../store';
import { useState } from 'react';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/button';

interface TicketCardProps {
    ticket: MyTicket;
}

export const TicketCard = ({ ticket }: TicketCardProps) => {
    const { cancelTicket } = useTransportStore();
    const [isCancelling, setIsCancelling] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const isCancelled = ticket.status.startsWith('CANCELLED');
    const isAdminCancelled = ticket.status === 'CANCELLED_BY_ADMIN';
    const statusLabel = isAdminCancelled
        ? 'Cancelled by the transport office'
        : ticket.status;
    const isSelf = ticket.is_self;
    const canCancel = !isCancelled && ticket.is_cancellable;

    const handleCancel = async () => {
        setIsCancelling(true);
        try {
            await cancelTicket(ticket.ticket_id);
            setShowConfirm(false);
        } finally {
            setIsCancelling(false);
        }
    };

    return (
        <>
            <Modal
                isOpen={showConfirm}
                onClose={() => !isCancelling && setShowConfirm(false)}
                title="Cancel Ticket"
                size="sm"
                footer={
                    <div className="flex gap-3 justify-end w-full">
                        <Button
                            variant="outline"
                            onClick={() => setShowConfirm(false)}
                            disabled={isCancelling}
                        >
                            Keep Ticket
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleCancel}
                            disabled={isCancelling}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isCancelling ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Cancelling...
                                </>
                            ) : (
                                'Yes, Cancel Trip'
                            )}
                        </Button>
                    </div>
                }
            >
                <div className="py-2">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 flex gap-3 text-amber-800">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm">
                            Are you sure you want to cancel this ticket? This action cannot be undone and your seat will be released immediately.
                        </p>
                    </div>
                    {ticket.price > 0 && (
                        <p className="text-sm text-gray-500">
                            A refund of <span className="font-medium text-gray-900">PKR {ticket.price}</span> will be credited to your wallet.
                        </p>
                    )}
                </div>
            </Modal>

            <div className={cn(
                "group relative w-full bg-white rounded-[2rem] border border-slate-100 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1",
                isCancelled && "grayscale opacity-80"
            )}>
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

                <div className="relative z-10 flex flex-col">

                    {/* 1. KEY ACCESS HEADER (The "Important Things") */}
                    <div className="p-6 bg-slate-50/50 border-b border-dashed border-slate-200 space-y-6">
                        <div className="flex justify-between items-start">
                            {/* Route Name & Direction */}
                            <div>
                                <span className={cn(
                                    "inline-block px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest mb-2 border",
                                    ticket.direction === 'OUTBOUND'
                                        ? "bg-blue-50 text-blue-600 border-blue-100"
                                        : "bg-purple-50 text-purple-600 border-purple-100"
                                )}>
                                    {ticket.direction}
                                </span>
                                <h3 className="text-2xl font-black text-slate-900 leading-none tracking-tighter uppercase">
                                    {ticket.route_name}
                                </h3>
                            </div>
                            {/* Status */}
                            <div className={cn(
                                "px-3 py-1.5 rounded-xl border flex items-center gap-2 bg-white shadow-sm",
                                isCancelled ? "border-red-100" : "border-slate-100"
                            )}>
                                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", isCancelled ? "bg-red-500" : "bg-accent animate-pulse")} />
                                <span className={cn(
                                    "text-[10px] font-black tracking-widest",
                                    isCancelled ? "text-red-500" : "text-slate-500",
                                    !isAdminCancelled && "uppercase"
                                )}>
                                    {statusLabel}
                                </span>
                            </div>
                        </div>

                        {/* VITAL INFO ROW: Time, Seat, Code */}
                        <div className="grid grid-cols-3 gap-4">
                            {/* DEPARTURE TIME */}
                            <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Time</span>
                                </div>
                                <p className="font-bold text-slate-900 text-sm leading-tight">
                                    {new Date(ticket.departure_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                </p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">
                                    {new Date(ticket.departure_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </p>
                            </div>

                            {/* SEAT NUMBER (Highlighted) */}
                            <div className="bg-slate-900 p-3 rounded-2xl border border-slate-900 shadow-md shadow-slate-200 flex flex-col justify-between group-hover:scale-105 transition-transform">
                                <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                                    <Hash className="w-3.5 h-3.5" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Serial</span>
                                </div>
                                <p className="font-black text-white text-3xl leading-none tracking-tighter">
                                    {ticket.serial_no.toString().padStart(2, '0')}
                                </p>
                            </div>

                            {/* TICKET CODE */}
                            <div className="bg-white p-3 rounded-2xl border border-dashed border-slate-300 shadow-sm flex flex-col justify-between">
                                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                                    <Ticket className="w-3.5 h-3.5" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Code</span>
                                </div>
                                <p className="font-mono font-bold text-slate-900 text-sm tracking-widest uppercase truncate">
                                    {ticket.ticket_code.split('-')[0]}
                                </p>
                                <p className="text-[8px] font-bold text-slate-300 uppercase truncate">
                                    #{ticket.ticket_code}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 2. JOURNEY DETAILS CONTENT (The "Other Things") */}
                    <div className="p-6 space-y-6">
                        {/* Location Timeline */}
                        <div className="relative pl-4 space-y-6">
                            {/* Timeline Line */}
                            <div className="absolute left-[0.45rem] top-2 bottom-6 w-0.5 bg-gradient-to-b from-slate-200 to-transparent" />

                            {/* Pickup */}
                            <div className="relative">
                                <div className="absolute -left-[1.35rem] mt-0.5 w-3 h-3 rounded-full border-2 border-primary bg-white z-10" />
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pickup</p>
                                    <p className="font-bold text-slate-900 leading-tight">{ticket.pickup_location}</p>
                                </div>
                            </div>

                            {/* Dropoff */}
                            <div className="relative">
                                <div className="absolute -left-[1.35rem] mt-0.5 w-3 h-3 rounded-full border-2 border-slate-300 bg-white z-10" />
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dropoff</p>
                                    <p className="font-bold text-slate-900 leading-tight">{ticket.dropoff_location}</p>
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="h-px w-full bg-slate-50" />

                        {/* Footer Infos: Bus Type, Passenger, Price */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                                        <Bus className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bus</p>
                                        <p className="font-bold text-slate-900 text-xs">{ticket.bus_type}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 text-right">
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Passenger</p>
                                        <p className="font-bold text-slate-900 text-xs flex items-center gap-1 justify-end">
                                            {ticket.passenger_name}
                                            {isSelf && <User className="w-3 h-3 text-primary" />}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-[10px] font-bold text-slate-400 mr-1">paid</span>
                                    <span className="text-xl font-black text-primary">PKR {ticket.price}</span>
                                </div>

                                {canCancel && (
                                    <button
                                        onClick={() => setShowConfirm(true)}
                                        disabled={isCancelling}
                                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50"
                                    >
                                        {isCancelling ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                        ) : null}
                                        Cancel Ticket
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
