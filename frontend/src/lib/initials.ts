/** "Ayesha Siddiqui" → "AS" (max two letters; "?" when empty). */
export const getInitials = (name: string) =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || '?';
