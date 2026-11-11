import { Bus, GraduationCap, House, QrCode, Wallet, type LucideIcon } from 'lucide-react';

export type MainTab = {
    key: 'home' | 'rides' | 'pass' | 'wallet' | 'campus';
    label: string;
    to: string;
    icon: LucideIcon;
    /** Extra path prefixes that should light this tab up. */
    match?: string[];
};

/**
 * The five main destinations. Used by the mobile tab bar and the desktop navbar
 * so both stay in sync. Pass sits in the middle and opens the user's tickets.
 */
export const MAIN_TABS: MainTab[] = [
    { key: 'home', label: 'Home', to: '/', icon: House },
    { key: 'rides', label: 'Rides', to: '/transport', icon: Bus },
    { key: 'pass', label: 'My pass', to: '/tickets', icon: QrCode },
    { key: 'wallet', label: 'Wallet', to: '/wallet', icon: Wallet, match: ['/top-up', '/payment'] },
    { key: 'campus', label: 'Campus', to: '/campus', icon: GraduationCap, match: ['/about'] },
];

export const isTabActive = (tab: MainTab, pathname: string) => {
    if (tab.to === '/') return pathname === '/';
    const prefixes = [tab.to, ...(tab.match ?? [])];
    return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
};
