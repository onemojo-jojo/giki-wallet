import { create } from 'zustand';
import { getBalance, getHistory, topUp, getTransactionStatus, type ApiTransaction } from '../api';
import { type TopUpRequest } from '../types';
import { z } from 'zod';
import { topUpFormSchema } from '../validators';

export type PaymentFlowStatus = 'idle' | 'initiating' | 'processing' | 'success' | 'failed';
export type TopUpFormData = z.infer<typeof topUpFormSchema>;

interface WalletState {
    // Data Slice
    balance: number;
    currency: string;
    transactions: ApiTransaction[];
    isDataLoading: boolean;
    dataError: string | null;
    /** History has its own flags so a fast balance call can't end its loading state early. */
    isHistoryLoading: boolean;
    historyError: string | null;

    // Actions
    fetchBalance: () => Promise<void>;
    fetchHistory: () => Promise<void>;
}

interface PaymentState {
    // Payment UI Slice
    status: PaymentFlowStatus;
    timeLeft: number;
    txnRefNo: string | null;
    errorMessage: string | null;

    // Actions
    setStatus: (status: PaymentFlowStatus) => void;
    setTimeLeft: (time: number | ((prev: number) => number)) => void;
    setTxnRefNo: (ref: string | null) => void;
    setErrorMessage: (msg: string | null) => void;
    resetPaymentState: () => void;
}

interface TopUpFormState {
    // Form Data Slice
    formData: TopUpFormData;

    // Actions
    setAmount: (amount: string) => void;
    setMobileNumber: (mobile: string) => void;
    setCnicLastSix: (cnic: string) => void;
    setMethod: (method: 'MWALLET' | 'CARD') => void;
    resetFormData: () => void;
}

type WalletModuleStore = WalletState & PaymentState & TopUpFormState;

const generateIdempotencyKey = () => {
    return typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export const useWalletModuleStore = create<WalletModuleStore>((set, get) => ({
    // Initial Data State
    balance: 0,
    currency: 'PKR',
    transactions: [],
    isDataLoading: false,
    dataError: null,
    isHistoryLoading: false,
    historyError: null,

    // Initial Payment State
    status: 'idle',
    timeLeft: 120,
    txnRefNo: null,
    errorMessage: null,

    // Initial Form Data State
    formData: {
        idempotency_key: generateIdempotencyKey(),
        amount: '',
        method: 'MWALLET',
        mobile_number: '',
        cnic_last_six: '',
    },

    // Data Actions
    fetchBalance: async () => {
        set({ isDataLoading: true, dataError: null });
        try {
            const data = await getBalance();
            set({ balance: data.balance, currency: data.currency, isDataLoading: false });
        } catch (error: any) {
            set({ dataError: error.message || 'Failed to fetch balance', isDataLoading: false });
        }
    },

    fetchHistory: async () => {
        set({ isHistoryLoading: true, historyError: null });
        try {
            const data = await getHistory();
            set({ transactions: data, isHistoryLoading: false });
        } catch (error: any) {
            set({ historyError: error.message || 'Failed to fetch history', isHistoryLoading: false });
        }
    },

    // Payment UI Actions
    setStatus: (status) => set({ status }),
    setTimeLeft: (time) => set((state) => ({
        timeLeft: typeof time === 'function' ? time(state.timeLeft) : time
    })),
    setTxnRefNo: (txnRefNo) => set({ txnRefNo }),
    setErrorMessage: (errorMessage) => set({ errorMessage }),
    resetPaymentState: () => set({
        status: 'idle',
        timeLeft: 120,
        txnRefNo: null,
        errorMessage: null
    }),

    // TopUp Form Actions
    setAmount: (amount) => set((state) => ({
        formData: {
            ...state.formData,
            amount,
            // Regenerate idempotency key when amount changes
            idempotency_key: generateIdempotencyKey(),
        }
    })),

    setMobileNumber: (mobile_number) => set((state) => ({
        formData: {
            ...state.formData,
            mobile_number,
            // Regenerate idempotency key when mobile number changes
            idempotency_key: generateIdempotencyKey(),
        }
    })),

    setCnicLastSix: (cnic_last_six) => set((state) => ({
        formData: {
            ...state.formData,
            cnic_last_six,
            // Regenerate idempotency key when CNIC changes
            idempotency_key: generateIdempotencyKey(),
        }
    })),

    setMethod: (method) => set((state) => ({
        formData: {
            ...state.formData,
            method,
            // Regenerate idempotency key when payment method changes
            idempotency_key: generateIdempotencyKey(),
        }
    })),

    resetFormData: () => set({
        formData: {
            idempotency_key: generateIdempotencyKey(),
            amount: '',
            method: 'MWALLET',
            mobile_number: '',
            cnic_last_six: '',
        }
    }),
}));
