import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { WalletPage } from '@/client/modules/wallet/pages/WalletPage';
import { ServiceTiles } from '@/client/components/ServiceTiles';
import { useAuthStore } from '@/shared/stores/authStore';
// import { TripSummaryTile } from '../components/TripSummaryTile'; // Removed - simplified UX

export const HomePage = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const openTransport = useCallback(() => {
        navigate('/transport');
    }, [navigate]);

    return (
        <div className="space-y-6">
            {user && (
                <div className="mt-6">
                    <WalletPage />
                </div>
            )}
            {/* TripSummaryTile removed for simplified UX - users can go directly to booking page */}
            <ServiceTiles onTransportClick={openTransport} />
        </div>
    );
};

