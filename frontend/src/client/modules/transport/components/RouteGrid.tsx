import { useMemo } from 'react';
import { RouteCard } from './RouteCard';
import { useAuthStore } from '@/shared/stores/authStore';
import { useTransportStore } from '../store';
import type { Trip } from '../validators';
import type { BookingSelection } from '../validators';
import { getGIKIStopObject } from '../utils';
import { toast } from 'sonner';

interface RouteGridProps {
    direction: 'OUTBOUND' | 'INBOUND';
    onBook?: (selection: BookingSelection) => void;
}

export const RouteGrid = ({ direction, onBook }: RouteGridProps) => {
    const { user } = useAuthStore();
    const { allTrips, activeHolds, quota, isRoundTrip } = useTransportStore();

    const isStudent = user?.user_type === 'STUDENT';

    // Group trips by route
    const routeGroups = useMemo(() => {
        const groups = new Map<string, { routeName: string; routeId: string; trips: Trip[] }>();

        // STRICT filtering: direction AND exclude cancelled/deleted trips
        const targetDirection = direction.toUpperCase().trim();

        allTrips
            .filter(trip => {
                const tripDirection = trip.direction.toUpperCase().trim();
                const tripStatus = trip.status.toUpperCase().trim();

                // Only show trips matching direction AND not cancelled/deleted
                return tripDirection === targetDirection
                    && tripStatus !== 'CANCELLED'
                    && tripStatus !== 'DELETED';
            })
            .forEach(trip => {
                // Use composite key: route_id + direction to prevent mixing
                const key = `${trip.route_id}_${trip.direction}`;

                if (!groups.has(key)) {
                    groups.set(key, {
                        routeName: trip.route_name,
                        routeId: trip.route_id,
                        trips: []
                    });
                }
                groups.get(key)!.trips.push(trip);
            });

        // Sort trips by departure time within each route
        groups.forEach(group => {
            group.trips.sort((a, b) =>
                new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime()
            );
        });

        return Array.from(groups.values());
    }, [allTrips, direction]);

    const handleBook = (tripId: string, stopId: string, ticketCount: number) => {
        const trip = allTrips.find(t => t.id === tripId);
        if (!trip) {
            toast.error('Trip not found');
            return;
        }

        const gikiStop = getGIKIStopObject(trip.stops);
        if (!gikiStop) {
            toast.error('GIKI Stop not found');
            return;
        }

        const payload: BookingSelection = {
            tripId,
            pickupId: direction === 'OUTBOUND' ? gikiStop.stop_id : stopId,
            dropoffId: direction === 'OUTBOUND' ? stopId : gikiStop.stop_id,
            ticketCount,
        };

        onBook?.(payload);
    };

    const directionQuota = direction === 'OUTBOUND'
        ? (quota?.outbound ?? null)
        : (quota?.inbound ?? null);

    if (routeGroups.length === 0) {
        return (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                <p className="text-gray-500 font-medium">
                    No {direction === 'OUTBOUND' ? 'outbound' : 'return'} trips available this week
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {routeGroups.map(({ routeName, routeId, trips }) => (
                <RouteCard
                    key={routeId}
                    routeName={routeName}
                    routeId={routeId}
                    direction={direction}
                    trips={trips}
                    activeHolds={activeHolds}
                    isStudent={isStudent}
                    quota={directionQuota}
                    isRoundTrip={isRoundTrip}
                    onBook={handleBook}
                    defaultExpanded={routeGroups.length === 1}
                />
            ))}
        </div>
    );
};
