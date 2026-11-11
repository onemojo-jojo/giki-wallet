interface PendingReservationBannerProps {
    count: number;
    timeLeft: number;
    onReleaseAll: () => void;
}

/** Amber hold banner: seats are reserved for a limited time. */
export function PendingReservationBanner({ count, timeLeft, onReleaseAll }: PendingReservationBannerProps) {
    if (count <= 0) return null;

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div
            role="timer"
            aria-label={`${count} seat${count === 1 ? '' : 's'} held, ${formatTime(timeLeft)} left`}
            className="bg-signal-tint rounded-[20px] p-3.5 flex items-center gap-3 animate-in slide-in-from-top duration-300"
        >
            <span className="font-mono font-semibold text-base text-signal-text bg-card px-2.5 py-1.5 rounded-xl tabular shrink-0">
                {formatTime(timeLeft)}
            </span>
            <span className="flex-1 min-w-0 flex flex-col">
                <span className="text-sm font-extrabold text-[#4A2800]">
                    {count} seat{count === 1 ? '' : 's'} held for you
                </span>
                <span className="text-xs font-semibold text-[#6B3A00]">Confirm before the timer ends or they go back to the pool.</span>
            </span>
            <button
                type="button"
                onClick={onReleaseAll}
                className="h-10 px-3 rounded-xl bg-card text-signal-text text-xs font-extrabold shrink-0 focus-visible:outline-2 focus-visible:outline-iris"
            >
                Release All
            </button>
        </div>
    );
}
