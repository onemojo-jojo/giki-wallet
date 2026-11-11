import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, MailX } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/shared/stores/authStore';
import { AuthScreen } from '../components/AuthScreen';
import { primaryBtn } from '../components/AuthField';

/** Landing page for the link in the verification email (/verify?token=… and /auth/verify?token=…). */
export const VerifyEmailPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { verifyAndLogin } = useAuthStore();
    const token = useMemo(() => (new URLSearchParams(location.search).get('token') || '').trim(), [location.search]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(!!token);
    const started = useRef(false);

    const verify = async () => {
        setBusy(true);
        setError(null);
        try {
            await verifyAndLogin(token);
            toast.success('Email verified. You are signed in.');
            navigate('/', { replace: true });
        } catch (e) {
            const raw = e instanceof Error ? e.message : '';
            // Never show a bare HTTP status to people.
            const msg = !raw || /status code/i.test(raw) ? 'This verification link is invalid or has expired.' : raw;
            setError(msg);
            setBusy(false);
        }
    };

    // Verify once on arrival (the ref also stops a second run under React StrictMode).
    useEffect(() => {
        if (!token || started.current) return;
        started.current = true;
        void verify();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    if (busy) {
        return (
            <AuthScreen className="items-center justify-center text-center">
                <Loader2 className="size-10 text-iris animate-spin" aria-hidden="true" />
                <h1 role="status" className="font-display font-extrabold text-[28px] tracking-[-0.03em]">
                    Verifying your email…
                </h1>
            </AuthScreen>
        );
    }

    return (
        <AuthScreen className="gap-5">
            <span aria-hidden="true" className="mt-16 self-center size-[120px] rounded-[40px] bg-coral-tint text-coral flex items-center justify-center">
                <MailX className="size-14" strokeWidth={1.8} />
            </span>
            <div className="flex flex-col gap-2 text-center" role="alert">
                <h1 className="font-display font-extrabold text-[30px] tracking-[-0.03em]">{token ? "We couldn't verify you" : 'This link is incomplete'}</h1>
                <p className="text-[15px] leading-normal text-[#4A4766]">
                    {token ? error : 'Open the verification link from your GIKI email again, or sign in if you have already verified.'}
                </p>
                {token && <p className="text-sm text-muted-foreground">Links expire after 24 hours. If yours has, sign up again with the same email.</p>}
            </div>
            <div className="mt-auto flex flex-col gap-3">
                {token && (
                    <button type="button" onClick={() => void verify()} className={primaryBtn}>
                        Try again
                    </button>
                )}
                <Link
                    to="/auth/sign-in"
                    replace
                    className="h-[50px] rounded-2xl border-[1.5px] border-[#D9D7E5] text-ink text-[15px] font-extrabold flex items-center justify-center focus-visible:outline-2 focus-visible:outline-iris"
                >
                    Go to sign in
                </Link>
            </div>
        </AuthScreen>
    );
};

export default VerifyEmailPage;
