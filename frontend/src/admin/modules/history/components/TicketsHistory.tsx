import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, TableWrapper, getWeekStart, getWeekEnd } from '../../../shared';
import { Input } from '@/shared/components/ui/Input';
import { Select } from '@/shared/components/ui/Select';
import { Badge } from './HistoryBadge';
import { formatDate, formatCurrency, formatTime } from '../utils/formatting';
import { AdminTicket } from '../../tickets/types';
import { getAdminTickets } from '../../tickets/service';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { toast } from 'sonner';

interface TicketsHistoryProps {
    selectedWeek: Date;
}

export const TicketsHistory = ({ selectedWeek }: TicketsHistoryProps) => {
    const [tickets, setTickets] = useState<AdminTicket[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [totalCount, setTotalCount] = useState(0);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterBusType, setFilterBusType] = useState<string>('all');

    const debouncedSearch = useDebounce(searchTerm, 500);

    const weekStart = useMemo(() => getWeekStart(selectedWeek), [selectedWeek]);
    const weekEnd = useMemo(() => getWeekEnd(selectedWeek), [selectedWeek]);

    const fetchTickets = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await getAdminTickets(
                weekStart.toISOString(),
                weekEnd.toISOString(),
                filterBusType,
                filterStatus,
                debouncedSearch,
                1, // Default to page 1 for history view for now
                100 // Large page size to show enough history
            );
            setTickets(response.data);
            setTotalCount(response.total_count);
        } catch (error) {
            console.error('Failed to fetch ticket history:', error);
            toast.error('Failed to load ticket history');
        } finally {
            setIsLoading(false);
        }
    }, [weekStart, weekEnd, filterBusType, filterStatus, debouncedSearch]);

    useEffect(() => {
        void fetchTickets();
    }, [fetchTickets]);

    const headers = [
        { content: 'Travel Date', align: 'left' as const },
        { content: 'Ticket #', align: 'left' as const },
        { content: 'Passenger', align: 'left' as const },
        { content: 'Route', align: 'left' as const },
        { content: 'Status', align: 'left' as const },
        { content: 'Bus Type', align: 'left' as const },
        { content: 'Price', align: 'right' as const },
        { content: 'Booked At', align: 'left' as const },
    ];

    const rows = tickets.map((ticket) => ({
        key: ticket.ticket_id,
        cells: [
            <div key="departureDate">
                <div className="text-sm font-medium text-gray-900">{formatDate(ticket.departure_time)}</div>
                <div className="text-xs text-gray-500">
                    {formatTime(ticket.departure_time)}
                </div>
            </div>,
            <div key="ticketCode">
                <div className="text-sm font-medium text-gray-900">#{ticket.ticket_code}</div>
                <div className="text-xs text-gray-500">Serial: {ticket.serial_no}</div>
            </div>,
            <div key="passenger">
                <div className="text-sm font-medium text-gray-900">{ticket.passenger_name}</div>
                <div className="text-xs text-gray-500">
                    {ticket.user_name} ({ticket.passenger_relation})
                </div>
            </div>,
            <div key="route">
                <div className="text-sm font-medium text-gray-900">
                    {ticket.direction === 'from-giki' ? 'From GIKI' : 'To GIKI'} → {ticket.route_name}
                </div>
                <div className="text-xs text-gray-500">{ticket.pickup_location}</div>
            </div>,
            <Badge key="status" type="ticketStatus" value={ticket.status} />,
            <Badge key="bus_type" type="busType" value={ticket.bus_type} />,
            <div key="price" className="text-right">
                <div className="text-sm font-semibold text-gray-900">{formatCurrency(ticket.price)}</div>
                {ticket.refund_amount && (
                    <div className="text-xs text-red-600">Refund: {formatCurrency(ticket.refund_amount)}</div>
                )}
            </div>,
            <div key="bookedAt" className="text-sm text-gray-600">{formatDate(ticket.booking_time)}</div>,
        ],
    }));

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <Input
                        placeholder="Search by ticket code, passenger, user..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full"
                    />
                </div>
                <div className="w-full md:w-64">
                    <Select
                        value={filterStatus}
                        onChange={(value) => setFilterStatus(value)}
                        options={[
                            { value: 'all', label: 'All Statuses' },
                            { value: 'CONFIRMED', label: 'Confirmed' },
                            { value: 'PENDING', label: 'Pending' },
                            { value: 'CANCELLED', label: 'Cancelled' },
                        ]}
                        placeholder="Status"
                    />
                </div>
                <div className="w-full md:w-64">
                    <Select
                        value={filterBusType}
                        onChange={(value) => setFilterBusType(value)}
                        options={[
                            { value: 'all', label: 'All Bus Types' },
                            { value: 'Student', label: 'Student' },
                            { value: 'Employee', label: 'Employee' },
                        ]}
                        placeholder="Bus Type"
                    />
                </div>
            </div>

            {/* Table */}
            <TableWrapper count={totalCount || tickets.length} itemName="ticket">
                {isLoading ? (
                    <div className="p-8 text-center text-gray-500">Loading history...</div>
                ) : (
                    <Table headers={headers} rows={rows} emptyMessage="No ticket history found." />
                )}
            </TableWrapper>
        </div>
    );
};
