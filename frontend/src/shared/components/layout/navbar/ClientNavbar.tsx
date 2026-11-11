import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';
import { Logo } from '@/shared/components/ui/Logo';
import { Button } from '@/shared/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { MAIN_TABS, isTabActive } from '@/client/navigation';
import { cn } from '@/lib/utils';

interface ClientNavbarProps {
    onMyBookingsClick?: () => void;
    onMyAccountClick?: () => void;
    onSignInClick?: () => void;
    onSignUpClick?: () => void;
    onLogoutClick?: () => void;
    isAuthenticated: boolean;
}

/** Desktop label for the centre "Pass" tab. */
const desktopLabel = (key: string, label: string) => (key === 'pass' ? 'My Tickets' : label);

export const ClientNavbar = ({
    onMyBookingsClick,
    onMyAccountClick,
    onSignInClick,
    onSignUpClick,
    onLogoutClick,
    isAuthenticated,
}: ClientNavbarProps) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const links = [
        ...MAIN_TABS.map((t) => ({ key: t.key, label: desktopLabel(t.key, t.label), to: t.to, active: isTabActive(t, pathname) })),
        { key: 'about', label: 'About', to: '/about', active: pathname === '/about' },
    ];

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-line bg-card/90 backdrop-blur-xl">
            <div className="max-w-6xl mx-auto px-4 lg:px-6 h-16 flex items-center gap-6">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center group rounded-xl focus-visible:outline-2 focus-visible:outline-iris"
                    aria-label="Go to home"
                >
                    <Logo />
                </button>

                <div className="flex-1 flex items-center gap-1 overflow-x-auto">
                    {links.map((l) => (
                        <Link
                            key={l.key}
                            to={l.to}
                            aria-current={l.active ? 'page' : undefined}
                            className={cn(
                                'h-10 px-3.5 rounded-xl text-sm whitespace-nowrap flex items-center transition-colors',
                                'focus-visible:outline-2 focus-visible:outline-iris',
                                l.active
                                    ? 'bg-secondary text-ink font-extrabold'
                                    : 'text-[#4A4766] font-semibold hover:bg-secondary/60 hover:text-ink'
                            )}
                        >
                            {l.label}
                        </Link>
                    ))}
                </div>

                {isAuthenticated ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Account menu"
                                className="size-10 rounded-xl bg-iris text-white hover:bg-iris-strong hover:text-white"
                            >
                                <User className="size-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 mt-2 rounded-2xl p-2 border-line shadow-xl bg-card">
                            <DropdownMenuLabel className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                Account
                            </DropdownMenuLabel>
                            <DropdownMenuItem onClick={onMyAccountClick} className="rounded-lg cursor-pointer font-semibold text-ink">
                                Profile settings
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onMyBookingsClick} className="rounded-lg cursor-pointer font-semibold text-ink">
                                My Tickets
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate('/about')} className="rounded-lg cursor-pointer font-semibold text-ink">
                                About Us
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1 bg-line" />
                            <DropdownMenuItem
                                onClick={onLogoutClick}
                                className="text-coral focus:text-coral focus:bg-coral-tint rounded-lg cursor-pointer font-semibold"
                            >
                                Sign out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            className="rounded-xl font-bold text-ink"
                            onClick={onSignInClick}
                        >
                            Sign in
                        </Button>
                        <Button className="rounded-xl font-extrabold bg-primary text-primary-foreground hover:bg-iris-strong" onClick={onSignUpClick}>
                            Sign up
                        </Button>
                    </div>
                )}
            </div>
        </nav>
    );
};
