import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MAIN_TABS, isTabActive } from '@/client/navigation';

/**
 * Mobile tab bar: Home · Rides · [Pass] · Wallet · Campus.
 * The centre button opens the user's ride pass (tickets).
 */
export const BottomNav = () => {
    const { pathname } = useLocation();

    return (
        <nav
            aria-label="Main"
            className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-card border-t border-line pb-[env(safe-area-inset-bottom)]"
        >
            <div className="grid grid-cols-5 items-start max-w-md mx-auto h-[68px] px-1.5 pt-2">
                {MAIN_TABS.map((tab) => {
                    const active = isTabActive(tab, pathname);
                    const Icon = tab.icon;

                    if (tab.key === 'pass') {
                        return (
                            <Link
                                key={tab.key}
                                to={tab.to}
                                aria-label={tab.label}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'justify-self-center -mt-7 size-[58px] rounded-[20px] flex items-center justify-center',
                                    'bg-ink text-volt ring-[5px] ring-background shadow-lg shadow-ink/20',
                                    'transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris'
                                )}
                            >
                                <Icon className="size-[26px]" strokeWidth={2} />
                            </Link>
                        );
                    }

                    return (
                        <Link
                            key={tab.key}
                            to={tab.to}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                                'flex flex-col items-center gap-[3px] text-[11px] rounded-xl py-0.5 min-h-11',
                                'focus-visible:outline-2 focus-visible:outline-iris',
                                active ? 'text-ink font-extrabold' : 'text-muted-foreground font-semibold'
                            )}
                        >
                            <Icon className="size-6" strokeWidth={active ? 2.2 : 1.9} />
                            {tab.label}
                            <span
                                aria-hidden="true"
                                className={cn('h-[3px] w-4 rounded-full', active ? 'bg-iris' : 'bg-transparent')}
                            />
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};
