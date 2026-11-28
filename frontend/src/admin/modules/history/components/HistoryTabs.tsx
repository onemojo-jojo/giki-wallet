import { Ticket, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

export type HistoryTab = 'tickets' | 'transactions';

interface HistoryTabsProps {
    activeTab: HistoryTab;
    onTabChange: (tab: HistoryTab) => void;
}

export const HistoryTabs = ({ activeTab, onTabChange }: HistoryTabsProps) => {
    const tabs: Array<{ id: HistoryTab; label: string; icon: React.ReactNode }> = [
        { id: 'tickets', label: 'Tickets', icon: <Ticket className="w-4 h-4" /> },
        { id: 'transactions', label: 'Transactions', icon: <Receipt className="w-4 h-4" /> },
    ];

    return (
        <div className="flex gap-1 sm:gap-2 border-b border-gray-200 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={cn(
                        "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 font-medium text-xs sm:text-sm transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0",
                        activeTab === tab.id
                            ? "text-primary border-primary"
                            : "text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300"
                    )}
                >
                    {tab.icon}
                    <span>{tab.label}</span>
                </button>
            ))}
        </div>
    );
};

