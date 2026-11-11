import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Check, Clock, Home, TriangleAlert } from 'lucide-react';
import { useWalletModuleStore } from '../store';
import { getTransactionStatus } from '../api';
import { PaymentStatus } from '../types';

/** Landing page after the card checkout redirects back (/payment/success|failed|error|pending?txn=…). */
const PaymentResultPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { fetchBalance } = useWalletModuleStore();
    const [resolvedStatus, setResolvedStatus] = useState<PaymentStatus | null>(null);
    const [gatewayMessage, setGatewayMessage] = useState<string | null>(null);

    const txn = searchParams.get('txn');
    const path = window.location.pathname;

    const pageIsSuccess = path.includes('success');
    const pageIsPending = path.includes('pending');
    const pageIsFailed = path.includes('failed') || path.includes('error');

    const isSuccess = resolvedStatus === 'SUCCESS' || (!resolvedStatus && pageIsSuccess);
    const isFailed = resolvedStatus === 'FAILED' || (!resolvedStatus && pageIsFailed);
    const isPending = (!isSuccess && !isFailed) && (pageIsPending || resolvedStatus === 'PENDING' || resolvedStatus === 'UNKNOWN');

    useEffect(() => {
        if (isSuccess) {
            fetchBalance();
        }
    }, [isSuccess, fetchBalance]);

    useEffect(() => {
        if (!txn) return;

        let cancelled = false;

        getTransactionStatus(txn)
            .then((result) => {
                if (cancelled) return;
                setResolvedStatus(result.status);
                setGatewayMessage(result.message || null);
                if (result.status === 'SUCCESS') {
                    fetchBalance();
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setGatewayMessage(null);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [txn, fetchBalance]);

    return (
        <div className="max-w-md mx-auto w-full pt-8 flex flex-col items-center gap-6 text-center">
            {isSuccess && (
                <>
                    <span className="size-28 rounded-full bg-volt flex items-center justify-center">
                        <span className="size-20 rounded-full bg-ink flex items-center justify-center">
                            <Check className="size-10 text-volt" strokeWidth={3} aria-hidden="true" />
                        </span>
                    </span>
                    <div className="flex flex-col gap-2" role="status">
                        <h1 className="font-display text-[30px] font-extrabold tracking-tight text-ink">Top-Up Successful!</h1>
                        <p className="text-[15px] leading-relaxed text-[#4A4766]">
                            Your payment has been processed and your wallet balance has been updated.
                        </p>
                    </div>
                </>
            )}

            {isFailed && (
                <>
                    <span className="size-28 rounded-[36px] bg-coral-tint flex items-center justify-center">
                        <TriangleAlert className="size-14 text-coral" aria-hidden="true" />
                    </span>
                    <div className="flex flex-col gap-2" role="alert">
                        <h1 className="font-display text-[30px] font-extrabold tracking-tight text-ink">Payment Failed</h1>
                        <p className="text-[15px] leading-relaxed text-[#4A4766]">
                            {gatewayMessage || "We couldn't process your payment. Please check your card details or try again with a different method."}
                        </p>
                    </div>
                </>
            )}

            {isPending && (
                <>
                    <span className="size-28 rounded-[36px] bg-signal-tint flex items-center justify-center">
                        <Clock className="size-14 text-[#B35F00] animate-pulse" aria-hidden="true" />
                    </span>
                    <div className="flex flex-col gap-2" role="status">
                        <h1 className="font-display text-[30px] font-extrabold tracking-tight text-ink">Payment Pending</h1>
                        <p className="text-[15px] leading-relaxed text-[#4A4766]">
                            {gatewayMessage || 'Your transaction is being verified by the gateway. This might take a few moments.'}
                        </p>
                    </div>
                </>
            )}

            {txn && (
                <div className="w-full bg-card rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                    <span className="text-[13px] text-muted-foreground">Transaction ref</span>
                    <span className="font-mono text-sm font-semibold text-ink break-all">{txn}</span>
                </div>
            )}

            <div className="w-full flex flex-col gap-2.5">
                <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="h-14 rounded-[18px] bg-ink text-white text-base font-extrabold flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                >
                    <Home className="size-5" aria-hidden="true" />
                    Back to Home
                </button>
                <button
                    type="button"
                    onClick={() => navigate(isFailed ? '/top-up' : '/wallet')}
                    className="h-12 rounded-2xl border-[1.5px] border-input bg-card text-ink text-[15px] font-extrabold focus-visible:outline-2 focus-visible:outline-iris"
                >
                    {isFailed ? 'Try Again' : 'View Wallet'}
                </button>
            </div>

            <p className="text-xs text-muted-foreground max-w-[300px] leading-relaxed">
                If the amount was deducted but doesn't show in your wallet, please contact support with your transaction reference.
            </p>
        </div>
    );
};

export default PaymentResultPage;
