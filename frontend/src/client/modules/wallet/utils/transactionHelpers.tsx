import { Ticket, Wallet, ArrowRightLeft, RotateCcw, Bus } from 'lucide-react';
import { ReactNode } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import type { ApiTransaction } from '../api';
import { formatTime } from './walletHelpers';

export type TransactionType = 'ticket' | 'topup' | 'transfer' | 'received' | 'refund';

export interface Transaction {
    id: string;
    type: TransactionType;
    description: string;
    amount: number;
    timestamp: string;
    date: string; // Format: YYYY-MM-DD (Asia/Karachi calendar day)
    referenceId?: string;
    balanceAfter?: number;
    createdAt?: string; // original ISO timestamp
}

const TIMEZONE = 'Asia/Karachi';

/** Absolute amount for display, e.g. 1,250 or 99.5. */
export const formatAmount = (n: number) => Math.abs(n).toLocaleString('en-PK', { maximumFractionDigits: 2 });

/** Map an API transaction to the UI model. Groups by the Karachi calendar day, not the UTC day. */
export const toTransaction = (t: ApiTransaction): Transaction => ({
    id: t.id,
    type: mapTxType(t.type),
    description: t.description,
    amount: t.amount,
    timestamp: formatTime(t.created_at),
    date: formatInTimeZone(new Date(t.created_at), TIMEZONE, 'yyyy-MM-dd'),
    referenceId: t.reference_id,
    balanceAfter: t.balance_after,
    createdAt: t.created_at,
});

export const getTransactionIcon = (type: TransactionType): ReactNode => {
    switch (type) {
        case 'ticket':
            return <Bus className="w-5 h-5" aria-hidden="true" />;
        case 'topup':
            return <Wallet className="w-5 h-5" aria-hidden="true" />;
        case 'transfer':
            return <ArrowRightLeft className="w-5 h-5" aria-hidden="true" />;
        case 'received':
            return <ArrowRightLeft className="w-5 h-5 -scale-x-100" aria-hidden="true" />;
        case 'refund':
            return <RotateCcw className="w-5 h-5" aria-hidden="true" />;
        default:
            return <Ticket className="w-5 h-5" aria-hidden="true" />;
    }
};

/** Icon tile colours: money in = mint, money out = iris. */
export const getIconBackground = (type: TransactionType): string => {
    switch (type) {
        case 'topup':
        case 'received':
        case 'refund':
            return 'bg-mint-tint text-mint';
        case 'ticket':
        case 'transfer':
        default:
            return 'bg-iris-tint text-iris-strong';
    }
};

export const mapTxType = (type: string): TransactionType => {
    switch (type) {
        case 'TRANSPORT_BOOKING': return 'ticket';
        case 'JAZZCASH_DEPOSIT': return 'topup';
        case 'REFUND': return 'refund';
        case 'TRANSFER': return 'transfer';
        case 'TRANSFER_RECEIVED': return 'received';
        default: return 'ticket';
    }
};

export const getTransactionTitle = (transaction: Transaction): string => {
    switch (transaction.type) {
        case 'ticket':
            return 'Ticket Booking';
        case 'topup':
            return 'Wallet Top-up';
        case 'transfer':
            return 'Money Sent';
        case 'received':
            return 'Money Received';
        case 'refund':
            return 'Refund Received';
        default:
            return transaction.description;
    }
};

/** Filter buckets used by the Wallet screen. */
export type TransactionFilter = 'all' | 'rides' | 'topups' | 'refunds' | 'transfers';

export const matchesFilter = (t: Transaction, filter: TransactionFilter) => {
    switch (filter) {
        case 'rides': return t.type === 'ticket';
        case 'topups': return t.type === 'topup';
        case 'refunds': return t.type === 'refund';
        case 'transfers': return t.type === 'transfer' || t.type === 'received';
        default: return true;
    }
};
