import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { WalletCard } from '../components/WalletCard';

/**
 * Destination of the Wallet tab. For now it reuses the existing balance card
 * (with its history and refresh controls); the full v2 wallet screen replaces
 * it in a later revamp PR.
 */
export const WalletTabPage = () => (
    <div className="max-w-3xl mx-auto w-full flex flex-col gap-4 pt-1">
        <header className="flex items-center justify-between gap-3">
            <h1 className="font-display font-extrabold text-[32px] tracking-tight text-ink leading-none">Wallet</h1>
            <Link
                to="/top-up"
                className="h-11 px-4 rounded-2xl bg-primary text-primary-foreground font-extrabold text-sm flex items-center gap-1.5 hover:bg-iris-strong transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
            >
                <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
                Add money
            </Link>
        </header>
        <WalletCard />
    </div>
);

export default WalletTabPage;
