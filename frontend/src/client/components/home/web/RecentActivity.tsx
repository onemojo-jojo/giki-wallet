import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useWalletModuleStore } from '@/client/modules/wallet/store';
import { formatAmount, getTransactionTitle, toTransaction } from '@/client/modules/wallet/utils/transactionHelpers';

/** Web home "Recent activity" (v2-Web): last three transactions, each opens its receipt. */
export const RecentActivity = () => {
    const navigate = useNavigate();
    const { transactions, fetchHistory, isHistoryLoading, historyError } = useWalletModuleStore();

    useEffect(() => {
        void fetchHistory();
    }, [fetchHistory]);

    const recent = useMemo(() => transactions.slice(0, 3).map(toTransaction), [transactions]);

    return (
        <section aria-labelledby="web-activity" className="bg-card rounded-3xl p-5 flex flex-col gap-1.5">
            <div className="flex justify-between items-baseline">
                <h2 id="web-activity" className="font-display text-xl font-extrabold text-ink">
                    Recent activity
                </h2>
                <Link to="/wallet" className="text-[13px] font-extrabold text-iris-strong hover:underline">
                    View all
                </Link>
            </div>
            {recent.length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">
                    {isHistoryLoading ? 'Loading…' : historyError ? "Couldn't load your activity." : 'No transactions yet.'}
                </p>
            ) : (
                <ul>
                    {recent.map((t) => {
                        const debit = t.amount < 0;
                        return (
                            <li key={t.id}>
                                <button
                                    type="button"
                                    onClick={() => navigate(`/wallet/receipt/${t.id}`)}
                                    className="w-full flex items-center gap-3 py-2.5 border-t border-[#F0EFF5] text-left rounded-lg focus-visible:outline-2 focus-visible:outline-iris"
                                >
                                    <span className="flex-1 min-w-0 flex flex-col">
                                        <span className="font-bold text-ink truncate">{getTransactionTitle(t)}</span>
                                        <span className="text-xs text-muted-foreground">{t.timestamp}</span>
                                    </span>
                                    <span className={cn('font-display text-base font-extrabold tabular', debit ? 'text-ink' : 'text-mint')}>
                                        {debit ? '−' : '+'}Rs {formatAmount(t.amount)}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};
