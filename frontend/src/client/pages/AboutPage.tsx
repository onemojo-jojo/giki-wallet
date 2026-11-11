import React from 'react';
import { Github, Linkedin, Instagram, Globe, Code2, Users, Lightbulb, Heart } from 'lucide-react';

const teamMembers = [
    {
        name: "Muhammad Taimoor",
        socials: {
            linkedin: "https://www.linkedin.com/in/m-taimoor-dev/",
            github: "https://github.com/muhammadtaimoor9583",
            instagram: "#",
            blog: "#"
        }
    },
    {
        name: "Junaid Saleem",
        socials: {
            linkedin: "https://www.linkedin.com/in/junaid-saleem/",
            github: "https://github.com/JunaidSalim ",
            instagram: "#",
            blog: "#"
        }
    },
    {
        name: "Muneeb Bin Nasir",
        socials: {
            linkedin: "https://www.linkedin.com/in/muneebbinnasir/",
            github: "",
            instagram: "#",
            blog: "#"
        }
    }
];

const AboutPage = () => {
    return (
        <div className="max-w-3xl mx-auto px-6 py-12 space-y-16 mb-20">
            {/* Simple Hero Section */}
            <div className="space-y-4 text-center md:text-left">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
                    Built for GIKI, <br />
                    <span className="text-primary tracking-normal font-medium">by GIKIans.</span>
                </h1>
                <p className="text-lg text-gray-600 max-w-2xl leading-relaxed">
                    GIKI Wallet started as a simple idea: how can we make daily campus life better? Today, it's a tool that serves the student community, making every transaction and booking effortless.
                </p>
            </div>

            {/* Motivation Section - Simple Cards */}
            <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div className="w-10 h-10 bg-blue-50 text-primary rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">Impact 3,000+ People</h3>
                    <p className="text-gray-600 leading-relaxed">
                        When you build something for GIKI, your code doesn't just sit in a repo—it's used by more than 3,000 students and staff around you. That's the power of solving local problems.
                    </p>
                </div>
                <div className="space-y-4">
                    <div className="w-10 h-10 bg-blue-50 text-primary rounded-lg flex items-center justify-center">
                        <Lightbulb className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">Start Building</h3>
                    <p className="text-gray-600 leading-relaxed">
                        Don't wait for a grand opportunity. Look at the small frictions in your daily life on campus and build a solution. GIKI Wallet is proof that one student's initiative can become a campus standard.
                    </p>
                </div>
            </div>

            {/* Creator Profile - Clean & Minimal */}
            <div className="pt-8 border-t border-gray-100">
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="shrink-0">
                        <img
                            src="/hamza.jpeg"
                            alt="HamzaFaraz"
                            className="w-32 h-32 rounded-2xl object-cover shadow-sm grayscale hover:grayscale-0 transition-all duration-500"
                        />
                    </div>
                    <div className="space-y-4 text-center md:text-left">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-bold text-gray-900">Hamza Faraz</h2>
                            <p className="text-primary font-medium">President Microsoft Club GIKI</p>
                        </div>
                        <p className="text-gray-600 max-w-md">
                            Passionate about building software that actually helps people. GIKI Wallet is my contribution to making our campus life smarter and more connected.
                        </p>

                        {/* Simple Social Links */}
                        <div className="flex items-center justify-center md:justify-start gap-5">
                            <SimpleSocialLink icon={Linkedin} href="https://linkedin.com/in/hamzaxfaraz" />
                            <SimpleSocialLink icon={Github} href="https://github.com/hash-walker" />
                            <SimpleSocialLink icon={Instagram} href="https://instagram.com/hash.walker" />
                            <SimpleSocialLink icon={Globe} href="https://hash-walker.github.io/blog" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Tag */}
            <div className="text-center pt-8 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-400 mb-8">
                    MADE WITH <Heart className="w-3 h-3 inline fill-current text-red-400" /> IN GIK INSTITUTE
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-12 gap-x-8 max-w-2xl mx-auto">
                    {teamMembers.map((member) => (
                        <div key={member.name} className="space-y-4 group">
                            <p className="text-sm font-semibold text-gray-900 group-hover:text-primary transition-colors duration-200">
                                {member.name}
                            </p>
                            <div className="flex items-center justify-center gap-6 sm:gap-4">
                                <SimpleSocialLink icon={Linkedin} href={member.socials.linkedin} />
                                <SimpleSocialLink icon={Github} href={member.socials.github} />
                                <SimpleSocialLink icon={Instagram} href={member.socials.instagram} />
                                <SimpleSocialLink icon={Globe} href={member.socials.blog} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const SimpleSocialLink = ({ icon: Icon, href }: { icon: any, href: string }) => (
    <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-400 hover:text-primary transition-colors duration-200"
    >
        <Icon className="w-5 h-5" />
    </a>
);

export default AboutPage;
