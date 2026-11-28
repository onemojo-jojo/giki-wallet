import { create } from 'zustand';
import { Route, RouteTemplateResponse, TripResponse } from './types';
import { TripService } from './service';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/errors';

interface TripCreateState {
    // Data
    routes: Route[];
    template: RouteTemplateResponse | null;
    trips: TripResponse[];

    // UI State
    isLoadingRoutes: boolean;
    isLoadingTemplate: boolean;
    isLoadingTrips: boolean;
    isSubmitting: boolean;
    isDeletingTrip: boolean;

    // Edit / Duplicate State
    editingTrip: TripResponse | null;
    duplicateTemplate: TripResponse | null;

    // Actions
    fetchRoutes: () => Promise<void>;
    fetchTrips: (startDate?: Date, endDate?: Date) => Promise<void>;
    selectRoute: (routeId: string) => Promise<void>;
    resetTemplate: () => void;

    // Edit Actions
    setEditingTrip: (trip: TripResponse | null) => void;
    setDuplicateTemplate: (trip: TripResponse | null) => void;

    createTrip: (payload: any) => Promise<boolean>;
    updateTrip: (tripId: string, payload: any) => Promise<boolean>;
    deleteTrip: (tripId: string) => Promise<boolean>;
    updateTripManualStatus: (tripId: string, manualStatus: string | null) => Promise<boolean>;
    batchUpdateTripManualStatus: (tripIds: string[], manualStatus: string) => Promise<boolean>;
    cancelTrip: (tripId: string) => Promise<boolean>;
}

export const useTripCreateStore = create<TripCreateState>((set, get) => ({
    routes: [],
    template: null,
    trips: [],
    editingTrip: null,
    duplicateTemplate: null,
    isLoadingRoutes: false,
    isLoadingTemplate: false,
    isLoadingTrips: false,
    isSubmitting: false,
    isDeletingTrip: false,

    setEditingTrip: (trip) => {
        set({ editingTrip: trip, duplicateTemplate: null });
        if (trip) {
            // Also fetch the template for this route so we have stops etc
            get().selectRoute(trip.route_id);
        }
    },

    setDuplicateTemplate: (trip) => {
        set({ duplicateTemplate: trip, editingTrip: null });
        if (trip) {
            get().selectRoute(trip.route_id);
        }
    },

    fetchRoutes: async () => {
        set({ isLoadingRoutes: true });
        try {
            const routes = await TripService.getAllRoutes();
            set({ routes });
        } catch (error) {
            console.error(error);
            toast.error('Failed to load routes');
        } finally {
            set({ isLoadingRoutes: false });
        }
    },

    fetchTrips: async (startDate?: Date, endDate?: Date) => {
        set({ isLoadingTrips: true });
        try {
            const trips = await TripService.getAllTrips(startDate, endDate);
            set({ trips });
        } catch (error) {
            console.error(error);
            toast.error('Failed to load trips');
        } finally {
            set({ isLoadingTrips: false });
        }
    },


    selectRoute: async (routeId: string) => {
        set({ isLoadingTemplate: true, template: null });
        try {
            const template = await TripService.getRouteTemplate(routeId);
            set({ template });
        } catch (error) {
            console.error(error);
            toast.error('Failed to load route template');
        } finally {
            set({ isLoadingTemplate: false });
        }
    },

    resetTemplate: () => {
        set({ template: null });
    },

    createTrip: async (payload) => {
        set({ isSubmitting: true });
        try {
            await TripService.createTrip(payload);
            toast.success("Trip created successfully!");
            get().fetchTrips(); // Refresh list after creation
            return true;
        } catch (error: unknown) {
            console.error(error);
            toast.error(getErrorMessage(error) || "Failed to create trip");
            return false;
        } finally {
            set({ isSubmitting: false });
        }
    },

    updateTrip: async (tripId, payload) => {
        set({ isSubmitting: true });
        try {
            await TripService.updateTrip(tripId, payload);
            toast.success("Trip updated successfully!");
            get().fetchTrips(); // Refresh list after update
            return true;
        } catch (error: unknown) {
            console.error(error);
            toast.error(getErrorMessage(error) || "Failed to update trip");
            return false;
        } finally {
            set({ isSubmitting: false });
        }
    },

    deleteTrip: async (tripId: string) => {
        set({ isDeletingTrip: true });
        try {
            await TripService.deleteTrip(tripId);
            toast.success("Trip deleted successfully!");
            get().fetchTrips(); // Refresh list after deletion
            return true;
        } catch (error: unknown) {
            console.error(error);
            toast.error(getErrorMessage(error) || "Failed to delete trip");
            return false;
        } finally {
            set({ isDeletingTrip: false });
        }
    },

    updateTripManualStatus: async (tripId: string, manualStatus: string | null) => {
        try {
            await TripService.updateTripManualStatus(tripId, manualStatus);
            toast.success("Trip status updated!");
            get().fetchTrips(); // Refresh list
            return true;
        } catch (error: unknown) {
            console.error(error);
            toast.error(getErrorMessage(error) || "Failed to update trip status");
            return false;
        }
    },

    batchUpdateTripManualStatus: async (tripIds: string[], manualStatus: string) => {
        try {
            await TripService.batchUpdateTripManualStatus(tripIds, manualStatus);
            toast.success(`${tripIds.length} trip(s) updated!`);
            get().fetchTrips(); // Refresh list
            return true;
        } catch (error: unknown) {
            console.error(error);
            toast.error(getErrorMessage(error) || "Failed to update trips");
            return false;
        }
    },

    cancelTrip: async (tripId: string) => {
        try {
            await TripService.cancelTrip(tripId);
            toast.success("Trip cancelled and refunds processed!");
            get().fetchTrips(); // Refresh list
            return true;
        } catch (error: unknown) {
            console.error(error);
            toast.error(getErrorMessage(error) || "Failed to cancel trip");
            return false;
        }
    },
}));
