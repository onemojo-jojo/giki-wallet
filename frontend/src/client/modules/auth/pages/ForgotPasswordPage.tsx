import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MailCheck } from 'lucide-react';
import { toast } from '@/lib/toast';
import { requestPasswordReset } from '@/shared/modules/auth/api';
import { AuthBack, AuthScreen, AuthTitle } from '../components/AuthScreen';
import { AuthField, primaryBtn } from '../components/AuthField';
import { GIKI_DOMAIN, toEmail } from '../authHelpers';

type ApiError = { response?: { data?: { message?: string } } };

/** Ask for a password-reset link (same API as before, v2 look). */
export const ForgotPasswordPage = () => {
    const [user, setUser] = useState('');
    const [error, setError] = useState<string>();
    const [sentTo, setSentTo] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const email = toEmail(user);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError(user ? 'Please enter a valid email address' : 'Enter your email');
            return;
        }
        setError(undefined);
        setLoading(true);
        try {
            await requestPasswordReset(email);
            setSentTo(email);
            toast.success('Reset link sent to your email');
        } catch (err) {
            toast.error((err as ApiError).response?.data?.message || 'Failed to send reset link');
        } finally {
            setLoading(false);
        }
    };

    if (sentTo) {
        return (
            <AuthScreen className="gap-5">
                <AuthBack fallback="/auth/sign-in" />
                <span aria-hidden="true" className="mt-6 self-center size-[120px] rounded-[40px] bg-iris-tint text-iris-strong flex items-center justify-center">
                    <MailCheck className="size-14" strokeWidth={1.8} />
                </span>
                <div className="flex flex-col gap-2 text-center" role="status">
                    <h1 className="font-display font-extrabold text-[30px] tracking-[-0.03em]">Check your email</h1>
                    <p className="text-[15px] leading-normal text-[#4A4766]">
                        If an account exists for <strong className="text-ink break-all">{sentTo}</strong>, we've sent a link to set a new password.
                    </p>
                </div>
                <div className="mt-auto flex flex-col gap-3">
                    <Link
                        to="/auth/sign-in"
                        className="h-14 rounded-[18px] bg-iris text-white flex items-center justify-center text-base font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                    >
                        Back to sign in
                    </Link>
                    <button type="button" onClick={() => setSentTo(null)} className="h-12 text-sm font-bold text-iris-strong rounded-xl focus-visible:outline-2 focus-visible:outline-iris">
                        Use a different email
                    </button>
                </div>
            </AuthScreen>
        );
    }

    return (
        <AuthScreen>
            <AuthBack fallback="/auth/sign-in" />
            <AuthTitle title="Forgot password?" sub="Enter your email and we'll send you a link to set a new one." />
            <form id="forgot" onSubmit={onSubmit} noValidate>
                <AuthField
                    label="Email"
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="u2023XXXX"
                    value={user}
                    onChange={(e) => {
                        setUser(e.target.value.trim());
                        setError(undefined);
                    }}
                    suffix={user.includes('@') ? undefined : GIKI_DOMAIN}
                    error={error}
                />
            </form>
            <div className="mt-auto flex flex-col gap-3.5">
                <button type="submit" form="forgot" disabled={loading} className={primaryBtn}>
                    {loading && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
                    {loading ? 'Sending…' : 'Send reset link'}
                </button>
                <Link to="/auth/sign-in" className="text-center text-sm font-bold text-iris-strong hover:underline">
                    Back to sign in
                </Link>
            </div>
        </AuthScreen>
    );
};

export default ForgotPasswordPage;
