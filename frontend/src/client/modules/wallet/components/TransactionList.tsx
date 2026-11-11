import { useMemo } from 'react';
import { formatDate, groupTransactionsByDate } from '../utils/walletHelpers';
import { Transaction } from '../utils/transactionHelpers';
import { TransactionRow } from './TransactionRow';

interface TransactionListProps {
    transactions: Transaction[];
    onSelect: (t: Transaction) => void;
    /** Card background behind each day's rows (Wallet page uses cards; the sheet doesn't). */
    variant?: 'cards' | 'plain';
}

/** Transactions grouped by Karachi calendar day, newest first. */
export const TransactionList = ({ transactions, onSelect, variant = 'cards' }: TransactionListProps) => {
    const groups = useMemo(() => groupTransactionsByDate(transactions), [transactions]);

    return (
        <div className="flex flex-col gap-4">
            {groups.map(({ date, transactions: rows }) => (
                <section key={date} className="flex flex-col gap-2" aria-label={formatDate(date)}>
                    <h3
                        className={
                            variant === 'plain'
                                ? 'sticky top-0 z-10 bg-white/90 backdrop-blur-md py-2 px-1 text-xs font-extrabold tracking-[0.08em] uppercase text-muted-foreground'
                                : 'px-1 text-xs font-extrabold tracking-[0.08em] uppercase text-muted-foreground'
                        }
                    >
                        {formatDate(date)}
                    </h3>
                    <div className={variant === 'cards' ? 'bg-card rounded-[20px] px-3.5' : ''}>
                        {rows.map((t, i) => (
                            <TransactionRow key={t.id} transaction={t} onSelect={onSelect} divider={i > 0} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
};
