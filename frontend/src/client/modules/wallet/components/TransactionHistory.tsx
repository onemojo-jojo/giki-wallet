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
    const { transactions, fetchHistory, isDataLoading } = useWalletModuleStore();
    const [selected, setSelected] = useState<Transaction | null>(null);

    useEffect(() => {
        if (isOpen) {
            void fetchHistory();
        }
    }, [isOpen, fetchHistory]);

    const mapped = useMemo(() => transactions.map(toTransaction), [transactions]);

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Transaction History" size="lg">
                {isDataLoading && transactions.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground">Loading transactions…</div>
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
