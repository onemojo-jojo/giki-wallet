import axios from '@/lib/axios';
import { AdminTicketPaginationResponse } from './types';

export const getAdminTickets = async (
    startDate: string,
    endDate: string,
    busType: string = 'all',
    status: string = 'all',
    search: string = '',
    page: number = 1,
    pageSize: number = 20
): Promise<AdminTicketPaginationResponse> => {
    const { data } = await axios.get('/admin/tickets', {
        params: {
            start_date: startDate,
            end_date: endDate,
            bus_type: busType,
            status,
            search,
            page,
            page_size: pageSize,
        },
    });
    return data;
};
