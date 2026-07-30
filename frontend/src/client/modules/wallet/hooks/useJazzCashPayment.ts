import { useEffect, useCallback, useRef, useMemo } from 'react';
import { useWalletModuleStore, PaymentFlowStatus } from '../store';
import { topUp, getTransactionStatus } from '../api';
import { getErrorMessage } from '@/lib/errors';
import { TopUpRequest } from '../types';

export const JAZZCASH_PAYMENT_TIMEOUT_SECONDS = 180;
const JAZZCASH_URGENT_PHASE_SECONDS = 60;

export const useJazzCashPayment = (amount: number, phoneNumber: string, cnicLast6: string) => {

    const {
        formData,
        status,
        timeLeft,
        txnRefNo,
        errorMessage,
        setStatus,
        setTimeLeft,
        setTxnRefNo,
        setErrorMessage,
        fetchBalance,
        resetPaymentState: reset
    } = useWalletModuleStore();

    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const isActive = useRef(false);

    // --- Derived State for UI ---

    // 1. Determine if we are in the "Hurry Up" phase (last 60 seconds)
    const isUrgentPhase = timeLeft <= JAZZCASH_URGENT_PHASE_SECONDS;

    // 2. Logic to hide the timer during the buffer, show it only for the urgent phase
    const showTimer = status === 'processing' && isUrgentPhase;

    // 3. Dynamic Message based on the phase
    const statusMessage = useMemo(() => {
        if (status !== 'processing') return '';

        if (!isUrgentPhase) {
            return "Request is sent. Please approve the payment request by entering your MPIN in the JazzCash app.";
        } else {
            return "Please hurry up and approve the payment!";
        }
    }, [status, isUrgentPhase]);


    const clearAllTimers = useCallback(() => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
        timerIntervalRef.current = null;
        pollTimeoutRef.current = null;

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, []);

    const handleSuccess = useCallback(() => {
        clearAllTimers();
        setStatus('success');
        fetchBalance();
    }, [clearAllTimers, setStatus, fetchBalance]);

    const handleFailure = useCallback((msg: string) => {
        if (msg === 'canceled' || msg === 'Canceled') return;

        clearAllTimers();
        setStatus('failed');
        setErrorMessage(msg);
    }, [clearAllTimers, setStatus, setErrorMessage]);

    const pollOnce = useCallback(async (currentTxnRefNo: string) => {
        try {
            const result = await getTransactionStatus(currentTxnRefNo);
            if (result.status === 'SUCCESS') handleSuccess();
            else if (result.status === 'FAILED') handleFailure(result.message || "Transaction failed");
        } catch (err) {
            // Silently ignore poll errors, wait for next cycle
        }
    }, [handleSuccess, handleFailure]);

    const startPolling = useCallback(() => {
        if (pollTimeoutRef.current) return;

        const tick = async () => {
            pollTimeoutRef.current = null;

            const { status: currentStatus, txnRefNo: currentTxnRefNo } = useWalletModuleStore.getState();
            if (currentStatus !== 'processing' || !currentTxnRefNo) return;

            await pollOnce(currentTxnRefNo);

            const { status: nextStatus, txnRefNo: nextTxnRefNo } = useWalletModuleStore.getState();
            if (nextStatus === 'processing' && nextTxnRefNo) {
                pollTimeoutRef.current = setTimeout(tick, 1000);
            }
        };

        pollTimeoutRef.current = setTimeout(tick, 1000);
    }, [pollOnce]);

    const initiatePayment = async () => {
        if (isActive.current) return;

        abortControllerRef.current = new AbortController();
        isActive.current = true;

        reset();

        // IMMEDIATELY show the "Payment Request Sent" state
        setStatus('processing');

        setTimeLeft(JAZZCASH_PAYMENT_TIMEOUT_SECONDS);

        // Start countdown immediately
        timerIntervalRef.current = setInterval(() => {
            setTimeLeft((prev: number) => {
                if (prev <= 1) {
                    handleFailure("Payment timed out. Please try again.");
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        try {
            const request: TopUpRequest = {
                idempotency_key: formData.idempotency_key,
                amount: parseFloat(formData.amount),
                method: formData.method,
                phone_number: formData.mobile_number,
                cnic_last6: formData.cnic_last_six
            };

            // This awaits the initial API response (the "res" you mentioned)
            const result = await topUp(request, abortControllerRef.current.signal);

            if (result.status === 'SUCCESS') {
                handleSuccess();
            } else if (result.redirect) {
                const url = result.redirect.startsWith('/') ? window.location.origin + result.redirect : result.redirect;
                window.location.assign(url);
            } else if (result.status === 'PENDING') {
                setTxnRefNo(result.txn_ref_no || null);
                // Even if this returns quickly (e.g., in 2s), the timer is still at ~98s.
                // The UI will continue showing "Request sent" until the timer naturally hits 60s.
                startPolling();
            } else {
                handleFailure(result.message || "Initiation failed");
            }
        } catch (err: any) {
            if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') {
                return;
            }
            handleFailure(getErrorMessage(err));
        } finally {
            isActive.current = false;
        }
    };

    // Auto-Wake on visibility change
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && status === 'processing') {
                startPolling();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [status, startPolling]);

    useEffect(() => {
        return () => clearAllTimers();
    }, [clearAllTimers]);

    return {
        status,
        timeLeft,
        errorMessage,
        initiatePayment,
        reset,
        // New helper props for your UI
        statusMessage,
        showTimer
    };
};