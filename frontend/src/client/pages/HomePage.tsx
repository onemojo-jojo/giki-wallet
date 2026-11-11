import { Link } from 'react-router-dom';
import { ServiceTiles } from '@/client/components/ServiceTiles';
import { BalanceHero } from '@/client/components/home/BalanceHero';
import { UpcomingRides } from '@/client/components/home/UpcomingRides';
import { CampusShortcuts } from '@/client/components/home/CampusShortcuts';
import { LogoMark } from '@/shared/components/ui/Logo';
import { useAuthStore } from '@/shared/stores/authStore';

const greeting = () => {
    const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Karachi' }).format(new Date()));
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
};

const SignedOutHero = () => (
    <section className="relative overflow-hidden rounded-[28px] bg-ink text-white p-6 flex flex-col gap-4">
        <LogoMark size={44} tone="volt" />
        <h1 className="font-display font-extrabold text-[34px] leading-[1.02] tracking-tight">
            Campus,
            <br />
            in your pocket.
        </h1>
        <p className="text-[15px] text-[#D9D6F2] max-w-sm">
            Top up G-Bux, grab a seat on the weekend bus and show your pass — all from one app.
        </p>
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

export const HomePage = () => {
    const { user } = useAuthStore();
    const firstName = user?.name?.split(/\s+/)[0];

    return (
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-6 pt-1">
            {user ? (
                <>
                    <h1 className="text-sm font-normal text-muted-foreground -mb-3">
                        {greeting()}
                        {firstName ? (
                            <>
                                , <span className="font-extrabold text-ink">{firstName}</span>
                            </>
                        ) : null}
                    </h1>
                    <BalanceHero />
                    <ServiceTiles />
                    <UpcomingRides />
                </>
            ) : (
                <>
                    <SignedOutHero />
                    <ServiceTiles />
                </>
            )}
            <CampusShortcuts />
        </div>
    );
};
