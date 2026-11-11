import { cn } from '@/lib/utils';

interface LogoMarkProps {
    size?: number;
    /** `dark`: Midnight tile with a Volt G (default). `volt`: Volt tile with a Midnight G, for dark backgrounds. */
    tone?: 'dark' | 'volt';
    className?: string;
}

/** The v2 brand mark: a "G" drawn as a bus loop that ends at a stop. */
export const LogoMark = ({ size = 40, tone = 'dark', className }: LogoMarkProps) => {
    const tile = tone === 'volt' ? '#C8F04A' : '#16133A';
    const stroke = tone === 'volt' ? '#16133A' : '#C8F04A';
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 48 48"
            aria-hidden="true"
            className={cn('shrink-0', className)}
        >
            <rect width="48" height="48" rx="13" fill={tile} />
            <path
                d="M32.4 16.9A11 11 0 1 0 35 24H25"
                fill="none"
                stroke={stroke}
                strokeWidth="5"
                strokeLinecap="round"
            />
        </svg>
    );
};

interface LogoProps {
    subText?: string;
    className?: string;
    /** Use `light` on dark backgrounds. */
    variant?: 'default' | 'light';
}

export const Logo = ({ subText, className, variant = 'default' }: LogoProps) => {
    const isLight = variant === 'light';
    return (
        <div className={cn('flex items-center gap-3 group select-none', className)}>
            <LogoMark
                size={40}
                tone={isLight ? 'volt' : 'dark'}
                className="transition-transform duration-300 group-hover:scale-105"
            />
            <div className="flex flex-col items-start leading-none">
                <span
                    className={cn(
                        'font-display font-extrabold text-2xl tracking-tight',
                        isLight ? 'text-white' : 'text-ink'
                    )}
                >
                    GIKI Wallet
                </span>
                {subText && (
                    <span
                        className={cn(
                            'text-[10px] uppercase tracking-widest font-bold ml-px mt-1',
                            isLight ? 'text-ink-muted' : 'text-muted-foreground'
                        )}
                    >
                        {subText}
                    </span>
                )}
            </div>
        </div>
    );
};
