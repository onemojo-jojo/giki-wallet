import { useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/shared/stores/authStore';
import { AuthBack, AuthScreen, AuthTitle } from '../components/AuthScreen';
import { AuthField, primaryBtn } from '../components/AuthField';
import { GIKI_DOMAIN, toEmail } from '../authHelpers';

/** Student / staff sign in (v2-SignIn). Admin keeps its own page at /admin/signin. */
export const SignInPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, isLoading } = useAuthStore();
    const [user, setUser] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});

    // Same redirect rules as before: protected page → ?redirect= → home.
    const redirectTo = useMemo(() => {
        const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
        if (from) return from;
        const q = new URLSearchParams(location.search).get('redirect');
        return q || '/';
    }, [location.search, location.state]);

    const typedFullEmail = user.includes('@');

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const email = toEmail(user);
        const next: typeof errors = {};
        if (!user.trim()) next.email = 'Enter your GIKI email';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Please enter a valid email address';
        if (!password) next.password = 'Enter your password';
        setErrors(next);
        if (next.email || next.password) return;

        try {
            await login({ email, password });
            toast.success('Signed in');
            navigate(redirectTo, { replace: true });
        } catch (err) {
            const raw = err instanceof Error ? err.message : '';
            // Never show a bare HTTP status to people.
            const msg = !raw || /status code/i.test(raw) ? (/40[13]/.test(raw) ? 'Wrong email or password.' : 'Sign in failed. Please try again.') : raw;
            setErrors({ form: msg });
            toast.error(msg);
        }
    };

    return (
        <AuthScreen>
            <AuthBack />
            <AuthTitle title="Welcome back" sub="Sign in with your GIKI email." />

            <form id="sign-in" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
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
                        setErrors((x) => ({ ...x, email: undefined, form: undefined }));
                    }}
                    suffix={typedFullEmail ? undefined : GIKI_DOMAIN}
                    error={errors.email}
                />
                <AuthField
                    label="Password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => {
                        setPassword(e.target.value);
                        setErrors((x) => ({ ...x, password: undefined, form: undefined }));
                    }}
                    error={errors.password}
                />
                <Link to="/auth/forgot-password" className="self-end py-2 text-sm font-bold text-iris-strong hover:underline rounded focus-visible:outline-2 focus-visible:outline-iris">
                    Forgot password?
                </Link>
                {errors.form && (
                    <p role="alert" className="rounded-2xl bg-coral-tint px-4 py-3 text-sm font-semibold text-[#8F1B21]">
                        {errors.form}
                    </p>
                )}
            </form>

            <div className="mt-auto flex flex-col gap-3.5">
                <button type="submit" form="sign-in" disabled={isLoading} className={primaryBtn}>
                    {isLoading && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
                    {isLoading ? 'Signing in…' : 'Sign in'}
                </button>
                <p className="text-center text-sm text-muted-foreground">
                    New here?{' '}
                    <Link to="/auth/sign-up" className="font-extrabold text-iris-strong hover:underline">
                        Create an account
                    </Link>
                </p>
            </div>
        </AuthScreen>
    );
};

export default SignInPage;
