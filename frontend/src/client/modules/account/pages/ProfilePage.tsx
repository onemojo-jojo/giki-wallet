import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BadgeCheck, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { toast } from '@/lib/toast';
import { getInitials } from '@/lib/initials';
import { useAuthStore } from '@/shared/stores/authStore';
import { extractStudentRegIdFromEmail } from '@/shared/modules/auth/utils';
import { FeedbackModal } from '@/client/modules/feedback/components/FeedbackModal';
import { useFeedback } from '@/client/modules/feedback/hooks/useFeedback';
import { getQuota } from '@/client/modules/transport/api';
import type { QuotaResponse } from '@/client/modules/transport/validators';

/** "03001234567" → "0300 ••• 4567" */
const maskPhone = (p?: string | null) => {
    const d = (p ?? '').replace(/\D/g, '');
    return d.length >= 7 ? `${d.slice(0, 4)} ••• ${d.slice(-4)}` : p || 'Not provided';
};

const ROLE_LABEL: Record<string, string> = { STUDENT: 'STUDENT ID', EMPLOYEE: 'STAFF ID' };

type Row = { label: string; value?: ReactNode; to?: string; onClick?: () => void };

const RowList = ({ title, rows }: { title: string; rows: Row[] }) => (
    <section aria-labelledby={`sec-${title}`} className="flex flex-col gap-2">
        <h2 id={`sec-${title}`} className="px-1 text-xs font-extrabold tracking-[0.08em] text-muted-foreground">
            {title}
        </h2>
        <ul className="bg-card rounded-[20px] px-4">
            {rows.map((r, i) => {
                const inner = (
                    <>
                        <span className="flex-1 text-[15px] font-semibold text-ink">{r.label}</span>
                        {r.value !== undefined && <span className="text-[13px] text-muted-foreground text-right">{r.value}</span>}
                        {(r.to || r.onClick) && <ChevronRight className="size-[18px] text-[#8C89A6] shrink-0" aria-hidden="true" />}
                    </>
                );
                const cls = 'w-full min-h-[52px] flex items-center gap-3 text-left rounded-lg focus-visible:outline-2 focus-visible:outline-iris';
                return (
                    <li key={r.label} className={i ? 'border-t border-[#F0EFF5]' : ''}>
                        {r.to ? (
                            <Link to={r.to} className={cls}>
                                {inner}
                            </Link>
                        ) : r.onClick ? (
                            <button type="button" onClick={r.onClick} className={cls}>
                                {inner}
                            </button>
                        ) : (
                            <div className={cls}>{inner}</div>
                        )}
                    </li>
                );
            })}
        </ul>
    </section>
);

/** "You" — digital ID card, account details and app links (v2-Profile). Route: /account */
export const ProfilePage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, signOut } = useAuthStore();
    const feedback = useFeedback();
    const [quota, setQuota] = useState<QuotaResponse | null>(null);
    const [quotaFailed, setQuotaFailed] = useState(false);

    useEffect(() => {
        getQuota()
            .then(setQuota)
            .catch(() => setQuotaFailed(true));
    }, []);

    if (!user) return null;

    const isStudent = user.user_type === 'STUDENT';
    const regId = isStudent ? extractStudentRegIdFromEmail(user.email) : null;

    const handleSignOut = () => {
        signOut();
        toast.success('Signed out');
        navigate('/auth/sign-in', { replace: true });
    };

    // A limit of 0 means the server has no quota rule for this role/direction, not "used up".
    const part = (label: string, q: { limit: number; remaining: number }) => (q.limit > 0 ? `${label} ${q.remaining} of ${q.limit} left` : `${label} no limit`);
    const quotaText = quota ? `${part('Out', quota.outbound)} · ${part('Back', quota.inbound)}` : quotaFailed ? 'Unavailable' : '…';
    const hasRideAccount = isStudent || user.user_type === 'EMPLOYEE';

    return (
        <div className="max-w-xl mx-auto w-full flex flex-col gap-4 pt-1">
            <header className="flex items-center gap-3">
                <button
                    type="button"
                    aria-label="Back"
                    onClick={() => (location.key !== 'default' ? navigate(-1) : navigate('/'))}
                    className="size-11 rounded-[14px] bg-card text-ink flex items-center justify-center shrink-0 focus-visible:outline-2 focus-visible:outline-iris"
                >
                    <ChevronLeft className="size-[22px]" strokeWidth={2.2} />
                </button>
                <h1 className="font-display font-extrabold text-xl text-ink">You</h1>
            </header>

            {/* Digital ID card */}
            <section aria-label={isStudent ? 'Digital student ID' : 'Digital ID'} className="bg-ink text-white rounded-3xl overflow-hidden">
                <div className="h-2.5 bg-volt" />
                <div className="p-[18px] flex gap-4 items-center">
                    <span aria-hidden="true" className="w-[84px] h-[104px] rounded-2xl bg-iris flex items-center justify-center font-display text-[30px] font-extrabold shrink-0">
                        {getInitials(user.name)}
                    </span>
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <span className="text-[11px] font-extrabold tracking-[0.1em] text-ink-muted">GIKI · {ROLE_LABEL[user.user_type] ?? user.user_type.replace(/_/g, ' ')}</span>
                        <span className="font-display text-[22px] font-extrabold tracking-[-0.02em] leading-[1.05] break-words">{user.name}</span>
                        {regId && <span className="font-mono text-sm font-semibold text-volt">{regId}</span>}
                        <span className="text-xs text-[#D9D6F2] break-all">{user.email}</span>
                    </div>
                </div>
                <div className="flex items-center justify-between gap-3 px-[18px] py-3 bg-ink-2">
                    <span className="flex items-center gap-1.5 text-xs font-extrabold text-volt">
                        <BadgeCheck className="size-4" aria-hidden="true" />
                        {isStudent ? 'Verified via GIKI email' : user.user_type === 'EMPLOYEE' ? 'Approved staff account' : 'Admin account'}
                    </span>
                    <Link to="/tickets" className="text-[13px] font-extrabold text-white rounded focus-visible:outline-2 focus-visible:outline-volt">
                        Show QR
                    </Link>
                </div>
            </section>

            <RowList
                title="ACCOUNT"
                rows={[
                    { label: 'Phone for JazzCash', value: <span className="font-mono">{maskPhone(user.phone_number)}</span> },
                    { label: 'Account type', value: user.user_type === 'EMPLOYEE' ? 'Faculty or staff' : user.user_type.charAt(0) + user.user_type.slice(1).toLowerCase().replace(/_/g, ' ') },
                    { label: 'Password', value: 'Reset by email', to: '/auth/forgot-password' },
                    ...(hasRideAccount ? [{ label: 'Weekly ride quota', value: quotaText, to: '/transport' }] : []),
                ]}
            />

            <RowList
                title="APP"
                rows={[
                    { label: 'Send feedback', onClick: feedback.openFeedback },
                    { label: 'About GIKI Wallet', to: '/about' },
                ]}
            />

            <button
                type="button"
                onClick={handleSignOut}
                className="h-[50px] rounded-2xl border-[1.5px] border-[#F2C4C6] bg-card text-coral text-[15px] font-extrabold flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-coral"
            >
                <LogOut className="size-[18px]" aria-hidden="true" />
                Sign out
            </button>

            <FeedbackModal isOpen={feedback.isOpen} onClose={feedback.closeFeedback} onSubmit={feedback.submitFeedback} isPending={feedback.isPending} />
        </div>
    );
};

export default ProfilePage;
