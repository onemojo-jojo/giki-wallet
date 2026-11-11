import { Link } from 'react-router-dom';
import { ChevronRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ABOUT_LINK, CAMPUS_SERVICES, type CampusService } from '../services';

const ServiceCard = ({ service }: { service: CampusService }) => {
    const Icon = service.icon;
    const body = (
        <>
            <span className={cn('size-11 rounded-[14px] flex items-center justify-center', service.tone)}>
                <Icon className="size-[22px]" strokeWidth={1.9} aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-0.5">
                <span className="text-[15px] font-extrabold text-ink">{service.name}</span>
                <span className="text-xs text-muted-foreground">{service.description}</span>
            </span>
            {service.status === 'live' ? (
                <span className="self-start text-[11px] font-extrabold text-mint bg-mint-tint px-2.5 py-0.5 rounded-full">
                    Open
                </span>
            ) : (
                <span className="self-start text-[11px] font-extrabold text-[#4A4766] bg-secondary px-2.5 py-0.5 rounded-full">
                    Coming soon
                </span>
            )}
        </>
    );

    const className = 'bg-card rounded-[20px] p-3.5 flex flex-col gap-2.5 text-left';

    if (service.status === 'live' && service.to) {
        return (
            <Link
                to={service.to}
                className={cn(className, 'transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-iris')}
            >
                {body}
            </Link>
        );
    }

    return (
        <div className={className}>
            {body}
        </div>
    );
};

export const CampusPage = () => {
    const AboutIcon = ABOUT_LINK.icon;

    return (
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-5 pt-1">
            <header className="flex flex-col gap-1.5">
                <h1 className="font-display font-extrabold text-[32px] tracking-tight text-ink leading-none">Campus</h1>
                <p className="text-sm text-muted-foreground">One balance for everything on campus.</p>
            </header>

            {CAMPUS_SERVICES.some((s) => s.status === 'soon') && (
                <div role="note" className="flex items-center gap-2.5 bg-iris-tint text-[#2E1A99] rounded-[14px] px-3.5 py-2.5 text-[13px] font-bold">
                    <Info className="size-[18px] shrink-0" aria-hidden="true" />
                    {CAMPUS_SERVICES.filter((s) => s.status === 'soon')
                        .map((s) => s.name)
                        .join(' and ')}{' '}
                    are coming soon to G-Bux.
                </div>
            )}

            <section aria-labelledby="campus-services" className="flex flex-col gap-2.5">
                <h2 id="campus-services" className="font-display font-bold text-xl text-ink">
                    Pay on campus
                </h2>
                <div className="grid grid-cols-2 gap-2.5">
                    {CAMPUS_SERVICES.map((service) => (
                        <ServiceCard key={service.key} service={service} />
                    ))}
                </div>
            </section>

            <Link
                to={ABOUT_LINK.to}
                className="flex items-center gap-3 bg-card rounded-[20px] px-4 py-3.5 hover:shadow-md transition-shadow focus-visible:outline-2 focus-visible:outline-iris"
            >
                <span className="size-10 rounded-xl bg-secondary text-ink flex items-center justify-center">
                    <AboutIcon className="size-5" aria-hidden="true" />
                </span>
                <span className="flex-1 flex flex-col">
                    <span className="text-[15px] font-bold text-ink">{ABOUT_LINK.name}</span>
                    <span className="text-xs text-muted-foreground">{ABOUT_LINK.description}</span>
                </span>
                <ChevronRight className="size-5 text-light-gray" aria-hidden="true" />
            </Link>
        </div>
    );
};

export default CampusPage;
