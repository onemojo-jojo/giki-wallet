import { create } from 'zustand';
import { useAuthStore } from '@/shared/stores/authStore';
import {
    getWeeklySummary,
    getQuota,
    getActiveHolds,
    releaseAllActiveHolds,
    holdSeats,
    confirmBatch,
    getUserTickets,
    cancelTicket,
} from './api';
import type {
    Trip,
    QuotaResponse,
    ActiveHold,
    HoldSeatsResponse,
    BookingSelection,
    BookingDraft,
    Passenger,
    MyTicket,
} from './validators';
import { bookingSelectionSchema } from './validators';
import { getGIKIStopObject } from './utils';
import { getErrorMessage, logError, AppError } from '@/lib/errors';
import { toast } from 'sonner';

// ============================================================================
// STATE INTERFACE
// ============================================================================

interface TransportState {
    // Data
    allTrips: Trip[];
    quota: QuotaResponse | null;
    activeHolds: ActiveHold[];
    myTickets: MyTicket[];
    loading: boolean;
    initialized: boolean;
    error: string | null;

    // Booking Flow
    direction: 'OUTBOUND' | 'INBOUND';
    isRoundTrip: boolean; // Feature 2: Round Trip Toggle
    outboundSelection: BookingSelection | null;
    returnSelection: BookingSelection | null;
    passengers: Record<string, Passenger>;

    // Senior UX: Drafts for form re-hydration
    draftOutbound: BookingDraft;
    draftInbound: BookingDraft;

