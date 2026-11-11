import { ReactNode } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ClientNavbar } from '@/shared/components/layout';
import { BottomNav } from '@/shared/components/layout/BottomNav';
import { OfflineBanner } from '@/client/components/OfflineBanner';
import { FeedbackModal } from '@/client/modules/feedback/components/FeedbackModal';
import { useFeedback } from '@/client/modules/feedback/hooks/useFeedback';
import { Button } from '@/shared/components/ui/button';
import { useAuthStore } from '@/shared/stores/authStore';

interface ClientLayoutProps {
    children: ReactNode;
}

export const ClientLayout = ({ children }: ClientLayoutProps) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { user } = useAuthStore();
    // Keep the floating feedback button off the payment and booking screens, where it would sit on the keypad / primary actions.
    const hideFeedbackButton = pathname.startsWith('/top-up') || pathname.startsWith('/payment') || pathname.startsWith('/transport');

    const handleSignInClick = () => {
        navigate('/auth/sign-in');
    };

    const handleSignUpClick = () => {
        navigate('/auth/sign-up');
    };

    const {
        isOpen: isFeedbackOpen,
        openFeedback,
        closeFeedback,
        submitFeedback,
        isPending: isFeedbackPending
    } = useFeedback();

    return (
        <>
            <div className="min-h-screen flex flex-col bg-background font-body pb-28 md:pb-0">
                <div className="hidden md:block">
                    <ClientNavbar onSignInClick={handleSignInClick} onSignUpClick={handleSignUpClick} isAuthenticated={!!user} />
                </div>

                {/* No mobile top bar: each screen starts with its own title (v2 design); Home has the avatar. */}

                <main className="flex-1 flex flex-col max-w-[1200px] mx-auto w-full px-4 md:px-6 py-4 md:pt-7 md:pb-12">
                    <OfflineBanner />
                    {children}
                </main>

                {/* Web: a quiet footer line instead of the old dark footer (v2-Web has none). */}
                <footer className="hidden md:block border-t border-line bg-card">
                    <p className="max-w-[1200px] mx-auto px-6 py-4 text-xs text-muted-foreground">
                        © {new Date().getFullYear()} Microsoft Club GIKI. All Rights Reserved.
                    </p>
                </footer>

                {/* Bottom Nav for Mobile */}
                <BottomNav />

                {/* Modals */}
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
        </>
    );
};

