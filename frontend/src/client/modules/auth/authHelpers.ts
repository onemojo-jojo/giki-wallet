export const GIKI_DOMAIN = '@giki.edu.pk';

/** "u2023418" → "u2023418@giki.edu.pk"; a full address is used as typed. */
export const toEmail = (input: string) => {
    const v = input.trim();
    if (!v) return '';
    return v.includes('@') ? v : `${v}${GIKI_DOMAIN}`;
};

/** Registration number → the usual student email ("2023418" → "u2023418@giki.edu.pk"). */
export const emailFromRegNo = (reg: string) => {
    const v = reg.trim().toLowerCase().replace(/[\s-]/g, '');
    if (!v) return '';
    return /^\d+$/.test(v) ? `u${v}${GIKI_DOMAIN}` : `${v}${GIKI_DOMAIN}`;
};
