import { Link, useLocation } from 'react-router-dom';
import { TalariaMark } from '@/shared/components/ui/Logo';
import { useAuthStore } from '@/shared/stores/authStore';
import { getInitials } from '@/lib/initials';
import { MAIN_TABS, isTabActive } from '@/client/navigation';
import { cn } from '@/lib/utils';

interface ClientNavbarProps {
    onSignInClick?: () => void;
    onSignUpClick?: () => void;
    isAuthenticated: boolean;
}


/**
 * Student web header (v2-Web): logo, Home · Rides · Wallet · Tickets · Campus, and
 * your avatar + first name (→ profile, where sign out lives). Signed out: Sign in / Sign up.
 */
export const ClientNavbar = ({ onSignInClick, onSignUpClick, isAuthenticated }: ClientNavbarProps) => {
    const { pathname } = useLocation();
    const user = useAuthStore((s) => s.user);
    const firstName = user?.name?.split(/\s+/)[0] ?? '';

    return (
        <header className="sticky top-0 z-50 w-full bg-card border-b border-line">
            <div className="max-w-[1200px] mx-auto px-6 py-3.5 flex flex-wrap items-center gap-x-7 gap-y-4">
                <Link to="/" className="flex items-center gap-2.5 rounded-xl text-ink focus-visible:outline-2 focus-visible:outline-iris">
                    <TalariaMark size={36} />
                    <span className="font-display font-extrabold text-xl tracking-[-0.02em]">Talaria</span>
                </Link>

                <nav aria-label="Main" className="flex-1 flex flex-wrap gap-1">
                    {MAIN_TABS.map((t) => {
                        const { label, to } = t;
                        const active = isTabActive(t, pathname);
                        return (
                            <Link
                                key={t.key}
                                to={to}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'px-3.5 py-2.5 rounded-xl text-sm transition-colors focus-visible:outline-2 focus-visible:outline-iris',
                                    active ? 'bg-background text-ink font-extrabold' : 'text-[#4A4766] font-semibold hover:bg-background hover:text-ink'
                                )}
                            >
                                {label}
                            </Link>
                        );
                    })}
                </nav>

                {isAuthenticated ? (
                    <Link
                        to="/account"
                        aria-current={pathname.startsWith('/account') ? 'page' : undefined}
                        aria-label={`My account, ${firstName}`}
                        className="flex items-center gap-2.5 rounded-xl text-ink focus-visible:outline-2 focus-visible:outline-iris"
                    >
                        <span className="size-[38px] rounded-xl bg-iris text-white flex items-center justify-center text-sm font-extrabold">{getInitials(user?.name ?? '')}</span>
                        <span className="text-sm font-bold">{firstName}</span>
                    </Link>
                ) : (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onSignInClick}
                            className="h-10 px-4 rounded-xl text-sm font-bold text-ink hover:bg-background focus-visible:outline-2 focus-visible:outline-iris"
                        >
                            Sign in
                        </button>
                        <button
                            type="button"
                            onClick={onSignUpClick}
                            className="h-10 px-4 rounded-xl bg-iris text-white text-sm font-extrabold hover:bg-iris-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                        >
                            Create account
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
};
