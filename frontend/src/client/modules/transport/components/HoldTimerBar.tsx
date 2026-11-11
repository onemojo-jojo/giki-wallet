import { formatClock } from '../bookingHelpers';

interface HoldTimerBarProps {
    timeLeft: number;
    message: string;
    /** Optional actions (e.g. Continue, Release All) shown on the right. */
    actions?: { label: string; onClick: () => void; primary?: boolean }[];
}

/** Full-width amber strip used at the top of booking screens while seats are held. */
export const HoldTimerBar = ({ timeLeft, message, actions = [] }: HoldTimerBarProps) => (
    <div
        role="timer"
        aria-label={`${message}. ${Math.floor(timeLeft / 60)} minutes ${timeLeft % 60} seconds left`}
        className="-mx-4 -mt-4 md:mt-0 md:mx-0 md:rounded-2xl bg-signal-tint px-5 py-3 flex items-center gap-3"
    >
        <span className="font-mono font-semibold text-base text-signal-text bg-card px-2.5 py-1.5 rounded-[10px] tabular shrink-0">
            {formatClock(timeLeft)}
        </span>
        <span className="flex-1 text-[13px] font-bold text-[#6B3A00]">{message}</span>
        {actions.map((a) => (
            <button
                key={a.label}
                type="button"
                onClick={a.onClick}
                className={
                    a.primary
                        ? 'h-9 px-3 rounded-xl bg-ink text-white text-xs font-extrabold shrink-0 focus-visible:outline-2 focus-visible:outline-iris'
                        : 'h-9 px-3 rounded-xl bg-card text-signal-text text-xs font-extrabold shrink-0 focus-visible:outline-2 focus-visible:outline-iris'
                }
            >
                {a.label}
            </button>
        ))}
    </div>
);
