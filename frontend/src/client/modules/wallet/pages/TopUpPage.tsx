import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Lock, Smartphone } from 'lucide-react';
import { toast } from '@/lib/toast';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { Keypad } from '@/shared/components/ui/Keypad';
import { useIsPhone } from '@/shared/hooks/useIsPhone';
import { useWalletModuleStore } from '../store';
import { topUp } from '../api';
import { TopUpRequest } from '../types';
import { useTopUpLimit } from '../hooks/useTopUpLimit';
import { formatAmount } from '../utils/transactionHelpers';
import JazzCashPayment from '../components/JazzCashPayment';
import { TopUpStepHeader } from '../components/TopUpStepHeader';

type Step = 'amount' | 'method' | 'jazzcash';

/** Used only if /payment/limit can't be loaded (same fallback as before; the server enforces the real cap). */
const FALLBACK_MAX_LIMIT = 800;
const MAX_AMOUNT_DIGITS = 6;

const TopUpPage = () => {
    const navigate = useNavigate();
    const isPhone = useIsPhone();
    const [step, setStep] = useState<Step>('amount');
    const [isLoading, setIsLoading] = useState(false);
    const loadedLimit = useTopUpLimit();
    const maxLimit = loadedLimit ?? FALLBACK_MAX_LIMIT;

    const { balance, fetchBalance, formData, setAmount, setMethod, resetFormData, resetPaymentState } = useWalletModuleStore();

    useEffect(() => {
        void fetchBalance();
    }, [fetchBalance]);

    // Fresh form and payment state on entry. A JazzCash request left "processing" by a
    // previous visit can't be resumed here: its countdown and polling stopped when that
    // screen unmounted. If the user approved it, the backend's reconciliation credits it.
    useEffect(() => {
        resetFormData();
        const current = useWalletModuleStore.getState().status;
        if (current === 'initiating' || current === 'processing') {
            toast.info('Your previous JazzCash request was interrupted. If you approved it, it will show in your wallet shortly.');
        }
        if (current !== 'idle') resetPaymentState();
    }, [resetFormData, resetPaymentState]);

    // Scroll to top on page load (fixes mobile auto-scroll issue)
    useEffect(() => {
        if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname);
        }
        const timer = setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    const amount = Number.parseInt(formData.amount || '0', 10) || 0;
    // Whole rupees only: the balance can carry paisa, and amounts here are integers.
    const room = Math.max(0, Math.floor(maxLimit - balance));
    const exceeds = amount > 0 && balance + amount > maxLimit;
    const amountValid = amount >= 1 && !exceeds;

    const quickAmounts = useMemo(() => {
        const base = [100, 200, 500].filter((v) => v < room);
        return room > 0 ? [...base, room] : base;
    }, [room]);

    const typeDigit = (key: string) => {
        const next = (formData.amount === '0' ? '' : formData.amount) + key;
        const trimmed = next.replace(/^0+/, '');
        if (trimmed.length > MAX_AMOUNT_DIGITS) return;
        setAmount(trimmed);
    };
    const deleteDigit = () => setAmount(formData.amount.slice(0, -1));

    const handleCardPayment = async () => {
        if (!formData.amount) {
            toast.error('Please enter an amount');
            return;
        }
        if (balance + amount > maxLimit) {
            toast.error(`Top-up would exceed maximum allowed wallet balance of RS ${maxLimit}`);
            return;
        }

        setIsLoading(true);
        try {
            const request: TopUpRequest = {
                idempotency_key: formData.idempotency_key,
                amount: parseFloat(formData.amount),
                method: 'CARD',
            };
            const result = await topUp(request);
            if (result.redirect) {
                toast.info('Redirecting to payment gateway...');
                window.location.href = result.redirect;
            } else {
                toast.error('Failed to get payment page. Please try again.');
            }
        } catch (error) {
            console.error('Payment error:', error);
            toast.error(getErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    // ---- Step 3+: JazzCash details, approval and result ----
    if (step === 'jazzcash') {
        return (
            <div className="max-w-xl mx-auto w-full pt-1">
                <JazzCashPayment
                    amount={amount}
                    maxLimit={maxLimit}
                    currentBalance={balance}
                    onBack={() => setStep('method')}
                    onUseCard={() => {
                        setMethod('CARD');
                        setStep('method');
                    }}
                />
            </div>
        );
    }

    // ---- Step 2: payment method ----
    if (step === 'method') {
        const isJazz = formData.method === 'MWALLET';
        return (
            <div className="max-w-xl mx-auto w-full flex flex-col gap-5 pt-1">
                <TopUpStepHeader title="Pay with" step={2} onBack={() => setStep('amount')} />

                <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-3.5">
                    <span className="text-sm text-[#4A4766]">Adding to G-Bux</span>
                    <span className="font-display text-[22px] font-extrabold text-ink tabular">Rs {formatAmount(amount)}</span>
                </div>

                <fieldset className="flex flex-col gap-3">
                    <legend className="sr-only">Payment method</legend>
                    <label
                        className={cn(
                            'flex items-center gap-3.5 rounded-[20px] p-4 cursor-pointer bg-card',
                            isJazz ? 'border-2 border-iris bg-[#F6F4FF]' : 'border-[1.5px] border-input'
                        )}
                    >
                        <span className="size-12 rounded-2xl bg-[#C8102E] text-white flex items-center justify-center shrink-0">
                            <Smartphone className="size-[22px]" aria-hidden="true" />
                        </span>
                        <span className="flex-1 flex flex-col gap-0.5">
                            <span className="text-base font-extrabold text-ink">JazzCash</span>
                            <span className="text-[13px] text-[#4A4766]">Mobile wallet · approve in the JazzCash app</span>
                        </span>
                        <input
                            type="radio"
                            name="method"
                            checked={isJazz}
                            onChange={() => setMethod('MWALLET')}
                            className="size-[22px] accent-iris shrink-0"
                        />
                    </label>
                    <label
                        className={cn(
                            'flex items-center gap-3.5 rounded-[20px] p-4 cursor-pointer bg-card',
                            !isJazz ? 'border-2 border-iris bg-[#F6F4FF]' : 'border-[1.5px] border-input'
                        )}
                    >
                        <span className="size-12 rounded-2xl bg-secondary text-ink flex items-center justify-center shrink-0">
                            <CreditCard className="size-[22px]" aria-hidden="true" />
                        </span>
                        <span className="flex-1 flex flex-col gap-0.5">
                            <span className="text-base font-extrabold text-ink">Debit or credit card</span>
                            <span className="text-[13px] text-[#4A4766]">Opens the secure JazzCash checkout page</span>
                        </span>
                        <input
                            type="radio"
                            name="method"
                            checked={!isJazz}
                            onChange={() => setMethod('CARD')}
                            className="size-[22px] accent-iris shrink-0"
                        />
                    </label>
                </fieldset>

                <p className="flex items-center justify-center gap-1.5 text-xs text-[#4A4766]">
                    <Lock className="size-3.5 text-mint" aria-hidden="true" />
                    GIKI Wallet never sees your PIN or card number.
                </p>

                <button
                    type="button"
                    onClick={() => (isJazz ? setStep('jazzcash') : void handleCardPayment())}
                    disabled={isLoading || !amountValid}
                    className="h-14 rounded-[18px] bg-primary text-primary-foreground text-base font-extrabold disabled:bg-secondary disabled:text-[#6E6B88] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                >
                    {isJazz ? 'Continue' : isLoading ? 'Processing...' : 'Proceed to Payment'}
                </button>
            </div>
        );
    }

    // ---- Step 1: amount ----
    return (
        <div className="max-w-xl mx-auto w-full flex flex-col gap-5 pt-1">
            <TopUpStepHeader title="Add money" step={1} onClose={() => navigate(-1)} />

            <div className="flex flex-col items-center gap-2 pt-4">
                <label htmlFor="topup-amount" className="text-[13px] font-semibold text-muted-foreground">
                    Amount (Rs)
                </label>
                <div className="flex items-baseline justify-center gap-2 w-full">
                    <span className="font-display text-3xl font-bold text-muted-foreground" aria-hidden="true">
                        Rs
                    </span>
                    <input
                        id="topup-amount"
                        type="text"
                        inputMode={isPhone ? 'none' : 'numeric'}
                        autoComplete="off"
                        value={formData.amount}
                        onChange={(e) =>
                            // Keep whole rupees: drop anything after a decimal point instead of merging it in (500.50 → 500, not 50050).
                            setAmount(e.target.value.split('.')[0].replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_AMOUNT_DIGITS))
                        }
                        placeholder="0"
                        aria-describedby="topup-amount-help"
                        aria-invalid={exceeds || undefined}
                        className="w-[5.5ch] min-w-0 bg-transparent border-0 outline-none text-center font-display text-[64px] font-extrabold tracking-tight text-ink leading-none tabular placeholder:text-[#C9C7D6] focus-visible:outline-none"
                    />
                </div>
                <p id="topup-amount-help" className={cn('text-sm text-center', exceeds ? 'text-coral font-bold' : 'text-[#4A4766]')}>
                    {exceeds
                        ? `That's over your Rs ${formatAmount(maxLimit)} cap. You can add up to Rs ${formatAmount(room)}.`
                        : `Max balance: Rs ${formatAmount(maxLimit)} · you can add Rs ${formatAmount(room)}`}
                </p>
            </div>

            {quickAmounts.length > 0 && (
                <div role="group" aria-label="Quick amounts" className="grid grid-cols-4 gap-2">
                    {quickAmounts.map((v, i) => {
                        const isMax = i === quickAmounts.length - 1 && v === room;
                        const selected = amount === v;
                        return (
                            <button
                                key={`${v}-${i}`}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => setAmount(String(v))}
                                className={cn(
                                    'h-11 rounded-[14px] text-sm focus-visible:outline-2 focus-visible:outline-iris',
                                    selected ? 'border-2 border-iris bg-[#F6F4FF] text-[#2E1A99] font-extrabold' : 'border-[1.5px] border-input bg-card text-ink font-bold'
                                )}
                            >
                                {isMax ? 'Max' : formatAmount(v)}
                            </button>
                        );
                    })}
                </div>
            )}

            <button
                type="button"
                onClick={() => setStep('method')}
                disabled={!amountValid}
                className="h-14 rounded-[18px] bg-primary text-primary-foreground text-base font-extrabold disabled:bg-secondary disabled:text-[#6E6B88] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
            >
                Continue
            </button>

            {isPhone && <Keypad onKey={typeDigit} onDelete={deleteDigit} className="-mx-1" />}
        </div>
    );
};

export default TopUpPage;
