import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { CAMPUS_SERVICES } from '@/client/modules/campus/services';

/** "On campus" row on Home — one tile per campus service (live or coming soon). */
export const CampusShortcuts = () => (
    <section aria-labelledby="home-campus" className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
            <h2 id="home-campus" className="font-display font-bold text-xl text-ink">
                On campus
            </h2>
            <Link to="/campus" className="text-[13px] font-extrabold text-iris-strong hover:underline">
                See all
            </Link>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {CAMPUS_SERVICES.map((s) => {
                const Icon = s.icon;
                return (
                    <Link
                        key={s.key}
                        to={s.status === 'live' && s.to ? s.to : '/campus'}
                        className="flex flex-col items-center gap-1.5 rounded-2xl py-1 focus-visible:outline-2 focus-visible:outline-iris"
                    >
                        <span className={cn('size-16 rounded-[20px] flex items-center justify-center', s.tone)}>
                            <Icon className="size-6" aria-hidden="true" />
                        </span>
                        <span className="text-xs font-bold text-ink text-center leading-tight">{s.name}</span>
                        {s.status === 'soon' && <span className="text-[10px] font-bold text-muted-foreground -mt-1">Soon</span>}
                    </Link>
                );
            })}
        </div>
    </section>
);
