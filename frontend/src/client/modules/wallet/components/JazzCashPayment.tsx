import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock, Info, Lock, Phone, TriangleAlert } from 'lucide-react';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { Keypad } from '@/shared/components/ui/Keypad';
import { useIsPhone } from '@/shared/hooks/useIsPhone';
import { JAZZCASH_PAYMENT_TIMEOUT_SECONDS, JAZZCASH_TIMEOUT_MESSAGE, useJazzCashPayment } from '../hooks/useJazzCashPayment';
import { useWalletModuleStore } from '../store';
import { formatAmount } from '../utils/transactionHelpers';
import { CNIC_RE, MOBILE_RE, maskMobile, normalizeMobile, saveJazzCash } from '../utils/savedJazzCash';
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
    /** Saved number chosen on the method step: send the request straight away. */
    autoStart?: boolean;
}


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
const JazzCashPayment: React.FC<JazzCashPaymentProps> = ({ amount, onSuccess, onFailure, maxLimit, currentBalance, onBack, onUseCard, autoStart }) => {
    const isPhone = useIsPhone();
    const { formData, setMobileNumber, setCnicLastSix, renewIdempotencyKey, balance, txnRefNo } = useWalletModuleStore();
    const phoneNumber = formData.mobile_number;
    const cnicLast6 = formData.cnic_last_six;
    const [focus, setFocus] = useState<'mobile' | 'cnic'>('mobile');
    const [remember, setRemember] = useState(true);
    const [finishedAt, setFinishedAt] = useState<Date | null>(null);
    const cnicInputRef = useRef<HTMLInputElement>(null);

    const { status, timeLeft, errorMessage, initiatePayment, reset, statusMessage, showTimer } = useJazzCashPayment(amount, phoneNumber, cnicLast6);

    // Sync with parent callbacks
    React.useEffect(() => {
        if (status === 'success') {
            setFinishedAt(new Date());
            // Only details that actually worked are remembered, and only if the box is ticked.
            if (remember && MOBILE_RE.test(phoneNumber) && CNIC_RE.test(cnicLast6)) saveJazzCash({ mobile: phoneNumber, cnicLast6 });
            toast.success(`G-Bux ${amount.toLocaleString()} added to wallet!`);
            if (onSuccess) onSuccess();
        }
        if (status === 'failed' && onFailure) onFailure(errorMessage || 'Unknown error');
        // eslint-disable-next-line react-hooks/exhaustive-deps -- run on status change only; fields are fixed while paying
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

    // Saved number: details are already filled — send right away (the hook guards against double starts).
    const autoStarted = useRef(false);
    // Deferred to a timer that the cleanup cancels: if this component is mounted twice
    // (React StrictMode in dev), the first mount's start is cancelled before it runs, so
    // a request is never started and then aborted by an unmount.
    useEffect(() => {
        if (!autoStart || autoStarted.current || status !== 'idle' || !mobileValid || !cnicValid) return;
        const t = window.setTimeout(() => {
            autoStarted.current = true;
            send();
        }, 0);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoStart, status, mobileValid, cnicValid]);

    // On-screen keypad types into the focused field.
    const typeKey = (k: string) => {
        if (focus === 'mobile') {
            const next = (phoneNumber + k).replace(/\D/g, '').slice(0, 11);
            setMobileNumber(next);
            // Move to the CNIC boxes once the number is complete.
            if (MOBILE_RE.test(next)) {
                setFocus('cnic');
                // Move real focus too, so tapping the number field again fires onFocus.
                cnicInputRef.current?.focus();
            }
        }
        else setCnicLastSix((cnicLast6 + k).replace(/\D/g, '').slice(0, 6));
    };
    const deleteKey = () => {
        if (focus === 'mobile') setMobileNumber(phoneNumber.slice(0, -1));
        else setCnicLastSix(cnicLast6.slice(0, -1));
    };

    // ---------------- Success (v2-TopUpSuccess) ----------------
    if (status === 'success') {
        const when = finishedAt ?? new Date();
        return (
            <div className="flex flex-col gap-5 pt-6 animate-in fade-in zoom-in duration-300">
                <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true" className="self-center mt-4">
                    <circle cx="66" cy="66" r="62" fill="#C8F04A" />
                    <circle cx="66" cy="66" r="44" fill="#16133A" />
                    <path d="m48 67 12 12 24-26" fill="none" stroke="#C8F04A" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="18" cy="20" r="5" fill="#5B3DF5" />
                    <circle cx="120" cy="30" r="4" fill="#FFB648" />
                    <circle cx="112" cy="116" r="5" fill="#5B3DF5" />
                </svg>
                <div className="flex flex-col items-center gap-1.5 text-center" role="status">
                    <span className="text-[15px] font-bold text-[#4A4766]">Added to G-Bux</span>
                    <span className="font-display text-[56px] font-extrabold tracking-tight leading-none text-ink tabular">Rs {formatAmount(amount)}</span>
                    <span className="text-[15px] text-[#4A4766]">
                        New balance <strong className="text-ink">Rs {formatAmount(balance)}</strong>
                    </span>
                </div>
                <dl className="bg-background rounded-[20px] px-4 py-1">
                    <div className="flex justify-between gap-3 py-3">
                        <dt className="text-[13px] text-muted-foreground">From</dt>
                        <dd className="text-sm font-bold text-ink">JazzCash · {maskMobile(phoneNumber)}</dd>
                    </div>
                    {txnRefNo && (
                        <div className="flex justify-between gap-3 py-3 border-t border-line">
                            <dt className="text-[13px] text-muted-foreground">Reference</dt>
                            <dd className="font-mono text-[13px] font-semibold text-ink break-all text-right">{txnRefNo}</dd>
                        </div>
                    )}
                    <div className="flex justify-between gap-3 py-3 border-t border-line">
                        <dt className="text-[13px] text-muted-foreground">When</dt>
                        <dd className="text-sm font-bold text-ink">
                            Today, {when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Karachi' })}
                        </dd>
                    </div>
                </dl>
                <div className="flex flex-col gap-2.5 mt-2">
                    <button
                        type="button"
                        onClick={() => (window.location.href = '/')}
                        className="h-14 rounded-[18px] bg-ink text-white text-base font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                    >
                        Done
                    </button>
                    <Link to="/wallet" className="h-11 rounded-xl flex items-center justify-center text-iris-strong text-sm font-extrabold focus-visible:outline-2 focus-visible:outline-iris">
                        View receipt
                    </Link>
                </div>
            </div>
        );
    }

    // ---------------- Failed / timed out (v2-TopUpFailed) ----------------
    if (status === 'failed') {
        const timedOut = errorMessage === JAZZCASH_TIMEOUT_MESSAGE;
        return (
            <div className="flex flex-col gap-5 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <span className="self-center size-[120px] rounded-[40px] bg-signal-tint flex items-center justify-center">
                    {timedOut ? <Clock className="size-[60px] text-[#B35F00]" strokeWidth={1.8} aria-hidden="true" /> : <TriangleAlert className="size-14 text-[#B35F00]" aria-hidden="true" />}
                </span>
                <div className="flex flex-col gap-2 text-center items-center" role="alert">
                    <h1 className="font-display text-[30px] font-extrabold tracking-tight text-ink">{timedOut ? 'Request timed out' : "Payment didn't go through"}</h1>
                    <p className="text-[15px] leading-relaxed text-[#4A4766] max-w-[300px]">
                        {timedOut ? (
                            <>
                                JazzCash didn't get an approval in time. <strong className="text-ink">If you didn't approve it, no money left your account.</strong>
                            </>
                        ) : (
                            readableError(errorMessage)
                        )}
                    </p>
                </div>
                <section aria-labelledby="fixes" className="bg-background rounded-[20px] p-4 flex flex-col gap-2.5">
                    <h2 id="fixes" className="text-[13px] font-extrabold tracking-[0.06em] uppercase text-muted-foreground">Common fixes</h2>
                    <ul className="list-disc pl-[18px] flex flex-col gap-2 text-sm text-[#4A4766]">
                        <li>Keep the JazzCash app open and logged in.</li>
                        <li>Check your JazzCash balance covers Rs {formatAmount(amount)}.</li>
                        <li>Make sure the CNIC digits match the account holder.</li>
                    </ul>
                </section>
                <p role="note" className="flex items-start gap-2.5 text-xs text-muted-foreground">
                    <Info className="size-4 shrink-0 mt-px" aria-hidden="true" />
                    <span>
                        If you approved late, it can still reach your wallet — we keep checking with JazzCash and add it automatically.
                        {txnRefNo && (
                            <>
                                {' '}
                                Ref <span className="font-mono">{txnRefNo}</span>
                            </>
                        )}
                    </span>
                </p>
                <div className="flex flex-col gap-2.5">
                    <button
                        type="button"
                        onClick={() => {
                            // A new attempt needs a new idempotency key; the old one maps to the failed payment.
                            renewIdempotencyKey();
                            reset();
                        }}
                        className="h-14 rounded-[18px] bg-primary text-primary-foreground text-base font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                    >
                        Try again
                    </button>
                    {onUseCard && (
                        <button
                            type="button"
                            onClick={() => {
                                reset();
                                onUseCard();
                            }}
                            className="h-[50px] rounded-2xl border-[1.5px] border-input bg-card text-ink text-[15px] font-extrabold focus-visible:outline-2 focus-visible:outline-iris"
                        >
                            Use a card instead
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // ---------------- Waiting for approval (v2-JazzApprove) ----------------
    if (status === 'initiating' || status === 'processing') {
        const progress = Math.max(0, Math.min(1, timeLeft / JAZZCASH_PAYMENT_TIMEOUT_SECONDS));
        const urgent = status === 'processing' && showTimer;
        const steps = [
            { label: 'Request sent to JazzCash', state: status === 'processing' ? 'done' : 'now' },
            { label: 'Enter your MPIN in the JazzCash prompt', state: status === 'processing' ? 'now' : 'next' },
            { label: 'G-Bux updates here automatically', state: 'next' },
        ] as const;

        return (
            <div className="-mx-4 -mt-4 md:mx-0 md:mt-0 md:rounded-[28px] bg-ink text-white px-5 pt-4 pb-10 min-h-[calc(100vh-5rem)] md:min-h-0 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-ink-muted">Step 3 of 3</span>
                    <span className="font-display text-base font-extrabold tabular">Rs {formatAmount(amount)} → G-Bux</span>
                </div>

                <div role="timer" aria-label={status === 'processing' ? `${formatClock(timeLeft)} left to approve` : 'Sending request'} className="relative self-center size-[220px] mt-[18px]">
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
                        <span className="size-[52px] rounded-2xl bg-[#C8102E] flex items-center justify-center font-display font-extrabold text-[17px] mb-1.5">JC</span>
                        {status === 'processing' ? (
                            <>
                                <span className={cn('font-mono text-[34px] font-semibold tabular', urgent ? 'text-[#FF8A5B]' : 'text-[#FFB648]')}>{formatClock(timeLeft)}</span>
                                <span className="text-xs text-ink-muted">{urgent ? 'Hurry up!' : 'left to approve'}</span>
                            </>
                        ) : (
                            <span className="text-xs text-ink-muted">Sending request…</span>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-2 text-center" aria-live="polite">
                    <h1 className="font-display text-[28px] font-extrabold tracking-tight">{status === 'initiating' ? 'Sending payment request…' : 'Approve it in JazzCash'}</h1>
                    <p className="text-[15px] leading-relaxed text-[#D9D6F2]">
                        {status === 'initiating' ? (
                            "We're sending a payment request to your JazzCash app. Please keep your phone ready."
                        ) : (
                            <>
                                We sent a payment request to <span className="font-mono text-white">{maskMobile(phoneNumber)}</span>.{urgent ? ` ${statusMessage}` : ''}
                            </>
                        )}
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

                <p className="mt-auto text-center text-[13px] text-ink-muted flex items-center justify-center gap-1.5 flex-wrap">
                    <Phone className="size-3.5" aria-hidden="true" />
                    Didn't get it? Dial{' '}
                    <a href="tel:*786%23" className="font-mono text-white underline underline-offset-2">
                        *786#
                    </a>{' '}
                    and check pending payments.
                </p>
            </div>
        );
    }

    // ---------------- Idle: account details (v2-JazzDetails) ----------------
    const missing = !mobileValid ? null : 6 - cnicLast6.length;
    return (
        <div className="flex flex-col gap-5">
            <TopUpStepHeader title="JazzCash account" step={2} onBack={onBack} />

            <label className="flex flex-col gap-2 text-[13px] font-extrabold text-ink">
                Mobile number
                <span
                    className={cn(
                        'flex items-center gap-2.5 h-[58px] rounded-2xl bg-card px-3.5',
                        focus === 'mobile' ? 'border-2 border-iris' : 'border-[1.5px] border-input'
                    )}
                >
                    <input
                        type="tel"
                        inputMode={isPhone ? 'none' : 'numeric'}
                        autoComplete="tel-national"
                        value={phoneNumber}
                        onFocus={() => setFocus('mobile')}
                        onClick={() => setFocus('mobile')}
                        onChange={(e) => setMobileNumber(normalizeMobile(e.target.value))}
                        placeholder="03XX XXXXXXX"
                        aria-invalid={!mobileValid && (phoneNumber.length === 11 || (phoneNumber.length === 10 && !phoneNumber.startsWith('0'))) ? true : undefined}
                        className="flex-1 min-w-0 bg-transparent outline-none font-mono text-lg font-semibold tracking-[0.04em] text-ink placeholder:text-light-gray"
                    />
                    {mobileValid && <Check className="size-5 text-mint" strokeWidth={2.6} aria-label="Valid number" />}
                </span>
            </label>

            <div className="flex flex-col gap-2">
                <span id="cnic-label" className="text-[13px] font-extrabold text-ink">
                    Last 6 digits of the account holder's CNIC
                </span>
                <div className="relative" onClick={() => { setFocus('cnic'); cnicInputRef.current?.focus(); }}>
                    <div aria-hidden="true" className="grid grid-cols-6 gap-2">
                        {Array.from({ length: 6 }).map((_, i) => {
                            const active = focus === 'cnic' && i === Math.min(cnicLast6.length, 5);
                            return (
                                <span
                                    key={i}
                                    className={cn(
                                        'h-[58px] rounded-[14px] flex items-center justify-center font-mono text-[22px] font-semibold text-ink bg-card',
                                        active ? 'border-2 border-iris bg-[#F6F4FF]' : cnicLast6[i] ? 'border-[1.5px] border-input' : 'border-[1.5px] border-line'
                                    )}
                                >
                                    {cnicLast6[i] ?? ''}
                                </span>
                            );
                        })}
                    </div>
                    {/* The real field sits over the boxes so typing and screen readers work. */}
                    <input
                        ref={cnicInputRef}
                        type="text"
                        inputMode={isPhone ? 'none' : 'numeric'}
                        autoComplete="off"
                        aria-labelledby="cnic-label"
                        value={cnicLast6}
                        onFocus={() => setFocus('cnic')}
                        onChange={(e) => setCnicLastSix(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-text"
                    />
                </div>
                <span className="text-xs text-muted-foreground">JazzCash checks this to make sure the request reaches the right person.</span>
            </div>

            <label className="flex items-center gap-2.5 text-sm font-semibold text-[#4A4766]">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-5 accent-iris" />
                Save this number for next time <span className="text-xs text-muted-foreground">(this device only)</span>
            </label>

            <button
                type="button"
                onClick={send}
                disabled={!amount || !mobileValid || !cnicValid}
                className="h-14 rounded-[18px] bg-primary text-primary-foreground text-base font-extrabold disabled:bg-secondary disabled:text-[#6E6B88] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
            >
                {!mobileValid ? 'Enter your JazzCash mobile number' : missing ? `Enter ${missing} more digit${missing === 1 ? '' : 's'}` : `Send request · Rs ${formatAmount(amount)}`}
            </button>

            <p className="flex items-center justify-center gap-1.5 text-xs text-[#4A4766] -mt-1">
                <Lock className="size-3.5 text-mint" aria-hidden="true" />
                You'll approve the payment with your MPIN in the JazzCash app.
            </p>

            {isPhone && <Keypad onKey={typeKey} onDelete={deleteKey} doubleZero={false} className="-mx-1 mb-10" />}
        </div>
    );
};

export default JazzCashPayment;
