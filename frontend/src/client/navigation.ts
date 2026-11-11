import { Bus, GraduationCap, House, Ticket, Wallet, type LucideIcon } from 'lucide-react';

export type MainTab = {
    key: 'home' | 'rides' | 'wallet' | 'tickets' | 'campus';
    label: string;
    to: string;
    icon: LucideIcon;
    /** Extra path prefixes that should light this tab up. */
    match?: string[];
};

/**
 * The five main destinations, same order on the phone tab bar and the web header:
 * Home · Rides · Wallet · Tickets · Campus.
 */
export const MAIN_TABS: MainTab[] = [
    { key: 'home', label: 'Home', to: '/', icon: House },
    { key: 'rides', label: 'Rides', to: '/transport', icon: Bus },
    { key: 'wallet', label: 'Wallet', to: '/wallet', icon: Wallet, match: ['/top-up', '/payment'] },
    // The list; each ticket's pass (with its QR) opens from there. Lights up on /tickets/* too.
    { key: 'tickets', label: 'Tickets', to: '/tickets/all', icon: Ticket, match: ['/tickets'] },
    { key: 'campus', label: 'Campus', to: '/campus', icon: GraduationCap, match: ['/about'] },
];

export const isTabActive = (tab: MainTab, pathname: string) => {
    if (tab.to === '/') return pathname === '/';
    const prefixes = [tab.to, ...(tab.match ?? [])];
    return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
};
