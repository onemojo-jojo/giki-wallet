import { FooterCopyright } from './footer/index';

export const Footer = () => {

    return (
        <footer className="mt-auto relative overflow-hidden bg-footer-bg text-white">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/30 rounded-full blur-3xl -mr-32 -mt-32"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl -ml-32 -mb-32"></div>
            </div>

            <FooterCopyright />
        </footer>
    );
};
