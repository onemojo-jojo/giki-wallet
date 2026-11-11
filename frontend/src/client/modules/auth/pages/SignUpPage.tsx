import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Briefcase, GraduationCap, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/shared/stores/authStore';
import { signUpSchema, type SignUpFormData } from '@/shared/modules/auth/validators';
import { extractStudentRegIdFromEmail } from '@/shared/modules/auth/utils';
import { AuthBack, AuthProgress, AuthScreen, AuthTitle } from '../components/AuthScreen';
import { AuthField, primaryBtn } from '../components/AuthField';
import { CheckInbox, AwaitingApproval } from '../components/AfterSignUp';
import { emailFromRegNo } from '../authHelpers';

type Step = 1 | 2 | 3;

/** Create account in three steps (v2-SignUp → details → v2-Verify). */
export const SignUpPage = () => {
    const { registerUser, isLoading } = useAuthStore();
    const [step, setStep] = useState<Step>(1);
    const [regNo, setRegNo] = useState('');
    const [nameError, setNameError] = useState<string>();
    const [createdEmail, setCreatedEmail] = useState('');
    // The email we filled in from the reg no (so a corrected reg no can update it).
    const [autoEmail, setAutoEmail] = useState('');

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        getValues,
        control,
        formState: { errors, isSubmitting },
    } = useForm<SignUpFormData>({
        resolver: zodResolver(signUpSchema),
        mode: 'onTouched',
        reValidateMode: 'onChange',
        defaultValues: { userType: 'STUDENT', name: '', email: '', phoneNumber: '', password: '', confirmPassword: '' },
    });

    const userType = useWatch({ control, name: 'userType' });
    const email = useWatch({ control, name: 'email' });
    const isStudent = userType === 'STUDENT';
    const studentRegId = isStudent ? extractStudentRegIdFromEmail(email ?? '') : null;

    const continueFromStep1 = () => {
        if (!getValues('name')?.trim()) {
            setNameError('Full name is required');
            return;
        }
        setNameError(undefined);
        // Fill the email from the registration number, unless the user has typed their own.
        const current = getValues('email');
        if (isStudent && regNo.trim() && (!current || current === autoEmail)) {
            const filled = emailFromRegNo(regNo);
            setValue('email', filled);
            setAutoEmail(filled);
        }
        setStep(2);
    };

    // After an account is created, a different email means a new sign-up (the first account stays unverified).
    const startOver = () => {
        reset();
        setRegNo('');
        setAutoEmail('');
        setCreatedEmail('');
        setStep(1);
    };

    const onSubmit = async (data: SignUpFormData) => {
        const regId = data.userType === 'STUDENT' ? extractStudentRegIdFromEmail(data.email) : '';
        if (data.userType === 'STUDENT' && !regId) {
            toast.error('Student email must look like u2022661@giki.edu.pk');
            return;
        }
        try {
            await registerUser({
                name: (data.name || '').trim(),
                email: data.email.trim(),
                phone_number: data.phoneNumber.trim(),
                password: data.password,
                user_type: data.userType,
                reg_id: regId || '',
            });
            if (data.userType === 'STUDENT') {
                toast.success('Account created. Please check your email to verify, then sign in.');
            } else {
                toast.success('Account created. Your account may require approval before you can sign in.');
            }
            setCreatedEmail(data.email.trim());
            setStep(3);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Sign up failed. Please try again.');
        }
    };

    const roleCard = (value: 'STUDENT' | 'EMPLOYEE', title: string, text: string, Icon: typeof GraduationCap) => {
        const selected = userType === value;
        return (
            <label
                className={cn(
                    'flex gap-3.5 items-start rounded-[20px] p-4 cursor-pointer',
                    selected ? 'border-2 border-iris bg-[#F6F4FF]' : 'border-[1.5px] border-[#D9D7E5] bg-white'
                )}
            >
                <span className={cn('size-12 rounded-2xl flex items-center justify-center shrink-0', selected ? 'bg-iris text-white' : 'bg-background text-ink')}>
                    <Icon className="size-6" aria-hidden="true" />
                </span>
                <span className="flex-1 flex flex-col gap-1">
                    <span className="text-[17px] font-extrabold">{title}</span>
                    <span className="text-[13px] leading-[1.45] text-[#4A4766]">{text}</span>
                </span>
                <input
                    type="radio"
                    name="role"
                    checked={selected}
                    onChange={() => setValue('userType', value, { shouldValidate: step === 2 })}
                    className="size-[22px] accent-iris mt-0.5 shrink-0"
                />
            </label>
        );
    };

    const header = (
        <div className="flex items-center gap-3.5">
            {step === 1 ? <AuthBack /> : step === 2 ? <AuthBack onClick={() => setStep(1)} /> : <AuthBack fallback="/auth/sign-in" />}
            <AuthProgress step={step} />
        </div>
    );

    if (step === 3) {
        return (
            <AuthScreen className="gap-5">
                {header}
                {isStudent ? <CheckInbox email={createdEmail} onChangeEmail={startOver} /> : <AwaitingApproval email={createdEmail} />}
            </AuthScreen>
        );
    }

    return (
        <AuthScreen className="gap-5">
            {header}

            {step === 1 ? (
                <form
                    noValidate
                    className="flex-1 flex flex-col gap-5"
                    onSubmit={(e) => {
                        e.preventDefault();
                        continueFromStep1();
                    }}
                >
                    <AuthTitle title="Who are you at GIKI?" sub="This decides which buses you see and how many seats you can book." />
                    <fieldset className="flex flex-col gap-3">
                        <legend className="sr-only">Account type</legend>
                        {roleCard('STUDENT', 'Student', 'Student buses, 1 seat per trip. Ready right after you verify your email.', GraduationCap)}
                        {roleCard('EMPLOYEE', 'Faculty or staff', 'Employee buses, book for your family too. An admin approves new staff accounts.', Briefcase)}
                    </fieldset>
                    <div className="flex flex-col gap-3.5">
                        <AuthField
                            label="Full name"
                            autoComplete="name"
                            placeholder={isStudent ? 'As on your student card' : 'As on your staff card'}
                            {...register('name', { onChange: () => setNameError(undefined) })}
                            error={nameError}
                        />
                        {isStudent && (
                            <AuthField
                                label="Registration number"
                                inputMode="numeric"
                                placeholder="2023XXXX"
                                mono
                                value={regNo}
                                onChange={(e) => setRegNo(e.target.value)}
                                hint="We'll use it to fill in your GIKI email."
                            />
                        )}
                    </div>
                    <button type="submit" className={cn(primaryBtn, 'mt-auto')}>
                        Continue
                    </button>
                </form>
            ) : (
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex-1 flex flex-col gap-5">
                    <AuthTitle title="Your account" sub={isStudent ? 'We’ll send a verification link to your GIKI email.' : 'Use your work email. An admin approves staff accounts.'} />
                    {errors.userType?.message && (
                        <p role="alert" className="rounded-2xl bg-coral-tint px-4 py-3 text-sm font-semibold text-[#8F1B21]">
                            {errors.userType.message}.{' '}
                            <button type="button" onClick={() => setStep(1)} className="underline font-extrabold">
                                Change account type
                            </button>
                        </p>
                    )}
                    <div className="flex flex-col gap-3.5">
                        <AuthField
                            label="Email"
                            type="email"
                            autoComplete="email"
                            autoCapitalize="none"
                            spellCheck={false}
                            placeholder={isStudent ? 'u2023XXXX@giki.edu.pk' : 'name@giki.edu.pk'}
                            {...register('email')}
                            error={errors.email?.message}
                            hint={isStudent ? `Reg ID: ${studentRegId ?? '—'} (from your email)` : undefined}
                        />
                        <AuthField label="Phone number" type="tel" autoComplete="tel" placeholder="03XXXXXXXXX" mono {...register('phoneNumber')} error={errors.phoneNumber?.message} />
                        <AuthField label="Password" type="password" autoComplete="new-password" placeholder="Create a password" {...register('password')} error={errors.password?.message} />
                        <AuthField
                            label="Confirm password"
                            type="password"
                            autoComplete="new-password"
                            placeholder="Type it again"
                            {...register('confirmPassword')}
                            error={errors.confirmPassword?.message}
                        />
                    </div>
                    <div className="mt-auto flex flex-col gap-3.5">
                        <button type="submit" disabled={isLoading || isSubmitting} className={primaryBtn}>
                            {(isLoading || isSubmitting) && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
                            {isLoading || isSubmitting ? 'Creating account…' : 'Create account'}
                        </button>
                        <p className="text-center text-sm text-muted-foreground">
                            Already have an account?{' '}
                            <Link to="/auth/sign-in" className="font-extrabold text-iris-strong hover:underline">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </form>
            )}
        </AuthScreen>
    );
};

export default SignUpPage;
