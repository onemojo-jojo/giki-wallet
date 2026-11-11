import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/shared/components/ui/Modal';
import { Transaction, toTransaction } from '../utils/transactionHelpers';
import { useWalletModuleStore } from '../store';
import { TransactionList } from './TransactionList';
import { TransactionReceipt } from './TransactionReceipt';

interface TransactionHistoryProps {
    isOpen: boolean;
    onClose: () => void;
}

/** Full transaction history as a sheet (opened from Home's History button). */
export const TransactionHistory = ({ isOpen, onClose }: TransactionHistoryProps) => {
    const { transactions, fetchHistory, isHistoryLoading, historyError } = useWalletModuleStore();
    const [selected, setSelected] = useState<Transaction | null>(null);

    useEffect(() => {
        if (isOpen) {
            void fetchHistory();
        } else {
            setSelected(null);
        }
    }, [isOpen, fetchHistory]);

    const mapped = useMemo(() => transactions.map(toTransaction), [transactions]);

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Transaction History" size="lg">
                {isHistoryLoading && transactions.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground">Loading transactions…</div>
                ) : historyError && transactions.length === 0 ? (
                    <div role="alert" className="py-10 flex flex-col items-center gap-3 text-center">
                        <span className="text-[15px] font-bold text-ink">Couldn't load your transactions.</span>
                        <button
                            type="button"
                            onClick={() => void fetchHistory()}
                            className="h-10 px-4 rounded-xl bg-secondary text-ink text-sm font-extrabold focus-visible:outline-2 focus-visible:outline-iris"
                        >
                            Retry
                        </button>
                    </div>
                ) : mapped.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground">No transactions yet.</div>
                ) : (
                    <TransactionList transactions={mapped} onSelect={setSelected} variant="plain" />
                )}
            </Modal>
            <TransactionReceipt transaction={selected} onClose={() => setSelected(null)} />
        </>
    );
};
