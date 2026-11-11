import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Full-screen white auth page (v2-SignIn / SignUp / Verify). On desktop it sits in a centred card. */
export const AuthScreen = ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className="min-h-[100dvh] bg-white md:bg-background md:flex md:items-center md:justify-center md:py-12 font-body text-ink">
        <main className={cn('w-full min-h-[100dvh] md:min-h-0 max-w-[440px] mx-auto bg-white md:rounded-[28px] md:shadow-sm px-6 pt-4 pb-8 md:p-8 flex flex-col gap-6', className)}>
            {children}
        </main>
    </div>
);

/** Back to the previous screen, or `fallback` when the page was opened directly. */
export const AuthBack = ({ fallback = '/auth/welcome', onClick }: { fallback?: string; onClick?: () => void }) => {
    const navigate = useNavigate();
    const location = useLocation();
    return (
        <button
            type="button"
            aria-label="Back"
            onClick={onClick ?? (() => (location.key !== 'default' ? navigate(-1) : navigate(fallback)))}
            className="size-11 rounded-[14px] bg-background text-ink flex items-center justify-center shrink-0 focus-visible:outline-2 focus-visible:outline-iris"
        >
            <ChevronLeft className="size-[22px]" strokeWidth={2.2} />
        </button>
    );
};

/** "1 / 3" progress used by sign-up. */
export const AuthProgress = ({ step, total = 3 }: { step: number; total?: number }) => (
    <>
        <div
            role="progressbar"
            aria-label={`Step ${step} of ${total}`}
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={total}
            className="flex-1 grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        >
            {Array.from({ length: total }).map((_, i) => (
                <span key={i} className={cn('h-1.5 rounded-full', i < step ? 'bg-iris' : 'bg-line')} />
            ))}
        </div>
        <span className="text-[13px] font-bold text-muted-foreground tabular">
            {step} / {total}
        </span>
    </>
);

export const AuthTitle = ({ title, sub }: { title: ReactNode; sub?: ReactNode }) => (
    <div className="flex flex-col gap-2">
        <h1 className="font-display font-extrabold text-[34px] leading-[1.05] tracking-[-0.03em]">{title}</h1>
        {sub && <p className="text-[15px] text-muted-foreground">{sub}</p>}
    </div>
);
