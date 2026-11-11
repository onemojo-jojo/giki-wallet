import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
    hint?: ReactNode;
    /** Shown inside the field after the input (e.g. "@giki.edu.pk"). */
    suffix?: ReactNode;
    mono?: boolean;
}

/** Labelled 56px input with the v2 focus ring; errors are announced and linked to the input. */
export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(({ label, error, hint, suffix, mono, className, type, ...rest }, ref) => {
    const id = useId();
    const [shown, setShown] = useState(false);
    const isPassword = type === 'password';
    const describedBy = [error ? `${id}-err` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;

    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-[13px] font-bold text-ink">
                {label}
            </label>
            <span
                className={cn(
                    'flex items-center h-14 rounded-2xl bg-white px-3.5 border-[1.5px] focus-within:border-2',
                    error ? 'border-coral focus-within:border-coral' : 'border-[#D9D7E5] focus-within:border-iris',
                    isPassword && 'pr-1.5'
                )}
            >
                <input
                    ref={ref}
                    id={id}
                    type={isPassword && shown ? 'text' : type}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy}
                    className={cn('flex-1 min-w-0 h-full bg-transparent outline-none text-base text-ink placeholder:text-[#8C89A6]', mono ? 'font-mono' : 'font-semibold', className)}
                    {...rest}
                />
                {suffix && <span className="text-[15px] text-muted-foreground shrink-0">{suffix}</span>}
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShown((s) => !s)}
                        aria-label={shown ? 'Hide password' : 'Show password'}
                        aria-pressed={shown}
                        className="size-11 rounded-xl text-muted-foreground flex items-center justify-center shrink-0 focus-visible:outline-2 focus-visible:outline-iris"
                    >
                        {shown ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                )}
            </span>
            {hint && !error && (
                <span id={`${id}-hint`} className="text-xs text-muted-foreground">
                    {hint}
                </span>
            )}
            {error && (
                <span id={`${id}-err`} role="alert" className="text-xs font-semibold text-coral">
                    {error}
                </span>
            )}
        </div>
    );
});
AuthField.displayName = 'AuthField';

export const primaryBtn =
    'h-14 w-full rounded-[18px] bg-iris text-white text-base font-extrabold flex items-center justify-center gap-2 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris';
