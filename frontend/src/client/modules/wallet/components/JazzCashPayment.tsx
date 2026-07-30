import React from 'react';
import { Phone, CheckCircle2, XCircle, Loader2, Smartphone, ShieldCheck, Clock } from 'lucide-react';
import { toast } from '@/lib/toast';
import { JAZZCASH_PAYMENT_TIMEOUT_SECONDS, useJazzCashPayment } from '../hooks/useJazzCashPayment';

interface JazzCashPaymentProps {
    amount: number;
    phoneNumber: string;
    cnicLast6: string;
    onSuccess?: () => void;
    onFailure?: (error: string) => void;
    maxLimit?: number;
    currentBalance?: number;
}

const JazzCashPayment: React.FC<JazzCashPaymentProps> = ({
    amount,
    phoneNumber,
    cnicLast6,
    onSuccess,
    onFailure,
    maxLimit,
    currentBalance
}) => {
    // 1. Destructure the new props here
    const {
        status,
        timeLeft,
        errorMessage,
        initiatePayment,
        reset,
        statusMessage, // New dynamic message
        showTimer      // New boolean to toggle the countdown visibility
    } = useJazzCashPayment(
        amount,
        phoneNumber,
        cnicLast6
    );

    // Sync with parent callbacks
    React.useEffect(() => {
        if (status === 'success') {
            toast.success(`G-Bux ${amount.toLocaleString()} added to wallet!`);
            if (onSuccess) onSuccess();
        }
        if (status === 'failed' && onFailure) onFailure(errorMessage || 'Unknown error');
    }, [status, onSuccess, onFailure, errorMessage, amount]);

    if (status === 'success') {
        return (
            <div className="bg-white p-8 rounded-3xl shadow-2xl border border-green-100 max-w-sm mx-auto text-center transform transition-all scale-100 animate-in fade-in zoom-in">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
                <p className="text-gray-500 mb-6 font-medium">RS {amount.toLocaleString()} has been added to your wallet.</p>
                <button
                    onClick={() => window.location.href = '/'}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-2xl transition-all"
                >
                    Back to Home
                </button>
            </div>
        );
    }

    if (status === 'failed') {
        return (
            <div className="bg-white p-8 rounded-3xl shadow-2xl border border-red-100 max-w-sm mx-auto text-center animate-in fade-in slide-in-from-bottom-4">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <XCircle className="w-12 h-12 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h2>
                <p className="text-gray-500 mb-6 font-medium px-4">{errorMessage || 'Something went wrong.'}</p>
                <button
                    onClick={reset}
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl transition-all"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white p-8 rounded-[2rem] shadow-2xl border border-gray-100 max-w-sm mx-auto overflow-hidden relative">
            <div className={`absolute top-0 left-0 w-full h-1 transition-all duration-1000 bg-primary ${status !== 'idle' ? 'opacity-100' : 'opacity-0'}`}
                style={{ width: `${(timeLeft / JAZZCASH_PAYMENT_TIMEOUT_SECONDS) * 100}%` }} />

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h3 className="text-primary font-black tracking-tighter text-xl italic uppercase">JazzCash</h3>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">M-Wallet Payment</p>
                    </div>
                    <div className="bg-primary/5 p-3 rounded-2xl">
                        <Smartphone className={`w-6 h-6 text-primary ${(status === 'initiating' || status === 'processing') ? 'animate-bounce' : ''}`} />
                    </div>
                </div>

                {(status === 'initiating' || status === 'processing') ? (
                    <div className="space-y-8 py-4 animate-in fade-in duration-700">

                        {/* 2. Logic for the Big Central Icon/Timer */}
                        <div className="text-center min-h-[140px] flex flex-col items-center justify-center">
                            {status === 'processing' ? (
                                <>
                                    {showTimer ? (
                                        // Urgent Phase (Last 60s): Show Countdown
                                        <div className="relative inline-block animate-in zoom-in duration-300">
                                            <div className="absolute inset-0 bg-red-500/10 rounded-full scale-150 animate-ping opacity-20" />
                                            <h1 className="text-6xl font-black text-red-500 tabular-nums">
                                                0:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
                                            </h1>
                                            <p className="text-red-400 text-sm font-bold uppercase tracking-tighter mt-4">Hurry Up!</p>
                                        </div>
                                    ) : (
                                        // Buffer Phase (First 40s): Show waiting icon instead of timer
                                        <div className="relative inline-block animate-in fade-in duration-500">
                                            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center relative z-10 mx-auto">
                                                <Clock className="w-12 h-12 text-primary animate-pulse" />
                                            </div>
                                            <p className="text-primary/60 text-sm font-bold uppercase tracking-tighter mt-4">Waiting for Approval...</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                // Initiating state
                                <div className="flex justify-center py-2">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-yellow-500/20 rounded-full animate-ping" />
                                        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center relative z-10">
                                            <Smartphone className="w-8 h-8 text-yellow-600 animate-pulse" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 relative overflow-hidden">
                            {/* Security Strip */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-shimmer" />

                            <div className="flex gap-4 items-center relative z-10">
                                <div className={`w-10 h-10 rounded-xl shadow-sm flex items-center justify-center shrink-0 transition-colors duration-500 ${status === 'initiating' ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'}`}>
                                    {status === 'initiating' ? <ShieldCheck className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
                                </div>
                                <div className="text-left">
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                                        {status === 'initiating' ? 'Requesting' : 'Action Required'}
                                    </p>
                                    <p className="text-sm font-bold text-gray-900">
                                        {status === 'initiating' ? 'Sending Payment Request...' : 'Check Your Phone'}
                                    </p>
                                </div>
                            </div>

                            {/* 3. Logic for the Text Message */}
                            <p className="text-[11px] text-gray-500 mt-4 leading-relaxed font-medium pl-14">
                                {status === 'initiating'
                                    ? "We're sending a payment request to your JazzCash app. Please keep your phone ready."
                                    : statusMessage // Use the dynamic message from the hook
                                }
                            </p>
                        </div>

                        <div className="flex items-center justify-center gap-2 text-primary">
                            {status === 'initiating' ? (
                                <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] italic text-gray-400">Processing...</span>
                                </>
                            ) : (
                                <div className="px-3 py-1 bg-primary/10 rounded-full flex items-center gap-2">
                                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Live Transaction</span>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-gray-50 p-6 rounded-2xl">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-sm text-gray-400 font-medium">Payable Amount</span>
                                <span className="text-xl font-black text-gray-900 tracking-tight">RS {amount.toLocaleString()}</span>
                            </div>
                            <div className="h-[1px] bg-gray-200 mb-4" />
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-400 font-medium">Account Number</span>
                                <span className="text-sm font-bold text-gray-900">{phoneNumber}</span>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                if (maxLimit && (currentBalance ?? 0) + amount > maxLimit) {
                                    toast.error(`Top-up would exceed maximum allowed wallet balance of RS ${maxLimit}`);
                                    return;
                                }
                                initiatePayment();
                            }}
                            disabled={!amount || !phoneNumber}
                            className="w-full bg-gray-900 hover:bg-black disabled:bg-gray-400 text-white font-bold py-5 rounded-2xl shadow-xl shadow-gray-200 transition-all flex items-center justify-center gap-3 overflow-hidden group"
                        >
                            <span className="relative z-10">Pay with JazzCash</span>
                            <Smartphone className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>

                        <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">
                            <ShieldCheck className="w-3 h-3" />
                            Secured by State-of-the-Art Encryption
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default JazzCashPayment;