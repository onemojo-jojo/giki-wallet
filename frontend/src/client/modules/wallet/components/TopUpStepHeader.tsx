import { ChevronLeft, X } from 'lucide-react';

interface TopUpStepHeaderProps {
    title: string;
    step?: number;
    total?: number;
    /** Back goes to the previous step; Close leaves the flow. */
    onBack?: () => void;
    onClose?: () => void;
}

export const TopUpStepHeader = ({ title, step, total = 3, onBack, onClose }: TopUpStepHeaderProps) => (
    <div className="flex items-center gap-3">
        {onBack ? (
            <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                className="size-11 rounded-[14px] bg-card text-ink flex items-center justify-center focus-visible:outline-2 focus-visible:outline-iris"
            >
                <ChevronLeft className="size-[22px]" strokeWidth={2.2} />
            </button>
        ) : onClose ? (
            <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="size-11 rounded-[14px] bg-card text-ink flex items-center justify-center focus-visible:outline-2 focus-visible:outline-iris"
            >
                <X className="size-5" strokeWidth={2.2} />
            </button>
        ) : null}
        <h1 className="flex-1 font-display font-extrabold text-xl text-ink">{title}</h1>
        {step ? (
            <span className="text-[13px] font-bold text-muted-foreground">
                Step {step} of {total}
            </span>
        ) : null}
    </div>
);
