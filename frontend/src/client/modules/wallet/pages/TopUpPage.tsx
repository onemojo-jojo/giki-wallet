
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/Input';
import { PaymentMethodSelector } from '../components/PaymentMethodSelector';
import { toast } from '@/lib/toast';
import { topUp } from '../api';
import { getErrorMessage } from '@/lib/errors';
import { TopUpRequest } from '../types';
import JazzCashPayment from '../components/JazzCashPayment';
import { useWalletModuleStore } from '../store';
import axios from '@/lib/axios';
import { type APIResponse } from '@/lib/errors';

type PaymentMethod = 'jazzcash' | 'card';

const TopUpPage = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [maxLimit, setMaxLimit] = useState<number>(800); // Default fallback
    const [isJazzCashReady, setIsJazzCashReady] = useState(false);

    useEffect(() => {
        const { status, resetPaymentState } = useWalletModuleStore.getState();
        if (status === 'success' || status === 'failed') {
            resetPaymentState();
        }
        setIsJazzCashReady(true);
    }, []);

    useEffect(() => {
        const fetchLimit = async () => {
            try {
                const { data } = await axios.get<{ max_limit_paisa: number }>('/payment/limit');
                setMaxLimit(data.max_limit_paisa / 100);
            } catch (err) {
                console.error("Failed to fetch top-up limit", err);
            }
        };
        fetchLimit();
    }, []);

    const {
        balance,
        fetchBalance,
        formData,
        setAmount,
        setMobileNumber,
        setCnicLastSix,
        setMethod,
        resetFormData
    } = useWalletModuleStore();

    useEffect(() => {
        fetchBalance();
    }, [fetchBalance]);

    // Fresh form on entry unless resuming an in-flight JazzCash payment (amount/mobile/CNIC + idempotency key).
    useEffect(() => {
        const { status } = useWalletModuleStore.getState();
        if (status !== 'processing') {
            resetFormData();
        }
    }, [resetFormData]);

    // Scroll to top on page load (fixes mobile auto-scroll issue)
    useEffect(() => {
        // Clear any URL hash that might cause scroll
        if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname);
        }
        
        // Scroll to top after a brief delay to ensure DOM is ready
        const timer = setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }, 0);
        
        return () => clearTimeout(timer);
    }, []);

    const handleCardPayment = async () => {
        if (!formData.amount) {
            toast.error('Please enter an amount');
            return;
        }

        const amount = parseFloat(formData.amount);
        if (balance + amount > maxLimit) {
            toast.error(`Top-up would exceed maximum allowed wallet balance of RS ${maxLimit}`);
            return;
        }

        setIsLoading(true);
        try {
            const request: TopUpRequest = {
                idempotency_key: formData.idempotency_key,
                amount: parseFloat(formData.amount),
                method: 'CARD'
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
            const errorMessage = getErrorMessage(error);
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto pt-4 pb-20 md:pb-6">
            <div className="flex items-center gap-3 mb-4">
                <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => navigate(-1)}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-xl font-bold text-gray-900">Top Up</h1>
            </div>

            <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200">
                {/* Payment Method Selection */}
                <PaymentMethodSelector
                    paymentMethod={formData.method === 'MWALLET' ? 'jazzcash' : 'card'}
                    onPaymentMethodChange={(method) => setMethod(method === 'jazzcash' ? 'MWALLET' : 'CARD')}
                />

                {/* Simplified Form */}
                <div className="space-y-3 mb-4">
                    <Input
                        label="Amount (RS)"
                        type="number"
                        min="1"
                        step="1"
                        value={formData.amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter amount"
                        className="bg-white border-gray-300"
                    />
                    <p className="text-xs text-gray-500">
                        Max balance: RS {maxLimit}
                    </p>

                    {formData.method === 'MWALLET' && (
                        <>
                            <Input
                                label="Mobile Number"
                                type="tel"
                                value={formData.mobile_number}
                                onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                                placeholder="03XX-XXXXXXX"
                                maxLength={11}
                                className="bg-white border-gray-300"
                            />

                            <Input
                                label="Last 6 Digits of CNIC"
                                type="text"
                                value={formData.cnic_last_six}
                                onChange={(e) => setCnicLastSix(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="XXXXXX"
                                maxLength={6}
                                className="bg-white border-gray-300"
                            />
                        </>
                    )}
                </div>

                {/* Payment Content */}
                {formData.method === 'MWALLET' ? (
                    isJazzCashReady ? (
                        <JazzCashPayment
                            amount={parseFloat(formData.amount) || 0}
                            phoneNumber={formData.mobile_number}
                            cnicLast6={formData.cnic_last_six}
                            maxLimit={maxLimit}
                            currentBalance={balance}
                        />
                    ) : null
                ) : (
                    <Button
                        onClick={handleCardPayment}
                        disabled={isLoading || !formData.amount}
                        className="w-full font-semibold py-4 rounded-xl"
                    >
                        {isLoading ? 'Processing...' : 'Proceed to Payment'}
                    </Button>
                )}
            </div>
        </div>
    );
};
export default TopUpPage
