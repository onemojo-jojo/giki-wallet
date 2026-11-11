import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface DropdownContextValue {
    isOpen: boolean;
    setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
    triggerRect: DOMRect | null;
}

const DropdownContext = React.createContext<DropdownContextValue | undefined>(undefined);

export const DropdownMenu = ({ children }: { children: React.ReactNode }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [triggerRect, setTriggerRect] = React.useState<DOMRect | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const isInsideTrigger = containerRef.current?.contains(target);
            const isInsidePortal = (target as HTMLElement).closest?.('[data-dropdown-content="true"]');

            if (!isInsideTrigger && !isInsidePortal) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <DropdownContext.Provider value={{ isOpen, setIsOpen, triggerRect }}>
            <div className="relative inline-block text-left" ref={containerRef}>
                {React.Children.map(children, child => {
                    if (React.isValidElement(child) && (child.type as any).displayName === 'DropdownMenuTrigger') {
                        return React.cloneElement(child as React.ReactElement<any>, {
                            onTriggerClick: (rect: DOMRect) => {
                                setTriggerRect(rect);
                                setIsOpen(!isOpen);
                            }
                        });
                    }
                    return child;
                })}
            </div>
        </DropdownContext.Provider>
    );
};

export const DropdownMenuTrigger = ({ children, asChild, onTriggerClick }: { children: React.ReactNode; asChild?: boolean; onTriggerClick?: (rect: DOMRect) => void }) => {
    const context = React.useContext(DropdownContext);
    if (!context) throw new Error('DropdownMenuTrigger must be used within DropdownMenu');

    const handleClick = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (onTriggerClick) {
            onTriggerClick(rect);
        } else {
            context.setIsOpen(!context.isOpen);
        }

        if (asChild && React.isValidElement(children)) {
            const child = children as React.ReactElement<any>;
            if (child.props.onClick) {
                child.props.onClick(e);
            }
        }
    };

    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement<any>, {
            onClick: handleClick,
            'aria-expanded': context.isOpen,
        });
    }

    return (
        <button onClick={handleClick} className="flex items-center gap-1">
            {children} <ChevronDown className="w-4 h-4" />
        </button>
    );
};
(DropdownMenuTrigger as any).displayName = 'DropdownMenuTrigger';

export const DropdownMenuContent = ({
    children,
    className,
    align = 'center'
}: {
    children: React.ReactNode;
    className?: string;
    align?: 'start' | 'center' | 'end';
}) => {
    const context = React.useContext(DropdownContext);
    if (!context) throw new Error('DropdownMenuContent must be used within DropdownMenu');

    if (!context.isOpen || !context.triggerRect) return null;

    const { triggerRect } = context;

    // Calculate position
    const top = triggerRect.bottom + window.scrollY;
    let left = triggerRect.left + window.scrollX;

    if (align === 'center') {
        left = triggerRect.left + window.scrollX + (triggerRect.width / 2);
    } else if (align === 'end') {
        left = triggerRect.right + window.scrollX;
    }

    const style: React.CSSProperties = {
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        transform: align === 'center' ? 'translateX(-50%)' : align === 'end' ? 'translateX(-100%)' : undefined,
        zIndex: 9999,
    };

    return createPortal(
        <div
            style={style}
            data-dropdown-content="true"
            className={cn(
                "mt-2 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
                className
            )}
        >
            {children}
        </div>,
        document.body
    );
};

export const DropdownMenuItem = ({
    children,
    className,
    onClick,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    const context = React.useContext(DropdownContext);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        context?.setIsOpen(false);
    };

    return (
        <button
            className={cn(
                "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-secondary hover:text-secondary-foreground focus:bg-secondary focus:text-secondary-foreground disabled:pointer-events-none disabled:opacity-50 text-left",
                className
            )}
            onClick={handleClick}
            {...props}
        >
            {children}
        </button>
    );
};

export const DropdownMenuLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => {
    return (
        <div className={cn("px-2 py-1.5 text-sm font-semibold", className)}>
            {children}
        </div>
    );
};

export const DropdownMenuSeparator = ({ className }: { className?: string }) => {
    return <div className={cn("-mx-1 my-1 h-px bg-muted", className)} />;
};
