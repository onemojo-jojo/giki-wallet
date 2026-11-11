import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Github, Globe, Heart, Instagram, Lightbulb, Linkedin, Users, type LucideIcon } from 'lucide-react';
import { LogoMark } from '@/shared/components/ui/Logo';

type Socials = { linkedin: string; github: string; instagram: string; blog: string };

const teamMembers: { name: string; socials: Socials }[] = [
    {
        name: 'Muhammad Taimoor',
        socials: {
            linkedin: 'https://www.linkedin.com/in/m-taimoor-dev/',
            github: 'https://github.com/muhammadtaimoor9583',
            instagram: '#',
            blog: '#',
        },
    },
    {
        name: 'Junaid Saleem',
        socials: {
            linkedin: 'https://www.linkedin.com/in/junaid-saleem/',
            github: 'https://github.com/JunaidSalim',
            instagram: '#',
            blog: '#',
        },
    },
    {
        name: 'Muneeb Bin Nasir',
        socials: {
            linkedin: 'https://www.linkedin.com/in/muneebbinnasir/',
            github: '',
            instagram: '#',
            blog: '#',
        },
    },
];

const creatorSocials: Socials = {
    linkedin: 'https://linkedin.com/in/hamzaxfaraz',
    github: 'https://github.com/hash-walker',
    instagram: 'https://instagram.com/hash.walker',
    blog: 'https://hash-walker.github.io/blog',
};

const SOCIAL_ICONS: { key: keyof Socials; label: string; icon: LucideIcon }[] = [
    { key: 'linkedin', label: 'LinkedIn', icon: Linkedin },
    { key: 'github', label: 'GitHub', icon: Github },
    { key: 'instagram', label: 'Instagram', icon: Instagram },
    { key: 'blog', label: 'Website', icon: Globe },
];

/** Only real links are shown (placeholders like "#" are skipped). */
const SocialLinks = ({ name, socials, tone = 'light' }: { name: string; socials: Socials; tone?: 'light' | 'dark' }) => (
    <div className="flex items-center gap-2">
        {SOCIAL_ICONS.filter((s) => /^https?:\/\//.test(socials[s.key].trim())).map(({ key, label, icon: Icon }) => (
            <a
                key={key}
                href={socials[key].trim()}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${name} on ${label}`}
                className={
                    tone === 'dark'
                        ? 'size-10 rounded-xl bg-ink-2 text-white hover:text-volt flex items-center justify-center focus-visible:outline-2 focus-visible:outline-volt'
                        : 'size-10 rounded-xl bg-background text-ink hover:text-iris flex items-center justify-center focus-visible:outline-2 focus-visible:outline-iris'
                }
            >
                <Icon className="size-[18px]" aria-hidden="true" />
            </a>
        ))}
    </div>
);

/** About GIKI Wallet — same story and people as before, in the v2 style. */
const AboutPage = () => {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <div className="max-w-xl mx-auto w-full flex flex-col gap-4 pt-1 pb-6">
            <header className="flex items-center gap-3">
                <button
                    type="button"
                    aria-label="Back"
                    onClick={() => (location.key !== 'default' ? navigate(-1) : navigate('/campus'))}
                    className="size-11 rounded-[14px] bg-card text-ink flex items-center justify-center shrink-0 focus-visible:outline-2 focus-visible:outline-iris"
                >
                    <ChevronLeft className="size-[22px]" strokeWidth={2.2} />
                </button>
                <span className="font-display font-extrabold text-xl text-ink">About</span>
            </header>

            <section className="bg-ink text-white rounded-3xl p-6 flex flex-col gap-4">
                <LogoMark size={44} tone="volt" />
                <h1 className="font-display font-extrabold text-[38px] leading-[1] tracking-[-0.03em]">
                    Built for GIKI,
                    <br />
                    <span className="text-volt">by GIKIans.</span>
                </h1>
                <p className="text-[15px] leading-relaxed text-[#D9D6F2]">
                    GIKI Wallet started as a simple idea: how can we make daily campus life better? Today, it's a tool that serves the student community, making every transaction and booking effortless.
                </p>
            </section>

            <div className="grid md:grid-cols-2 gap-3">
                <section className="bg-card rounded-[22px] p-5 flex flex-col gap-2.5">
                    <span className="size-11 rounded-[14px] bg-iris-tint text-iris-strong flex items-center justify-center">
                        <Users className="size-[22px]" aria-hidden="true" />
                    </span>
                    <h2 className="font-display text-lg font-extrabold text-ink">Impact 3,000+ People</h2>
                    <p className="text-sm leading-relaxed text-[#4A4766]">
                        When you build something for GIKI, your code doesn't just sit in a repo—it's used by more than 3,000 students and staff around you. That's the power of solving local problems.
                    </p>
                </section>
                <section className="bg-card rounded-[22px] p-5 flex flex-col gap-2.5">
                    <span className="size-11 rounded-[14px] bg-signal-tint text-signal-text flex items-center justify-center">
                        <Lightbulb className="size-[22px]" aria-hidden="true" />
                    </span>
                    <h2 className="font-display text-lg font-extrabold text-ink">Start Building</h2>
                    <p className="text-sm leading-relaxed text-[#4A4766]">
                        Don't wait for a grand opportunity. Look at the small frictions in your daily life on campus and build a solution. GIKI Wallet is proof that one student's initiative can become a campus standard.
                    </p>
                </section>
            </div>

            <section aria-labelledby="creator" className="bg-card rounded-[22px] p-5 flex flex-col sm:flex-row gap-4 sm:items-center">
                <img src="/hamza.jpeg" alt="Hamza Faraz" className="size-24 rounded-2xl object-cover shrink-0" />
                <div className="flex flex-col gap-2">
                    <div>
                        <h2 id="creator" className="font-display text-xl font-extrabold text-ink">
                            Hamza Faraz
                        </h2>
                        <p className="text-sm font-bold text-iris-strong">President Microsoft Club GIKI</p>
                    </div>
                    <p className="text-sm leading-relaxed text-[#4A4766]">
                        Passionate about building software that actually helps people. GIKI Wallet is my contribution to making our campus life smarter and more connected.
                    </p>
                    <SocialLinks name="Hamza Faraz" socials={creatorSocials} />
                </div>
            </section>

            <section aria-labelledby="team" className="flex flex-col gap-2">
                <h2 id="team" className="px-1 flex items-center gap-1.5 text-xs font-extrabold tracking-[0.08em] text-muted-foreground">
                    MADE WITH <Heart className="size-3 fill-coral text-coral" role="img" aria-label="love" /> IN GIK INSTITUTE
                </h2>
                <ul className="bg-card rounded-[20px] px-4">
                    {teamMembers.map((m, i) => (
                        <li key={m.name} className={`flex items-center justify-between gap-3 py-3 ${i ? 'border-t border-[#F0EFF5]' : ''}`}>
                            <span className="text-[15px] font-bold text-ink">{m.name}</span>
                            <SocialLinks name={m.name} socials={m.socials} />
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
};

export default AboutPage;
