import { useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Bus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TalariaMark } from '@/shared/components/ui/Logo';
import { useAuthStore } from '@/shared/stores/authStore';

const SLIDES = [
    {
        title: (
            <>
                Campus,
                <br />
                in your
                <br />
                pocket.
            </>
        ),
        text: 'Top up G-Bux, grab a seat on the weekend bus and show your pass, all from one app.',
    },
    {
        title: (
            <>
                A seat home
                <br />
                in two taps.
            </>
        ),
        text: 'See every bus leaving GIKI, pick your stop and pay straight from your G-Bux.',
    },
    {
        title: (
            <>
                Your pass,
                <br />
                ready at
                <br />
                the gate.
            </>
        ),
        text: 'Show the QR when you board. Plans changed? Cancel before booking closes and get refunded instantly.',
    },
];

/** First screen for signed-out users (v2-Welcome). */
export const WelcomePage = () => {
    const user = useAuthStore((s) => s.user);
    const [slide, setSlide] = useState(0);
    const touch = useRef<{ x: number; y: number } | null>(null);

    if (user) return <Navigate to="/" replace />;

    const s = SLIDES[slide];

    return (
        <div className="min-h-[100dvh] bg-ink text-white font-body">
            <main
                className="relative overflow-hidden min-h-[100dvh] max-w-[440px] mx-auto px-6 pt-7 pb-8 flex flex-col"
                onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
                onTouchEnd={(e) => {
                    const start = touch.current;
                    touch.current = null;
                    if (!start) return;
                    const dx = e.changedTouches[0].clientX - start.x;
                    const dy = e.changedTouches[0].clientY - start.y;
                    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                        setSlide((i) => Math.min(SLIDES.length - 1, Math.max(0, i + (dx < 0 ? 1 : -1))));
                    }
                }}
            >
                {/* Dotted bus route behind the chips. */}
                <svg width="390" height="520" viewBox="0 0 390 520" fill="none" aria-hidden="true" className="absolute left-0 top-[70px] pointer-events-none">
                    <path d="M-20 420 C 60 380, 70 290, 160 300 S 300 200, 260 120 S 330 30, 420 40" stroke="#C8F04A" strokeWidth="2.5" strokeDasharray="1 11" strokeLinecap="round" />
                    <circle cx="160" cy="300" r="7" fill="#C8F04A" />
                    <circle cx="260" cy="120" r="7" fill="#FFFFFF" />
                </svg>

                <div className="relative flex items-center gap-2.5">
                    <TalariaMark size={36} />
                    <span className="font-display font-extrabold text-xl tracking-[-0.02em]">Talaria</span>
                </div>

                {/* Illustration: what the app does, as three floating chips. */}
                <div aria-hidden="true" className="relative mt-[74px] flex flex-col gap-2.5 items-start">
                    <div className="flex items-center gap-2.5 bg-ink-2 rounded-2xl px-3.5 py-2.5 -rotate-3">
                        <span className="size-8 rounded-[10px] bg-volt text-ink flex items-center justify-center">
                            <Plus className="size-[18px]" strokeWidth={2.2} />
                        </span>
                        <span className="text-sm font-bold">Rs 500 added</span>
                    </div>
                    <div className="flex items-center gap-2.5 bg-white text-ink rounded-2xl px-3.5 py-2.5 ml-[120px] rotate-2">
                        <span className="size-8 rounded-[10px] bg-iris-tint text-iris-strong flex items-center justify-center">
                            <Bus className="size-[18px]" />
                        </span>
                        <span className="text-sm font-bold">Islamabad · Fri 4:30 PM</span>
                    </div>
                    <div className="flex items-center gap-2.5 bg-iris rounded-2xl px-3.5 py-2.5 ml-[30px] -rotate-1">
                        <span className="font-mono text-[13px] font-semibold">2023-0418</span>
                        <span className="text-[13px] font-bold">Verified student</span>
                    </div>
                </div>

                <div className="relative mt-auto pt-10 flex flex-col gap-3.5">
                    <div aria-live="polite" className="flex flex-col gap-3.5">
                        <h1 className="font-display font-extrabold text-[46px] tracking-[-0.04em] leading-[0.98]">{s.title}</h1>
                        <p className="text-base leading-normal text-[#D9D6F2]">{s.text}</p>
                    </div>
                    <div className="flex gap-1.5 mt-1 mb-2">
                        {SLIDES.map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setSlide(i)}
                                aria-label={`Slide ${i + 1} of ${SLIDES.length}`}
                                aria-current={i === slide ? 'true' : undefined}
                                className="h-6 flex items-center rounded focus-visible:outline-2 focus-visible:outline-volt"
                            >
                                <span className={cn('h-1.5 rounded-full transition-all', i === slide ? 'w-[22px] bg-volt' : 'w-1.5 bg-[#4A4580]')} />
                            </button>
                        ))}
                    </div>
                    <Link
                        to="/auth/sign-up"
                        className="h-14 rounded-[18px] bg-volt text-ink flex items-center justify-center text-base font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt"
                    >
                        Create account
                    </Link>
                    <Link
                        to="/auth/sign-in"
                        className="h-[52px] rounded-[18px] border-[1.5px] border-[#4A4580] text-white flex items-center justify-center text-base font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt"
                    >
                        I already have one
                    </Link>
                </div>
            </main>
        </div>
    );
};

export default WelcomePage;