    // Actions
    fetchData: (showLoading?: boolean) => Promise<void>;
    releaseAllHolds: () => Promise<void>;
    setDirection: (d: 'OUTBOUND' | 'INBOUND') => void;
    setRoundTrip: (enabled: boolean) => void;
    updatePassenger: (holdId: string, passenger: Passenger) => void;
    resetBookingFlow: () => void;
    addSelection: (selection: BookingSelection) => Promise<void>;
    updateDraft: (direction: 'OUTBOUND' | 'INBOUND', draft: Partial<BookingDraft>) => void;
    confirmBooking: (confirmations: Array<{ holdId: string; passengerName: string; passengerRelation: string }>) => Promise<void>;
    fetchUserTickets: () => Promise<void>;
    /** Resolves true when the ticket was cancelled (errors are shown as toasts). */
    cancelTicket: (ticketId: string) => Promise<boolean>;
    canProceed: () => boolean;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useTransportStore = create<TransportState>((set, get) => ({
    // Initial State
    allTrips: [],
    quota: null,
    activeHolds: [],
    myTickets: [],
    loading: false,
    initialized: false,
    error: null,
    direction: 'OUTBOUND', // Default to Outbound (from GIKI)
    isRoundTrip: false,
    outboundSelection: null,
    returnSelection: null,
    passengers: {},
    draftOutbound: { ticketCount: 1 },
    draftInbound: { ticketCount: 1 },

    // ========================================================================
    // ACTIONS
    // ========================================================================

    setRoundTrip: (enabled) => {
        const { activeHolds, releaseAllHolds } = get();
        if (enabled && activeHolds.length > 0) {
            toast.error('Please release active reservations before enabling Round Trip mode');
            return;
        }

        // Feature: If turning OFF, reset to OUTBOUND to avoid being "stuck" in a hidden return leg
        if (!enabled) {
            set({ direction: 'OUTBOUND' });
        }

        set({ isRoundTrip: enabled });
    },

    setDirection: (direction) => {
        set({ direction });
    },

    updatePassenger: (holdId: string, passenger: Passenger) => set((state: TransportState) => ({
        passengers: { ...state.passengers, [holdId]: passenger }
    })),

    resetBookingFlow: () => {
        set({
            outboundSelection: null,
            returnSelection: null,
            passengers: {},
            draftOutbound: { ticketCount: 1 },
            draftInbound: { ticketCount: 1 },
        });
    },

    updateDraft: (direction: 'OUTBOUND' | 'INBOUND', draft: Partial<BookingDraft>) => {
        if (direction === 'OUTBOUND') {
            set((state: TransportState) => ({ draftOutbound: { ...state.draftOutbound, ...draft } }));
        } else {
            set((state: TransportState) => ({ draftInbound: { ...state.draftInbound, ...draft } }));
        }
    },

    // ========================================================================
    // DATA FETCHING
    // ========================================================================

    fetchData: async (showLoading = true) => {
        if (showLoading) set({ loading: true });
        try {
            const [tripsData, quotaData, holdsData] = await Promise.all([
                getWeeklySummary(),
                getQuota(),
                getActiveHolds()
            ]);

            const user = useAuthStore.getState().user;
            const role = user?.user_type.toUpperCase();

            const filteredTrips = (tripsData || []).filter(trip => {
                // Filtering Logic (Case-Insensitive):
                // 1. Admins see everything.
                // 2. Students see ONLY 'STUDENT' buses.
                // 3. Employees see ONLY 'EMPLOYEE' buses.
                const busType = trip.bus_type.toUpperCase();
                if (role === 'STUDENT' && busType !== 'STUDENT') return false;
                if (role === 'EMPLOYEE' && busType !== 'EMPLOYEE') return false;

                return true;
            });

            set({
                allTrips: filteredTrips,
                quota: quotaData,
                activeHolds: holdsData,
                initialized: true,
                error: null
            });
        } catch (e) {
            const msg = getErrorMessage(e);
            set({ error: msg });
            toast.error(msg);
            if (e instanceof AppError) {
                logError(e, { action: 'fetchData' });
            }
        } finally {
            if (showLoading) set({ loading: false });
        }
    },

    fetchUserTickets: async () => {
        // Don't set global loading since this might be refreshed independently
        try {
            const tickets = await getUserTickets();
            set({ myTickets: tickets });
        } catch (e) {
            console.error('Failed to fetch tickets', e);
            // Silent fail or toast? Toast for now
            // toast.error('Failed to update tickets'); 
        }
    },

    releaseAllHolds: async () => {
        set({ loading: true });
        try {
            await releaseAllActiveHolds();
            await get().fetchData(false);
            get().resetBookingFlow();
            toast.success('Reservations released');
        } catch (e) {
            const msg = getErrorMessage(e);
            toast.error(msg);
            if (e instanceof AppError) {
                logError(e, { action: 'releaseAllHolds' });
            }
        } finally {
            set({ loading: false });
        }
    },

    // ========================================================================
    // BOOKING FLOW
    // ========================================================================

    addSelection: async (selection: BookingSelection) => {
        const parseResult = bookingSelectionSchema.safeParse(selection);
        if (!parseResult.success) {
            toast.error('Invalid booking selection');
            return;
        }

        // Infer direction from the booking selection BEFORE try block
        // OUTBOUND: pickup from GIKI, INBOUND: dropoff at GIKI
        const trip = get().allTrips.find(t => t.id === selection.tripId);
        if (!trip) {
            toast.error('Trip not found');
            return;
        }
        const gikiStop = getGIKIStopObject(trip.stops || []);
        const direction: 'OUTBOUND' | 'INBOUND' = gikiStop && selection.pickupId === gikiStop.stop_id 
            ? 'OUTBOUND' 
            : 'INBOUND';

        set({ loading: true });
        try {

            // Validate pickup/dropoff based on inferred direction
            if (direction === 'OUTBOUND' && gikiStop && selection.pickupId !== gikiStop.stop_id) {
                toast.error('Outbound trips must pick up from GIKI');
                set({ loading: false });
                return;
            }

            if (direction === 'INBOUND' && gikiStop && selection.dropoffId !== gikiStop.stop_id) {
                toast.error('Inbound trips must drop off at GIKI');
                set({ loading: false });
                return;
            }

            const resp = await holdSeats({
                trip_id: selection.tripId,
                count: selection.ticketCount,
                pickup_stop_id: selection.pickupId,
                dropoff_stop_id: selection.dropoffId,
            });

            await get().fetchData(false);

            const user = useAuthStore.getState().user;
            const newPassengers: Record<string, Passenger> = {};
            resp.holds.forEach(h => {
                newPassengers[h.hold_id] = {
                    name: '',
                    relation: 'GUEST' as const
                };
            });

            if (resp.holds.length > 0) {
                const currentData = get();
                const currentTripHolds = currentData.activeHolds.filter(h => h.trip_id === selection.tripId);
                const existingSelfOnTrip = currentTripHolds.some(h =>
                    currentData.passengers[h.id]?.relation === 'SELF'
                );

                if (!existingSelfOnTrip) {
                    newPassengers[resp.holds[0].hold_id] = {
                        name: user?.name || '',
                        relation: 'SELF'
                    };
                }
            }

            const { isRoundTrip } = get();

            if (direction === 'OUTBOUND') {
                const alreadySelectedReturn = !!get().returnSelection;
                set(state => ({
                    outboundSelection: selection,
                    draftOutbound: selection, // Sync draft on success
                    passengers: { ...state.passengers, ...newPassengers },
                    direction: (isRoundTrip && !alreadySelectedReturn) ? 'INBOUND' : 'OUTBOUND'
                }));
                if (isRoundTrip && !alreadySelectedReturn) {
                    toast.success('Outbound seat held! Now select Return trip.');
                }
            } else {
                const alreadySelectedOutbound = !!get().outboundSelection;
                set(state => ({
                    returnSelection: selection,
                    draftInbound: selection, // Sync draft on success
                    passengers: { ...state.passengers, ...newPassengers },
                    direction: (isRoundTrip && !alreadySelectedOutbound) ? 'OUTBOUND' : 'INBOUND'
                }));
                if (isRoundTrip && !alreadySelectedOutbound) {
                    toast.success('Return seat held! Now select Outbound trip.');
                }
            }
        } catch (e) {
            const { isRoundTrip, activeHolds, releaseAllHolds } = get();

            // Use inferred direction (not store state)
            if (isRoundTrip && direction === 'INBOUND' && activeHolds.length > 0) {
                toast.error("Return trip is sold out", {
                    description: "You still have your Outbound seat held.",
                    action: {
                        label: "Release Outbound",
                        onClick: () => {
                            void releaseAllHolds();
                        }
                    },
                    cancel: {
                        label: "Keep It",
                        onClick: () => {
                            set({ isRoundTrip: false, direction: 'OUTBOUND' });
                            toast.success("Switched to One-Way trip");
                        }
                    },
                    duration: 10000,
                });
            } else {
                const msg = getErrorMessage(e);
                toast.error(msg);
            }

            if (e instanceof AppError) {
                logError(e, { action: 'addSelection', tripId: selection.tripId });
            }
        } finally {
            set({ loading: false });
        }
    },

    confirmBooking: async (confirmations) => {
        if (confirmations.length === 0) return;

        set({ loading: true });
        try {
            const apiConfirmations = confirmations.map(h => ({
                hold_id: h.holdId,
                passenger_name: h.passengerName,
                passenger_relation: h.passengerRelation as 'SELF' | 'SPOUSE' | 'CHILD' | 'PARENT' | 'GUEST'
            }));

            // OPTIMISTIC UPDATE: Calculate counts to update quota locally
            const { activeHolds, quota } = get();
            const outboundCount = confirmations.filter(c =>
                activeHolds.find(h => h.id === c.holdId)?.direction === 'OUTBOUND'
            ).length;
            const inboundCount = confirmations.filter(c =>
                activeHolds.find(h => h.id === c.holdId)?.direction === 'INBOUND'
            ).length;

            await confirmBatch({ confirmations: apiConfirmations });

            if (quota) {
                set({
                    quota: {
                        outbound: {
                            ...quota.outbound,
                            used: quota.outbound.used + outboundCount,
                            remaining: Math.max(0, quota.outbound.remaining - outboundCount),
                        },
                        inbound: {
                            ...quota.inbound,
                            used: quota.inbound.used + inboundCount,
                            remaining: Math.max(0, quota.inbound.remaining - inboundCount),
                        }
                    }
                });
            }

            await get().fetchData(false);

            toast.success('Booking confirmed!');
            get().resetBookingFlow();
        } catch (e) {
            const msg = getErrorMessage(e);
            toast.error(msg);
            if (e instanceof AppError) {
                logError(e, { action: 'confirmBooking', count: confirmations.length });
            }
            throw e;
        } finally {
            set({ loading: false });
        }
    },

    cancelTicket: async (ticketId: string) => {
        set({ loading: true });
        try {
            await cancelTicket(ticketId);
        } catch (e) {
            // Refresh either way so is_cancellable / status reflect the server.
            void get().fetchUserTickets();
            set({ loading: false });
            if (e instanceof AppError) {
                if (e.statusCode === 400) {

                    if (e.code === 'CANCELLATION_CLOSED' || e.message.includes('closed')) {
                        toast.error("Too late to cancel!", {
                            description: "The bus is departing soon or booking window has closed."
                        });
                        return false;
                    }
                }
                logError(e, { action: 'cancelTicket', ticketId });
            }
            const msg = getErrorMessage(e);
            toast.error(msg);
            return false;
        }
        toast.success('Ticket cancelled successfully');
        try {
            await get().fetchUserTickets();
            await get().fetchData(false); // Update quota/seats if necessary
        } catch {
            /* the cancel itself succeeded; a failed refresh shouldn't report an error */
        } finally {
            set({ loading: false });
        }
        return true;
    },

    canProceed: () => {
        const { isRoundTrip, outboundSelection, returnSelection } = get();
        if (isRoundTrip) {
            return !!(outboundSelection && returnSelection);
        }
        return !!(outboundSelection || returnSelection);
    },
}));
