import { ReactNode, useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogoMark } from '@/shared/components/ui/Logo';
import { ClientNavbar, Footer } from '@/shared/components/layout';
import { BottomNav } from '@/shared/components/layout/BottomNav';
import { TransactionHistory } from '@/client/modules/wallet/components/TransactionHistory';
import { FeedbackModal } from '@/client/modules/feedback/components/FeedbackModal';
import { useFeedback } from '@/client/modules/feedback/hooks/useFeedback';
import { Button } from '@/shared/components/ui/button';
import { WalletProvider } from '@/context/WalletContext';
import { useAuthStore } from '@/shared/stores/authStore';
import { toast } from '@/lib/toast';

interface ClientLayoutProps {
    children: ReactNode;
}

const getInitials = (name: string) =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || '?';

export const ClientLayout = ({ children }: ClientLayoutProps) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { user, signOut } = useAuthStore();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    // Keep the floating feedback button off the payment screens, where it would sit on the keypad / actions.
    const hideFeedbackButton = pathname.startsWith('/top-up') || pathname.startsWith('/payment');


    const handleHistoryClick = () => {
        setIsHistoryOpen(true);
    };

    const handleTopUpClick = () => {
        navigate('/top-up');
    };



    const handleMyTicketsClick = () => {
        navigate('/tickets');
    };

    const handleMyAccountClick = () => {
        navigate('/account');
    };

    const handleSignInClick = () => {
        navigate('/auth/sign-in');
    };

    const handleSignUpClick = () => {
        navigate('/auth/sign-up');
    };

    const handleLogout = () => {
        signOut();
        toast.success('Signed out');
        navigate('/auth/sign-in', { replace: true });
    };

    const {
        isOpen: isFeedbackOpen,
        openFeedback,
        closeFeedback,
        submitFeedback,
        isPending: isFeedbackPending
    } = useFeedback();

    return (
        <WalletProvider
            onHistoryClick={handleHistoryClick}
            onTopUpClick={handleTopUpClick}

            onMyTicketsClick={handleMyTicketsClick}
            onMyAccountClick={handleMyAccountClick}
        >
            <div className="min-h-screen flex flex-col bg-background font-body pb-28 md:pb-0">
                <div className="hidden md:block">
                    <ClientNavbar
                        onMyBookingsClick={handleMyTicketsClick}
                        onMyAccountClick={handleMyAccountClick}
                        onSignInClick={handleSignInClick}
                        onSignUpClick={handleSignUpClick}
                        onLogoutClick={handleLogout}
                        isAuthenticated={!!user}
                    />
                </div>

                {/* Mobile Top Bar */}
                <header className="md:hidden sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-line h-16 flex items-center justify-between px-4">
                    <Link to="/" className="flex items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-iris">
                        <LogoMark size={34} />
                        <span className="font-display font-extrabold text-xl text-ink tracking-tight">GIKI Wallet</span>
                    </Link>
                    {user ? (
                        <Link
                            to="/account"
                            aria-label="My account"
                            className="size-11 rounded-[14px] bg-iris text-white font-display font-bold text-[15px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                        >
                            {getInitials(user.name)}
                        </Link>
                    ) : (
                        <Link
                            to="/auth/sign-in"
                            className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-extrabold flex items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                        >
                            Sign in
                        </Link>
                    )}
                </header>

                <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 lg:px-6 py-4 md:py-12">
                    {children}
                </main>

                <div className="hidden md:block">
                    <Footer />
                </div>

                {/* Bottom Nav for Mobile */}
                <BottomNav />

                {/* Modals */}
                <TransactionHistory
                    isOpen={isHistoryOpen}
                    onClose={() => setIsHistoryOpen(false)}
                />
                <FeedbackModal
                    isOpen={isFeedbackOpen}
                    onClose={closeFeedback}
                    onSubmit={submitFeedback}
                    isPending={isFeedbackPending}
                />

                {/* Floating Feedback Trigger */}
                {!!user && !hideFeedbackButton && (
                    <div className="fixed bottom-[104px] right-4 md:bottom-8 md:right-8 z-40">
                        <Button
                            onClick={openFeedback}
                            className="rounded-full shadow-lg h-12 w-12 p-0 bg-primary hover:bg-primary/90 text-white"
                            aria-label="Send Feedback"
                        >
                            <MessageSquarePlus className="h-6 w-6" />
                        </Button>
                    </div>
                )}
            </div>
        </WalletProvider>
    );
};

