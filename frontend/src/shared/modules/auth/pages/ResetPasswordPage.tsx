import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/Input';
import { toast } from '@/lib/toast';
import { getErrorMessage } from '@/lib/errors';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, type ResetPasswordFormData } from '../validators';
import { resetPassword } from '../api';

export const ResetPasswordPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
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
        if (!token) {
            toast.error('Invalid or missing reset token');
            return;
        }

        setIsLoading(true);
        try {
            await resetPassword({
                token,
                password: data.password,
            });
            toast.success('Password reset successfully');
            navigate('/auth/sign-in', { replace: true });
        } catch (e: unknown) {
            toast.error(getErrorMessage(e) || 'Failed to reset password');
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="max-w-md mx-auto">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8 text-center">
                    <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.268 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
                    <p className="text-gray-600 mb-8">
                        The password reset link is invalid or has expired. Please request a new one.
                    </p>
                    <Link to="/auth/forgot-password">
                        <Button className="w-full">Request New Link</Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
                <div className="space-y-2 mb-6 text-center">
                    <h1 className="text-2xl font-bold text-gray-900">Set New Password</h1>
                    <p className="text-sm text-gray-600">
                        Please enter your new password below.
                    </p>
                </div>

                <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                    <Input
                        label="New Password"
                        type="password"
                        placeholder="At least 8 characters"
                        {...register('password')}
                        error={errors.password?.message}
                    />
                    <Input
                        label="Confirm New Password"
                        type="password"
                        placeholder="Repeat your password"
                        {...register('confirmPassword')}
                        error={errors.confirmPassword?.message}
                    />

                    <Button className="w-full font-semibold" disabled={isLoading} type="submit">
                        {isLoading ? 'Resetting...' : 'Reset Password'}
                    </Button>
                </form>
            </div>
        </div>
    );
};
