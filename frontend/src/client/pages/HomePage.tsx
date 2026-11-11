import { Link } from 'react-router-dom';
import { BalanceHero } from '@/client/components/home/BalanceHero';
import { UpcomingRides } from '@/client/components/home/UpcomingRides';
import { CampusShortcuts } from '@/client/components/home/CampusShortcuts';
import { TalariaMark } from '@/shared/components/ui/Logo';
import { useAuthStore } from '@/shared/stores/authStore';
import { useIsPhone } from '@/shared/hooks/useIsPhone';
import { WebBalanceCard } from '@/client/components/home/web/WebBalanceCard';
import { DeparturesPanel } from '@/client/components/home/web/DeparturesPanel';
import { RecentActivity } from '@/client/components/home/web/RecentActivity';

const SignedOutHero = () => (
    <section className="-mx-4 -mt-4 md:mx-0 md:mt-0 relative overflow-hidden rounded-b-[32px] md:rounded-[28px] bg-ink text-white px-6 pt-7 pb-7 flex flex-col gap-4">
        <h1 className="sr-only">Talaria</h1>
        <TalariaMark size={44} />
        <p className="font-display font-extrabold text-[34px] leading-[1.02] tracking-tight">
            Campus,
            <br />
            in your pocket.
        </p>
        <p className="text-[15px] text-[#D9D6F2] max-w-sm">Top up G-Bux, grab a seat on the weekend bus and show your pass — all from one app.</p>
        <div className="flex flex-wrap gap-2.5">
            <Link to="/auth/sign-up" className="h-12 px-5 rounded-2xl bg-volt text-ink font-extrabold text-[15px] flex items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt">
                Create account
            </Link>
            <Link to="/auth/sign-in" className="h-12 px-5 rounded-2xl border border-ink-3 text-white font-bold text-[15px] flex items-center hover:bg-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt">
                Sign in
            </Link>
        </div>
    </section>
);

/** Home (v2-Home on phones, v2-Web on wider screens). */
export const HomePage = () => {
    const { user } = useAuthStore();
    const isPhone = useIsPhone();

    // Web (v2-Web): balance + your weekend on the left, departures + recent activity on the right.
    if (user && !isPhone) {
        return (
            <div className="w-full flex flex-wrap gap-6 items-start">
                <h1 className="sr-only">Home</h1>
                <div className="flex-[1_1_340px] min-w-0 flex flex-col gap-5">
                    <WebBalanceCard />
                    <UpcomingRides variant="panel" />
                    <CampusShortcuts />
                </div>
                <div className="flex-[999_1_560px] min-w-0 flex flex-col gap-5">
                    <DeparturesPanel />
                    <RecentActivity />
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-5">
            {user ? (
                <>
                    <h1 className="sr-only">Home</h1>
                    <BalanceHero />
                    <UpcomingRides />
                </>
            ) : (
                <SignedOutHero />
            )}
            <CampusShortcuts />
        </div>
    );
};
