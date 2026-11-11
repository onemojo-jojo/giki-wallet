import { useEffect, useId, useRef, type ReactNode } from 'react';

interface BottomSheetProps {
    open: boolean;
    title: ReactNode;
    /** Short line under the title. */
    subtitle?: ReactNode;
    onClose: () => void;
    /** While true, Escape and the backdrop don't close it. */
    busy?: boolean;
    children: ReactNode;
}

/**
 * v2 bottom sheet (centred dialog on wider screens): grab handle, big title, content.
 * Escape / backdrop close it, Tab stays inside, focus starts on the first button.
 */
export const BottomSheet = ({ open, title, subtitle, onClose, busy, children }: BottomSheetProps) => {
    const ref = useRef<HTMLElement>(null);
    const titleId = useId();

    useEffect(() => {
        if (!open) return;
        const previous = document.activeElement as HTMLElement | null;
        ref.current?.querySelector<HTMLElement>('button:not([disabled]), a[href], input, select')?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !busy) onClose();
            if (e.key === 'Tab' && ref.current) {
                const items = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])')];
                if (!items.length) return;
                const first = items[0];
                const last = items[items.length - 1];
                if (!ref.current.contains(document.activeElement)) {
                    e.preventDefault();
                    first.focus();
                } else if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            previous?.focus?.();
        };
    }, [open, busy, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center">
            <div aria-hidden="true" className="absolute inset-0 bg-ink/60" onClick={() => !busy && onClose()} />
            <section
                ref={ref}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="relative w-full max-w-[480px] bg-card rounded-t-[28px] md:rounded-[28px] px-5 pt-3 pb-7 md:pt-6 flex flex-col gap-4 animate-in slide-in-from-bottom-8 duration-200"
            >
                <span aria-hidden="true" className="md:hidden self-center w-10 h-[5px] rounded-full bg-[#D9D7E5]" />
                <div className="flex flex-col gap-1.5">
                    <h2 id={titleId} className="font-display font-extrabold text-[26px] tracking-tight text-ink">
                        {title}
                    </h2>
                    {subtitle && <p className="text-[15px] text-[#4A4766]">{subtitle}</p>}
                </div>
                {children}
            </section>
        </div>
    );
};
