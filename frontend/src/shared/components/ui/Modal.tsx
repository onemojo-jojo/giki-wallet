import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    footer?: ReactNode;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const Modal = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    size = 'md',
    className
}: ModalProps) => {
    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'md:w-[400px]',
        md: 'md:w-[500px]',
        lg: 'md:w-[600px]'
    };

    return (
        <div className={cn(
            "fixed inset-0 z-[45] transition-all duration-300",
            isOpen ? "visible" : "invisible delay-300"
        )}>
            {/* Backdrop */}
            <div
                className={cn(
                    "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0"
                )}
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className={cn(
                // Mobile: Bottom Sheet logic
                "absolute inset-x-0 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full",

                // Mobile: Lift up to expose BottomNav
                "md:h-auto mb-[104px] md:mb-0 max-h-[60vh] md:max-h-[90vh]",

                sizeClasses[size],
                "bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl transition-all duration-500 ease-in-out flex flex-col border border-slate-100/50",

                // Animation
                isOpen ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 md:translate-y-0 md:scale-95",
                className
            )}>
                {/* Mobile Drag Indicator */}
                <div className="md:hidden w-full flex items-center justify-center pt-4 pb-2 cursor-pointer" onClick={onClose}>
                    <div className="w-12 h-1.5 bg-slate-100 rounded-full" />
                </div>

                {/* Header */}
                {title && (
                    <div className="flex justify-between items-start px-8 pt-6 pb-2 md:pt-8 md:pb-4 md:px-8">
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">{title}</h2>
                            <div className="h-1 w-12 bg-primary/20 rounded-full mt-2" />
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-2xl h-10 w-10 transition-all"
                            onClick={onClose}
                            aria-label="Close"
                        >
                            <X className="h-5 w-5 stroke-[2.5]" />
                        </Button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 pt-4">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="p-8 border-t border-slate-50 bg-slate-50/30 rounded-b-[2.5rem]">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

