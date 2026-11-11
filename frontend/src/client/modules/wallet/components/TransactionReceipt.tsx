import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { Modal } from '@/shared/components/ui/Modal';
import { cn } from '@/lib/utils';
import { Transaction, formatAmount, getIconBackground, getTransactionIcon, getTransactionTitle } from '../utils/transactionHelpers';

interface TransactionReceiptProps {
    transaction: Transaction | null;
    onClose: () => void;
}

/** Receipt sheet for a single transaction. */
export const TransactionReceipt = ({ transaction, onClose }: TransactionReceiptProps) => {
    const [copied, setCopied] = useState(false);

    const copyRef = async (ref: string) => {
        try {
            await navigator.clipboard.writeText(ref);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard not available — the reference is still visible to select */
        }
    };

    const t = transaction;
    const isDebit = (t?.amount ?? 0) < 0;
    const when = t?.createdAt ? formatInTimeZone(new Date(t.createdAt), 'Asia/Karachi', 'EEE d MMM yyyy, h:mm a') : t?.timestamp;

    return (
        <Modal isOpen={!!t} onClose={onClose} title="Receipt" size="md">
            {t && (
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col items-center gap-2 text-center pt-1">
                        <span className={cn('size-14 rounded-[18px] flex items-center justify-center', getIconBackground(t.type))}>
                            {getTransactionIcon(t.type)}
                        </span>
                        <span className="text-sm font-bold text-[#4A4766]">{getTransactionTitle(t)}</span>
                        <span className={cn('font-display text-[40px] font-extrabold tracking-tight tabular leading-none', isDebit ? 'text-ink' : 'text-mint')}>
                            {isDebit ? '−' : '+'}Rs {formatAmount(t.amount)}
                        </span>
                    </div>

                    <dl className="flex flex-col">
                        <div className="flex justify-between gap-3 py-3 border-t border-[#F0EFF5]">
                            <dt className="text-[13px] text-muted-foreground">Details</dt>
                            <dd className="text-sm font-bold text-ink text-right">{t.description || '—'}</dd>
                        </div>
                        <div className="flex justify-between gap-3 py-3 border-t border-[#F0EFF5]">
                            <dt className="text-[13px] text-muted-foreground">Date</dt>
                            <dd className="text-sm font-bold text-ink text-right">{when}</dd>
                        </div>
                        {t.referenceId && (
                            <div className="flex justify-between items-center gap-3 py-2 border-t border-[#F0EFF5]">
                                <dt className="text-[13px] text-muted-foreground">Reference</dt>
                                <dd className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-mono text-[13px] font-semibold text-ink truncate">{t.referenceId}</span>
                                    <button
                                        type="button"
                                        onClick={() => void copyRef(t.referenceId!)}
                                        aria-label={copied ? 'Reference copied' : 'Copy reference'}
                                        className="size-9 rounded-xl bg-secondary text-ink flex items-center justify-center shrink-0 focus-visible:outline-2 focus-visible:outline-iris"
                                    >
                                        {copied ? <Check className="size-4 text-mint" /> : <Copy className="size-4" />}
                                    </button>
                                    <span role="status" className="sr-only">
                                        {copied ? 'Reference copied' : ''}
                                    </span>
                                </dd>
                            </div>
                        )}
                        {typeof t.balanceAfter === 'number' && (
                            <div className="flex justify-between gap-3 py-3 border-t border-[#F0EFF5]">
                                <dt className="text-[13px] text-muted-foreground">Balance after</dt>
                                <dd className="text-sm font-bold text-ink tabular">Rs {formatAmount(t.balanceAfter)}</dd>
                            </div>
                        )}
                    </dl>
                </div>
            )}
        </Modal>
    );
};
