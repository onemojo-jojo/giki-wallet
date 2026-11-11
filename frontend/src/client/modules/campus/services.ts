import { Bus, Dumbbell, Info, UtensilsCrossed, type LucideIcon } from 'lucide-react';

export type CampusServiceStatus = 'live' | 'soon';

export type CampusService = {
    key: string;
    name: string;
    description: string;
    icon: LucideIcon;
    status: CampusServiceStatus;
    /** Route to open when the service is live. */
    to?: string;
    /** Tailwind classes for the icon tile. */
    tone: string;
};

/**
 * Everything students can do on campus with G-Bux.
 *
 * To launch a new service (e.g. mess or squash), add its route and flip
 * `status` to 'live' with a `to` path — the Campus page and Home shortcuts
 * pick it up automatically.
 */
export const CAMPUS_SERVICES: CampusService[] = [
    {
        key: 'transport',
        name: 'Transport',
        description: 'Weekend buses to and from GIKI',
        icon: Bus,
        status: 'live',
        to: '/transport',
        tone: 'bg-iris-tint text-iris-strong',
    },
    {
        key: 'mess',
        name: 'Mess',
        description: 'Pay for meals with G-Bux',
        icon: UtensilsCrossed,
        status: 'soon',
        tone: 'bg-[#FFE7D6] text-[#8A3B00]',
    },
    {
        key: 'squash',
        name: 'Squash courts',
        description: 'Book a court slot',
        icon: Dumbbell,
        status: 'soon',
        tone: 'bg-mint-tint text-mint',
    },
];

export const ABOUT_LINK = {
    name: 'About Talaria',
    description: 'Who builds it and why',
    icon: Info,
    to: '/about',
};
