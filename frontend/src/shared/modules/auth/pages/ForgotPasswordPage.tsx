import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/Input';
import { toast } from '@/lib/toast';
import { getErrorMessage } from '@/lib/errors';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '../validators';
import { requestPasswordReset } from '../api';

export const ForgotPasswordPage = () => {
    const [isEmailSent, setIsEmailSent] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ForgotPasswordFormData>({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: { email: '' },
    });

    const onSubmit = async (data: ForgotPasswordFormData) => {
        setIsLoading(true);
        try {
            await requestPasswordReset(data.email.trim());
            setIsEmailSent(true);
            toast.success('Reset link sent to your email');
        } catch (e: unknown) {
            toast.error(getErrorMessage(e) || 'Failed to send reset link');
        } finally {
            setIsLoading(false);
        }
    };

    if (isEmailSent) {
        return (
            <div className="max-w-md mx-auto">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8 text-center">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
                    <p className="text-gray-600 mb-8">
                        We've sent a password reset link to your email address. Please follow the instructions to set a new password.
                    </p>
                    <Link to="/auth/sign-in">
                        <Button className="w-full">Return to Sign In</Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
                <div className="space-y-2 mb-6 text-center">
                    <h1 className="text-2xl font-bold text-gray-900">Forgot Password?</h1>
                    <p className="text-sm text-gray-600">
                        No worries, we'll send you reset instructions.
                    </p>
                </div>

                <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                    <Input
                        label="Email"
                        type="email"
                        placeholder="you@giki.edu.pk"
                        {...register('email')}
                        error={errors.email?.message}
                    />

                    <Button className="w-full font-semibold" disabled={isLoading} type="submit">
                        {isLoading ? 'Sending...' : 'Send Reset Link'}
                    </Button>

                    <div className="text-center mt-4">
                        <Link className="text-sm text-gray-600 hover:text-primary" to="/auth/sign-in">
                            Back to Sign In
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};
