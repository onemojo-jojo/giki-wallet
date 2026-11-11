import { Link } from 'react-router-dom';
import { Hourglass } from 'lucide-react';

/** Envelope illustration from v2-Verify. */
const Envelope = () => (
    <div aria-hidden="true" className="mt-6 self-center relative w-[168px] h-[140px]">
        <div className="absolute inset-[14px_8px_0] rounded-3xl bg-iris-tint" />
        <div className="absolute left-[30px] top-0 w-[108px] h-[84px] rounded-2xl bg-white border-2 border-ink flex flex-col gap-2 p-3.5">
            <span className="w-[60%] h-1.5 rounded-full bg-ink" />
            <span className="w-[90%] h-1.5 rounded-full bg-[#D9D7E5]" />
            <span className="w-11 h-[18px] rounded-md bg-iris" />
        </div>
        <svg width="168" height="140" viewBox="0 0 168 140" fill="none" className="absolute left-0 top-0">
            <path d="M8 66 84 112 160 66V128a8 8 0 0 1-8 8H16a8 8 0 0 1-8-8z" fill="#16133A" />
            <circle cx="146" cy="30" r="12" fill="#C8F04A" />
        </svg>
    </div>
);

/** Student after sign-up: verify the GIKI email (v2-Verify). */
export const CheckInbox = ({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) => (
    <>
        <Envelope />
        <div className="flex flex-col gap-2 text-center" role="status">
            <h1 className="font-display font-extrabold text-[30px] tracking-[-0.03em]">Check your GIKI inbox</h1>
            <p className="text-[15px] leading-normal text-[#4A4766]">
                We sent a verification link to
                <br />
                <strong className="text-ink break-all">{email}</strong>
            </p>
        </div>
        <ol className="mt-2 list-decimal bg-background rounded-[18px] py-4 pr-4 pl-9 flex flex-col gap-2.5 text-sm text-[#4A4766]">
            <li>Open Outlook on your GIKI account.</li>
            <li>
                Tap <strong className="text-ink">Verify my email</strong> in the message from GIKI Wallet.
            </li>
            <li>The link signs you in. You can also sign in here once you've verified.</li>
        </ol>
        <div className="mt-auto flex flex-col gap-3">
            <a
                href="https://outlook.office.com/mail/"
                target="_blank"
                rel="noopener noreferrer"
                className="h-14 rounded-[18px] bg-iris text-white flex items-center justify-center text-base font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
            >
                Open Outlook
            </a>
            <Link to="/auth/sign-in" replace className="h-12 flex items-center justify-center text-sm font-bold text-iris-strong rounded-xl focus-visible:outline-2 focus-visible:outline-iris">
                I've verified, sign in
            </Link>
            <p className="text-center text-[13px] text-muted-foreground">
                Wrong email?{' '}
                <button type="button" onClick={onChangeEmail} className="font-extrabold text-iris-strong hover:underline">
                    Change it
                </button>
            </p>
        </div>
    </>
);

/** Staff after sign-up: an admin has to approve the account first. */
export const AwaitingApproval = ({ email }: { email: string }) => (
    <>
        <span aria-hidden="true" className="mt-10 self-center size-[120px] rounded-[40px] bg-signal-tint text-[#B35F00] flex items-center justify-center">
            <Hourglass className="size-14" strokeWidth={1.8} />
        </span>
        <div className="flex flex-col gap-2 text-center" role="status">
            <h1 className="font-display font-extrabold text-[30px] tracking-[-0.03em]">Account created</h1>
            <p className="text-[15px] leading-normal text-[#4A4766]">
                An admin approves new staff accounts. Once yours is approved, sign in with
                <br />
                <strong className="text-ink break-all">{email}</strong>
            </p>
        </div>
        <div className="mt-auto flex flex-col gap-3">
            <Link
                to="/auth/sign-in"
                replace
                className="h-14 rounded-[18px] bg-iris text-white flex items-center justify-center text-base font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris"
            >
                Go to sign in
            </Link>
            <Link to="/" className="h-12 flex items-center justify-center text-sm font-bold text-iris-strong rounded-xl focus-visible:outline-2 focus-visible:outline-iris">
                Back to home
            </Link>
        </div>
    </>
);
