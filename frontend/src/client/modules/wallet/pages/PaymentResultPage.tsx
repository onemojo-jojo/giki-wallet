
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, ArrowRight, Home, RefreshCcw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useWalletModuleStore } from '../store';
import { getTransactionStatus } from '../api';
import { PaymentStatus } from '../types';

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
        <div className="max-w-md mx-auto pt-12 pb-20 px-4 min-h-[80vh] flex flex-col items-center justify-center">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-gray-50 w-full text-center relative overflow-hidden group">
                {/* Decorative background elements */}
                <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20 ${isSuccess ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />

                {isSuccess && (
                    <div className="relative z-10 animate-in fade-in zoom-in duration-700">
                        <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8 relative">
                            <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-25" />
                            <CheckCircle2 className="w-14 h-14 text-green-500 relative z-10" />
                        </div>
                        <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">Top-Up Successful!</h1>
                        <p className="text-gray-500 mb-8 font-medium leading-relaxed">
                            Your payment has been processed and your wallet balance has been updated.
                        </p>
                        {txn && (
                            <div className="bg-gray-50 px-4 py-3 rounded-2xl mb-8 border border-gray-100">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Transaction Ref</p>
                                <p className="text-sm font-mono font-bold text-gray-700">{txn}</p>
                            </div>
                        )}
                    </div>
                )}

                {isFailed && (
                    <div className="relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-8">
                            <XCircle className="w-14 h-14 text-red-500" />
                        </div>
                        <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">Payment Failed</h1>
                        <p className="text-gray-500 mb-8 font-medium leading-relaxed">
                            {gatewayMessage || "We couldn't process your payment. Please check your card details or try again with a different method."}
                        </p>
                    </div>
                )}

                {isPending && (
                    <div className="relative z-10 animate-in fade-in zoom-in duration-700">
                        <div className="w-24 h-24 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-8">
                            <Clock className="w-14 h-14 text-yellow-500 animate-pulse" />
                        </div>
                        <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">Payment Pending</h1>
                        <p className="text-gray-500 mb-8 font-medium leading-relaxed">
                            {gatewayMessage || 'Your transaction is being verified by the gateway. This might take a few moments.'}
                        </p>
                    </div>
                )}

                <div className="space-y-4 relative z-10">
                    <Button
                        onClick={() => navigate('/')}
                        className="w-full py-7 rounded-2xl font-bold text-lg shadow-xl shadow-primary/10 group/btn"
                    >
                        <Home className="w-5 h-5 mr-2 group-hover/btn:-translate-y-0.5 transition-transform" />
                        Back to Home
                    </Button>

                    <Button
                        variant="ghost"
                        onClick={() => navigate('/top-up')}
                        className="w-full py-4 rounded-xl font-bold text-gray-500 hover:text-gray-900"
                    >
                        {isFailed ? 'Try Again' : 'View Wallet'}
                    </Button>
                </div>
            </div>

            <p className="mt-8 text-xs text-center text-gray-400 max-w-[280px] leading-relaxed">
                If the amount was deducted but doesn't show in your wallet, please contact support with your transaction reference.
            </p>
        </div>
    );
};

export default PaymentResultPage;
