import { useMemo } from 'react';
import { ArrowRightLeft, ArrowUpCircle, Bus, Ticket, User, ChevronRight } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { cn } from '@/lib/utils';

type Tile = {
    key: string;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick?: () => void;
    disabled?: boolean;
};

export const ServiceTiles = ({ onTransportClick }: { onTransportClick?: () => void }) => {
    const { onTopUpClick, onMyTicketsClick, onMyAccountClick } = useWallet();

    const tiles = useMemo<Tile[]>(
        () => {
            const allTiles = [
                {
                    key: 'topup',
                    title: 'Top up',
                    description: 'Add funds',
                    icon: ArrowUpCircle,
                    onClick: onTopUpClick,
                },

                {
                    key: 'transport',
                    title: 'Transport',
                    description: 'Book rides',
                    icon: Bus,
                    onClick: onTransportClick,
                },
                {
                    key: 'tickets',
                    title: 'Tickets',
                    description: 'My bookings',
                    icon: Ticket,
                    onClick: onMyTicketsClick,
                    disabled: !onMyTicketsClick,
                },
                {
                    key: 'account',
                    title: 'Account',
                    description: 'Profile',
                    icon: User,
                    onClick: onMyAccountClick,
                    disabled: !onMyAccountClick,
                },
            ];

            return allTiles;
        },
        [onMyAccountClick, onMyTicketsClick, onTopUpClick, onTransportClick]
    );

    return (
        <section className="mt-8">
            <div className="mb-4 px-1 border-l-4 border-accent pl-4">
                <h2 className="text-lg font-black text-primary uppercase tracking-tighter">Quick Actions</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 mt-6">
                {tiles.map((t) => {
                    const Icon = t.icon;
                    const isDisabled = !!t.disabled || !t.onClick;
                    return (
                        <button
                            key={t.key}
                            type="button"
                            onClick={t.onClick}
                            disabled={isDisabled}
                            className={cn(
                                'group flex flex-col items-center justify-center p-4 h-32 rounded-3xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200',
                                'focus:outline-none focus:ring-2 focus:ring-primary/20 active:scale-[0.98]',
                                isDisabled && 'opacity-50 cursor-not-allowed grayscale'
                            )}
                        >
                            <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-colors duration-300",
                                t.key === 'transport' ? "bg-primary/10 text-primary border border-primary/5 shadow-inner group-hover:bg-primary/20" :
                                    t.key === 'topup' ? "bg-primary/5 text-primary group-hover:bg-primary/10" :
                                        "bg-gray-50 text-gray-600 group-hover:bg-gray-100"
                            )}>
                                <Icon className="w-6 h-6" />
                            </div>

                            <div className="text-center">
                                <p className="text-sm font-semibold text-gray-900 group-hover:text-primary transition-colors">{t.title}</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">{t.description}</p>
                            </div>
                        </button>
                    );
                })}
            </div>
        </section>
    );
};

