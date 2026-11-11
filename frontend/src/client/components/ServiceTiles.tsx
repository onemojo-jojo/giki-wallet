import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpCircle, Bus, Ticket, User } from 'lucide-react';
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

/** Quick actions: Top up, Transport, Tickets, Account. */
export const ServiceTiles = ({ onTransportClick }: { onTransportClick?: () => void }) => {
    const navigate = useNavigate();
    const { onTopUpClick, onMyTicketsClick, onMyAccountClick } = useWallet();

    const tiles = useMemo<Tile[]>(
        () => [
            { key: 'topup', title: 'Top up', description: 'Add funds', icon: ArrowUpCircle, onClick: onTopUpClick },
            { key: 'transport', title: 'Transport', description: 'Book rides', icon: Bus, onClick: onTransportClick ?? (() => navigate('/transport')) },
            { key: 'tickets', title: 'Tickets', description: 'My bookings', icon: Ticket, onClick: onMyTicketsClick, disabled: !onMyTicketsClick },
            { key: 'account', title: 'Account', description: 'Profile', icon: User, onClick: onMyAccountClick, disabled: !onMyAccountClick },
        ],
        [navigate, onMyAccountClick, onMyTicketsClick, onTopUpClick, onTransportClick]
    );

    return (
        <section aria-label="Quick actions">
            <div className="grid grid-cols-4 gap-2.5">
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
                                'group flex flex-col items-center gap-1.5 rounded-[20px] bg-card py-3 px-1 transition-shadow hover:shadow-md',
                                'focus-visible:outline-2 focus-visible:outline-iris active:scale-[0.98]',
                                isDisabled && 'opacity-50 cursor-not-allowed'
                            )}
                        >
                            <span
                                className={cn(
                                    'size-11 rounded-[14px] flex items-center justify-center',
                                    t.key === 'topup' ? 'bg-iris text-white' : 'bg-iris-tint text-iris-strong'
                                )}
                            >
                                <Icon className="size-[22px]" />
                            </span>
                            <span className="text-[13px] font-extrabold text-ink leading-tight">{t.title}</span>
                            <span className="text-[11px] text-muted-foreground leading-tight -mt-1 hidden sm:block">{t.description}</span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
};
