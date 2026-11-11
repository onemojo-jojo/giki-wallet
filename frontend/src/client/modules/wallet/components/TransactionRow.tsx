import { cn } from '@/lib/utils';
import { Transaction, getIconBackground, getTransactionIcon, getTransactionTitle } from '../utils/transactionHelpers';

export const formatAmount = (n: number) => Math.abs(n).toLocaleString('en-PK', { maximumFractionDigits: 2 });

interface TransactionRowProps {
    transaction: Transaction;
    onSelect?: (t: Transaction) => void;
    divider?: boolean;
}

/** One line in a transaction list. Opens the receipt when clicked. */
export const TransactionRow = ({ transaction, onSelect, divider }: TransactionRowProps) => {
    const isDebit = transaction.amount < 0;
    const title = getTransactionTitle(transaction);

    return (
        <button
            type="button"
            onClick={() => onSelect?.(transaction)}
            className={cn(
                'w-full flex items-center gap-3 py-3 text-left rounded-lg',
                'focus-visible:outline-2 focus-visible:outline-iris',
                divider && 'border-t border-[#F0EFF5]'
            )}
            aria-label={`${title}, ${isDebit ? 'minus' : 'plus'} Rs ${formatAmount(transaction.amount)}, ${transaction.timestamp}. Open receipt`}
        >
            <span className={cn('size-[42px] rounded-[14px] flex items-center justify-center shrink-0', getIconBackground(transaction.type))}>
                {getTransactionIcon(transaction.type)}
            </span>
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[15px] font-bold text-ink truncate" title={transaction.description}>
                    {title}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                    {transaction.timestamp}
                    {transaction.referenceId ? (
                        <>
                            {' · '}
                            <span className="font-mono">{transaction.referenceId}</span>
                        </>
                    ) : null}
                </span>
            </span>
            <span className={cn('font-display text-base font-extrabold tabular shrink-0', isDebit ? 'text-ink' : 'text-mint')}>
                {isDebit ? '−' : '+'}Rs {formatAmount(transaction.amount)}
            </span>
        </button>
    );
};
