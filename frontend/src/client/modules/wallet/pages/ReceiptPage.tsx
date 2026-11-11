import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, ChevronLeft, Copy } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { FeedbackModal } from '@/client/modules/feedback/components/FeedbackModal';
import { useFeedback } from '@/client/modules/feedback/hooks/useFeedback';
import { useWalletModuleStore } from '../store';
import { formatAmount, getIconBackground, getTransactionIcon, getTransactionTitle, toTransaction } from '../utils/transactionHelpers';

/** Full-page receipt for one transaction (v2-TxDetail). */
export const ReceiptPage = () => {
    const { id } = useParams<{ id: string }>();
    const { transactions, fetchHistory, isHistoryLoading, historyError } = useWalletModuleStore();
    // Whether we've fetched history at least once on this page (to catch rows newer than the cached list).
    const [refetched, setRefetched] = useState(false);
    const [copied, setCopied] = useState(false);
    const feedback = useFeedback();


    const t = useMemo(() => {
        const raw = transactions.find((x) => x.id === id);
        return raw ? toTransaction(raw) : null;
    }, [transactions, id]);

    // Not in the cached list (empty, stale or newer) → fetch history once.
    useEffect(() => {
        if (!t && !refetched) void fetchHistory().finally(() => setRefetched(true));
    }, [t, refetched, fetchHistory]);

    const back = (
        <Link
            to="/wallet"
            aria-label="Back to wallet"
            className="size-11 rounded-[14px] bg-card text-ink flex items-center justify-center focus-visible:outline-2 focus-visible:outline-iris"
        >
            <ChevronLeft className="size-[22px]" strokeWidth={2.2} />
        </Link>
    );

    if (!t) {
        return (
            <div className="max-w-xl mx-auto w-full flex flex-col gap-4 pt-1">
                <header className="flex items-center justify-between">
                    {back}
                    <h1 className="font-display font-extrabold text-xl text-ink">Receipt</h1>
                    <span className="w-11" />
                </header>
                {!refetched || isHistoryLoading ? (
                    <div className="bg-card rounded-3xl p-6 text-center text-[15px] font-bold text-[#4A4766]" aria-busy="true">
                        Loading receipt…
                    </div>
                ) : historyError ? (
                    <div role="alert" className="bg-coral-tint rounded-3xl p-5 flex items-center gap-3">
                        <span className="flex-1 text-sm font-bold text-[#8F1B21]">Couldn't load this receipt.</span>
                        <button
                            type="button"
                            onClick={() => void fetchHistory()}
                            className="h-10 px-4 rounded-xl bg-card text-[#8F1B21] text-sm font-extrabold focus-visible:outline-2 focus-visible:outline-coral"
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <div className="bg-card rounded-3xl p-6 text-center text-[15px] font-bold text-[#4A4766]">We couldn't find this transaction.</div>
                )}
            </div>
        );
    }

    const isDebit = t.amount < 0;
    const title = getTransactionTitle(t);
    const when = t.createdAt ? formatInTimeZone(new Date(t.createdAt), 'Asia/Karachi', 'EEE d MMM yyyy, h:mm a') : t.timestamp;
    const amountText = `${isDebit ? '−' : '+'}Rs ${formatAmount(t.amount)}`;

    const copyRef = async () => {
        if (!t.referenceId) return;
        try {
            await navigator.clipboard.writeText(t.referenceId);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            /* reference stays visible to select */
        }
    };

    const share = async () => {
        const text = [`Talaria receipt`, `${title}: ${amountText}`, when, t.description, t.referenceId ? `Ref ${t.referenceId}` : '', typeof t.balanceAfter === 'number' ? `Balance after: Rs ${formatAmount(t.balanceAfter)}` : '']
            .filter(Boolean)
            .join('\n');
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Talaria receipt', text });
            } else {
                await navigator.clipboard.writeText(text);
                toast.success('Receipt copied — paste it anywhere');
            }
        } catch (err) {
            // Cancelling the share sheet is fine; anything else (e.g. clipboard blocked) gets a message.
            if ((err as DOMException)?.name !== 'AbortError') toast.error("Couldn't share the receipt on this device");
        }
    };

    return (
        <div className="max-w-xl mx-auto w-full flex flex-col gap-4 pt-1">
            <header className="flex items-center justify-between">
                {back}
                <h1 className="font-display font-extrabold text-xl text-ink">Receipt</h1>
                <span className="w-11" />
            </header>

            <section className="bg-card rounded-3xl px-[18px] pt-6 pb-2 flex flex-col items-center gap-2 text-center">
                <span className={cn('size-14 rounded-[18px] flex items-center justify-center', getIconBackground(t.type))}>{getTransactionIcon(t.type)}</span>
                <span className="text-sm font-bold text-[#4A4766]">{title}</span>
                <span className={cn('font-display text-[44px] font-extrabold tracking-tight tabular leading-none', isDebit ? 'text-ink' : 'text-mint')}>{amountText}</span>
                <span className="flex items-center gap-1 text-xs font-extrabold text-mint bg-mint-tint px-2.5 py-1 rounded-full">
                    <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                    Completed
                </span>

                <dl className="w-full mt-3.5 flex flex-col text-left">
                    <div className="flex justify-between gap-3 py-[13px] border-t border-[#F0EFF5]">
                        <dt className="text-[13px] text-muted-foreground">Date</dt>
                        <dd className="text-sm font-bold text-ink text-right">{when}</dd>
                    </div>
                    {t.description && (
                        <div className="flex justify-between gap-3 py-[13px] border-t border-[#F0EFF5]">
                            <dt className="text-[13px] text-muted-foreground">Details</dt>
                            <dd className="text-sm font-bold text-ink text-right">{t.description}</dd>
                        </div>
                    )}
                    {t.referenceId && (
                        <div className="flex justify-between items-center gap-3 py-2 border-t border-[#F0EFF5]">
                            <dt className="text-[13px] text-muted-foreground">Reference</dt>
                            <dd className="flex items-center gap-1.5 min-w-0">
                                <span className="font-mono text-[13px] font-semibold text-ink truncate">{t.referenceId}</span>
                                <button
                                    type="button"
                                    onClick={() => void copyRef()}
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
                        <div className="flex justify-between gap-3 py-[13px] border-t border-[#F0EFF5]">
                            <dt className="text-[13px] text-muted-foreground">Balance after</dt>
                            <dd className="text-sm font-bold text-ink tabular">Rs {formatAmount(t.balanceAfter)}</dd>
                        </div>
                    )}
                </dl>
            </section>

            <div className="grid grid-cols-2 gap-2.5 mt-2">
                <button
                    type="button"
                    onClick={() => void share()}
                    className="h-[50px] rounded-2xl border-[1.5px] border-input bg-card text-ink text-sm font-extrabold focus-visible:outline-2 focus-visible:outline-iris"
                >
                    Share receipt
                </button>
                <button
                    type="button"
                    onClick={feedback.openFeedback}
                    className="h-[50px] rounded-2xl bg-iris-tint text-iris-strong text-sm font-extrabold focus-visible:outline-2 focus-visible:outline-iris"
                >
                    Report a problem
                </button>
            </div>

            <FeedbackModal
                isOpen={feedback.isOpen}
                onClose={feedback.closeFeedback}
                isPending={feedback.isPending}
                onSubmit={(rating, comment) =>
                    // Attach the transaction so support can find it.
                    feedback.submitFeedback(rating, `[Problem with transaction ${t.referenceId || t.id}, ${amountText}, ${when}] ${comment}`)
                }
            />
        </div>
    );
};

export default ReceiptPage;
