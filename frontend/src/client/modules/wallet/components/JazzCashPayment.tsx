import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Clock, Lock, Smartphone, TriangleAlert } from 'lucide-react';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { JAZZCASH_PAYMENT_TIMEOUT_SECONDS, useJazzCashPayment } from '../hooks/useJazzCashPayment';
import { useWalletModuleStore } from '../store';
import { formatAmount } from '../utils/transactionHelpers';
import { TopUpStepHeader } from './TopUpStepHeader';

interface JazzCashPaymentProps {
    amount: number;
    onSuccess?: () => void;
    onFailure?: (error: string) => void;
    maxLimit?: number;
    currentBalance?: number;
    /** Back to the payment-method step (only while nothing has been sent). */
    onBack?: () => void;
    /** Switch to card payment after a failure. */
    onUseCard?: () => void;
}

const MOBILE_RE = /^03\d{9}$/;
const CNIC_RE = /^\d{6}$/;

const RING_R = 96;
const RING_C = 2 * Math.PI * RING_R;

/** Gateway/API messages are shown as-is, but raw validation dumps (JSON) get a plain sentence instead. */
const readableError = (msg: string | null) => {
    const text = (msg ?? '').trim();
    if (!text || text.startsWith('[') || text.startsWith('{')) return 'Something went wrong. Please try again.';
    return text;
};

const formatClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, '0')}`;

/**
 * JazzCash mobile-wallet top-up: account details → approve in the JazzCash app
 * (countdown) → success / failure. Payment logic lives in useJazzCashPayment.
 */
const JazzCashPayment: React.FC<JazzCashPaymentProps> = ({ amount, onSuccess, onFailure, maxLimit, currentBalance, onBack, onUseCard }) => {
    const navigate = useNavigate();
    const { formData, setMobileNumber, setCnicLastSix, balance } = useWalletModuleStore();
    const phoneNumber = formData.mobile_number;
    const cnicLast6 = formData.cnic_last_six;

    const { status, timeLeft, errorMessage, initiatePayment, reset, statusMessage, showTimer } = useJazzCashPayment(amount, phoneNumber, cnicLast6);

    // Sync with parent callbacks
    React.useEffect(() => {
        if (status === 'success') {
            toast.success(`G-Bux ${amount.toLocaleString()} added to wallet!`);
            if (onSuccess) onSuccess();
        }
        if (status === 'failed' && onFailure) onFailure(errorMessage || 'Unknown error');
    }, [status, onSuccess, onFailure, errorMessage, amount]);

    const mobileValid = MOBILE_RE.test(phoneNumber);
    const cnicValid = CNIC_RE.test(cnicLast6);

    const send = () => {
        if (maxLimit && (currentBalance ?? 0) + amount > maxLimit) {
            toast.error(`Top-up would exceed maximum allowed wallet balance of RS ${maxLimit}`);
            return;
        }
        void initiatePayment();
    };

    // ---------------- Success ----------------
    if (status === 'success') {
        return (
            <div className="flex flex-col gap-6 items-center text-center pt-10 animate-in fade-in zoom-in duration-300">
                <span className="size-28 rounded-full bg-volt flex items-center justify-center">
                    <span className="size-20 rounded-full bg-ink flex items-center justify-center">
                        <Check className="size-10 text-volt" strokeWidth={3} aria-hidden="true" />
                    </span>
                </span>
                <div className="flex flex-col gap-1.5" role="status">
                    <span className="text-[15px] font-bold text-[#4A4766]">Payment successful — added to G-Bux</span>
                    <span className="font-display text-[56px] font-extrabold tracking-tight leading-none text-ink tabular">Rs {formatAmount(amount)}</span>
                    <span className="text-[15px] text-[#4A4766]">
                        New balance <strong className="text-ink">Rs {formatAmount(balance)}</strong>
                    </span>
                </div>
                <div className="w-full flex flex-col gap-2.5 mt-4">
                    <button
                        type="button"
                        onClick={() => (window.location.href = '/')}
                        className="h-14 rounded-[18px] bg-ink text-white text-base font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                    >
                        Back to Home
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/wallet')}
                        className="h-11 rounded-xl text-iris-strong text-sm font-extrabold focus-visible:outline-2 focus-visible:outline-iris"
                    >
                        View wallet
                    </button>
                </div>
            </div>
        );
    }

    // ---------------- Failed / timed out ----------------
    if (status === 'failed') {
        return (
            <div className="flex flex-col gap-5 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <span className="self-center size-28 rounded-[36px] bg-signal-tint flex items-center justify-center">
                    <TriangleAlert className="size-14 text-[#B35F00]" aria-hidden="true" />
                </span>
                <div className="flex flex-col gap-2 text-center" role="alert">
                    <h1 className="font-display text-[28px] font-extrabold tracking-tight text-ink">Payment didn't go through</h1>
                    <p className="text-[15px] leading-relaxed text-[#4A4766]">{readableError(errorMessage)}</p>
                </div>
                <div className="bg-card rounded-[20px] p-4 flex flex-col gap-2">
                    <h2 className="text-xs font-extrabold tracking-[0.06em] uppercase text-muted-foreground">Common fixes</h2>
                    <ul className="list-disc pl-5 flex flex-col gap-1.5 text-sm text-[#4A4766]">
                        <li>Keep the JazzCash app open and signed in.</li>
                        <li>Check your JazzCash balance covers Rs {formatAmount(amount)}.</li>
                        <li>Make sure the CNIC digits match the account holder.</li>
                    </ul>
                </div>
                <p className="text-xs text-center text-muted-foreground">
                    If money left your JazzCash account but isn't in G-Bux, contact support with the time of your payment.
                </p>
                <div className="flex flex-col gap-2.5">
                    <button
                        type="button"
                        onClick={reset}
                        className="h-14 rounded-[18px] bg-primary text-primary-foreground text-base font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                    >
                        Try Again
                    </button>
                    {onUseCard && (
                        <button
                            type="button"
                            onClick={() => {
                                reset();
                                onUseCard();
                            }}
                            className="h-12 rounded-2xl border-[1.5px] border-input bg-card text-ink text-[15px] font-extrabold focus-visible:outline-2 focus-visible:outline-iris"
                        >
                            Use a card instead
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // ---------------- Waiting for approval ----------------
    if (status === 'initiating' || status === 'processing') {
        const progress = Math.max(0, Math.min(1, timeLeft / JAZZCASH_PAYMENT_TIMEOUT_SECONDS));
        const urgent = status === 'processing' && showTimer;
        const steps = [
            { label: 'Request sent to JazzCash', state: status === 'processing' ? 'done' : 'now' },
            { label: 'Enter your MPIN in the JazzCash app', state: status === 'processing' ? 'now' : 'next' },
            { label: 'G-Bux updates here automatically', state: 'next' },
        ] as const;

        return (
            <div className="-mx-4 -mt-4 md:mx-0 md:mt-0 md:rounded-[28px] bg-ink text-white px-5 pt-5 pb-7 min-h-[calc(100vh-10rem)] md:min-h-0 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-ink-muted">Step 3 of 3</span>
                    <span className="font-display text-base font-extrabold tabular">Rs {formatAmount(amount)} → G-Bux</span>
                </div>

                <div
                    role="timer"
                    aria-label={status === 'processing' ? `${formatClock(timeLeft)} left to approve` : 'Sending request'}
                    className="relative self-center size-[220px] mt-2"
                >
                    <svg width="220" height="220" viewBox="0 0 220 220" aria-hidden="true">
                        <circle cx="110" cy="110" r={RING_R} fill="none" stroke="#2E2870" strokeWidth="12" />
                        <circle
                            cx="110"
                            cy="110"
                            r={RING_R}
                            fill="none"
                            stroke={urgent ? '#FF8A5B' : '#FFB648'}
                            strokeWidth="12"
                            strokeLinecap="round"
                            strokeDasharray={RING_C}
                            strokeDashoffset={RING_C * (1 - progress)}
                            transform="rotate(-90 110 110)"
                            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                        <span className="size-[52px] rounded-2xl bg-[#C8102E] flex items-center justify-center mb-1.5">
                            <Smartphone className={cn('size-6', status === 'initiating' && 'animate-pulse')} aria-hidden="true" />
                        </span>
                        {urgent ? (
                            <>
                                <span className="font-mono text-[34px] font-semibold text-[#FFB648] tabular">{formatClock(timeLeft)}</span>
                                <span className="text-xs font-bold text-[#FFB648]">Hurry up!</span>
                            </>
                        ) : status === 'processing' ? (
                            <>
                                <Clock className="size-7 text-[#FFB648] animate-pulse" aria-hidden="true" />
                                <span className="text-xs text-ink-muted">Waiting for approval…</span>
                            </>
                        ) : (
                            <span className="text-xs text-ink-muted">Sending request…</span>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-2 text-center" aria-live="polite">
                    <h1 className="font-display text-[28px] font-extrabold tracking-tight">
                        {status === 'initiating' ? 'Sending payment request…' : 'Approve it in JazzCash'}
                    </h1>
                    <p className="text-[15px] leading-relaxed text-[#D9D6F2]">
                        {status === 'initiating'
                            ? "We're sending a payment request to your JazzCash app. Please keep your phone ready."
                            : statusMessage}
                    </p>
                    <p className="text-sm text-ink-muted">
                        Account <span className="font-mono text-white">{phoneNumber}</span>
                    </p>
                </div>

                <ol className="bg-ink-2 rounded-[20px] px-4 py-1.5 flex flex-col">
                    {steps.map((s, i) => (
                        <li key={s.label} className="flex items-center gap-3 py-3">
                            <span
                                className={cn(
                                    'size-7 rounded-full flex items-center justify-center text-[13px] font-extrabold shrink-0',
                                    s.state === 'done' && 'bg-volt text-ink',
                                    s.state === 'now' && 'bg-[#FFB648] text-ink',
                                    s.state === 'next' && 'bg-ink-3 text-ink-muted'
                                )}
                            >
                                {s.state === 'done' ? <Check className="size-4" strokeWidth={3} aria-hidden="true" /> : i + 1}
                            </span>
                            <span className={cn('text-sm', s.state === 'now' ? 'text-white font-extrabold' : s.state === 'done' ? 'text-[#D9D6F2] font-semibold' : 'text-ink-muted font-semibold')}>
                                {s.label}
                            </span>
                        </li>
                    ))}
                </ol>

                <p className="mt-auto flex items-center justify-center gap-2 text-xs font-bold text-ink-muted">
                    <span className="size-2 rounded-full bg-volt animate-pulse" aria-hidden="true" />
                    Live transaction — keep this screen open
                </p>
            </div>
        );
    }

    // ---------------- Idle: account details ----------------
    return (
        <div className="flex flex-col gap-5">
            <TopUpStepHeader title="JazzCash account" step={3} onBack={onBack} />

            <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-3.5">
                <span className="text-sm text-[#4A4766]">Payable amount</span>
                <span className="font-display text-[22px] font-extrabold text-ink tabular">Rs {formatAmount(amount)}</span>
            </div>

            <label className="flex flex-col gap-1.5 text-[13px] font-extrabold text-ink">
                Mobile number
                <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={phoneNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="03XX-XXXXXXX"
                    maxLength={11}
                    aria-invalid={phoneNumber.length === 11 && !mobileValid ? true : undefined}
                    className="h-14 rounded-2xl border-[1.5px] border-input bg-card px-4 font-mono text-lg font-semibold tracking-[0.04em] text-ink outline-none focus:border-iris focus:border-2"
                />
                <span className="text-xs font-semibold text-muted-foreground">The JazzCash account that will approve the payment.</span>
            </label>

            <label className="flex flex-col gap-1.5 text-[13px] font-extrabold text-ink">
                Last 6 digits of CNIC
                <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={cnicLast6}
                    onChange={(e) => setCnicLastSix(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="XXXXXX"
                    maxLength={6}
                    className="h-14 rounded-2xl border-[1.5px] border-input bg-card px-4 font-mono text-xl font-semibold tracking-[0.5em] text-ink outline-none focus:border-iris focus:border-2"
                />
                <span className="text-xs font-semibold text-muted-foreground">Of the JazzCash account holder — JazzCash checks it.</span>
            </label>

            <button
                type="button"
                onClick={send}
                disabled={!amount || !mobileValid || !cnicValid}
                className="h-14 rounded-[18px] bg-primary text-primary-foreground text-base font-extrabold disabled:bg-secondary disabled:text-[#6E6B88] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
            >
                {!mobileValid
                    ? 'Enter your 11-digit mobile number'
                    : !cnicValid
                      ? `Enter ${6 - cnicLast6.length} more CNIC digit${6 - cnicLast6.length === 1 ? '' : 's'}`
                      : 'Pay with JazzCash'}
            </button>

            <p className="flex items-center justify-center gap-1.5 text-xs text-[#4A4766]">
                <Lock className="size-3.5 text-mint" aria-hidden="true" />
                You'll approve the payment with your MPIN in the JazzCash app.
            </p>
        </div>
    );
};

export default JazzCashPayment;
