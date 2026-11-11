import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, TriangleAlert } from 'lucide-react';
import { toast } from '@/lib/toast';
import { resetPassword } from '@/shared/modules/auth/api';
import { resetPasswordSchema, type ResetPasswordFormData } from '@/shared/modules/auth/validators';
import { AuthBack, AuthScreen, AuthTitle } from '../components/AuthScreen';
import { AuthField, primaryBtn } from '../components/AuthField';

type ApiError = { response?: { data?: { message?: string } } };

/** Set a new password from the emailed link (/auth/reset-password and /reset-password). */
export const ResetPasswordPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const token = searchParams.get('token');

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ResetPasswordFormData>({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: { password: '', confirmPassword: '' },
    });

    const onSubmit = async (data: ResetPasswordFormData) => {
        if (!token) return;
        setLoading(true);
        try {
            await resetPassword({ token, password: data.password });
            toast.success('Password reset successfully');
            navigate('/auth/sign-in', { replace: true });
        } catch (e) {
            toast.error((e as ApiError).response?.data?.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <AuthScreen className="gap-5">
                <span aria-hidden="true" className="mt-16 self-center size-[120px] rounded-[40px] bg-signal-tint text-[#B35F00] flex items-center justify-center">
                    <TriangleAlert className="size-14" strokeWidth={1.8} />
                </span>
                <div className="flex flex-col gap-2 text-center" role="alert">
                    <h1 className="font-display font-extrabold text-[30px] tracking-[-0.03em]">Invalid link</h1>
                    <p className="text-[15px] leading-normal text-[#4A4766]">The password reset link is invalid or has expired. Please request a new one.</p>
                </div>
                <Link
                    to="/auth/forgot-password"
                    className="mt-auto h-14 rounded-[18px] bg-iris text-white flex items-center justify-center text-base font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
                >
                    Request a new link
                </Link>
            </AuthScreen>
        );
    }

    return (
        <AuthScreen>
            <AuthBack fallback="/auth/sign-in" />
            <AuthTitle title="Set a new password" sub="At least 8 characters." />
            <form id="reset" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                <AuthField label="New password" type="password" autoComplete="new-password" placeholder="At least 8 characters" {...register('password')} error={errors.password?.message} />
                <AuthField label="Confirm new password" type="password" autoComplete="new-password" placeholder="Type it again" {...register('confirmPassword')} error={errors.confirmPassword?.message} />
            </form>
            <button type="submit" form="reset" disabled={loading} className={`${primaryBtn} mt-auto`}>
                {loading && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
                {loading ? 'Saving…' : 'Save new password'}
            </button>
        </AuthScreen>
    );
};

export default ResetPasswordPage;
