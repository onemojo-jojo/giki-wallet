import { Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KeypadProps {
    onKey: (key: string) => void;
    onDelete: () => void;
    className?: string;
    /** Show a "00" key (amounts) or leave the bottom-left blank (codes). */
    doubleZero?: boolean;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * On-screen number pad. Used on phones so the system keyboard never covers
 * the Continue button. Physical keyboards still work through the input.
 */
export const Keypad = ({ onKey, onDelete, className, doubleZero = true }: KeypadProps) => (
    <div role="group" aria-label="Number pad" className={cn('grid grid-cols-3 gap-2', className)}>
        {DIGITS.map((d) => (
            <button
                key={d}
                type="button"
                onClick={() => onKey(d)}
                className="h-14 rounded-[14px] bg-card text-ink font-display text-2xl font-bold active:bg-secondary focus-visible:outline-2 focus-visible:outline-iris"
            >
                {d}
            </button>
        ))}
        {doubleZero ? (
            <button
                type="button"
                onClick={() => onKey('00')}
                className="h-14 rounded-[14px] bg-card text-ink font-display text-2xl font-bold active:bg-secondary focus-visible:outline-2 focus-visible:outline-iris"
            >
                00
            </button>
        ) : (
            <span aria-hidden="true" />
        )}
        <button
            type="button"
            onClick={() => onKey('0')}
            className="h-14 rounded-[14px] bg-card text-ink font-display text-2xl font-bold active:bg-secondary focus-visible:outline-2 focus-visible:outline-iris"
        >
            0
        </button>
        <button
            type="button"
            onClick={onDelete}
            aria-label="Delete"
            className="h-14 rounded-[14px] bg-card text-ink flex items-center justify-center active:bg-secondary focus-visible:outline-2 focus-visible:outline-iris"
        >
            <Delete className="size-6" aria-hidden="true" />
        </button>
    </div>
);
