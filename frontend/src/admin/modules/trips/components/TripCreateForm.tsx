import { useEffect } from 'react';
import { useForm, FormProvider, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addMinutes, parse, format, differenceInMinutes } from 'date-fns';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { useTripCreateStore } from '../store';
import { createTripSchema, CreateTripFormValues } from '../schema';
import { Button } from '@/shared/components/ui/button';
import { Select } from '@/shared/components/ui/Select';
import { RouteScheduleSection } from './RouteScheduleSection';
import { CapacityPricingSection } from './CapacityPricingSection';
import { StopsSelectionSection } from './StopsSelectionSection';
import { BookingWindowSection } from './BookingWindowSection';

export const TripCreateForm = ({ onSuccess }: { onSuccess?: () => void }) => {
    const {
        routes,
        template,
        editingTrip,
        duplicateTemplate,
        isLoadingRoutes,
        isSubmitting,
        fetchRoutes,
        selectRoute,
        createTrip,
        updateTrip,
        setEditingTrip,
        setDuplicateTemplate
    } = useTripCreateStore();

    const methods = useForm<CreateTripFormValues>({
        resolver: zodResolver(createTripSchema),
        defaultValues: {
            totalCapacity: 0,
            basePrice: 0,
            selectedStopIds: [],
            date: new Date(),
            time: "08:00",
            bookingOpenDate: new Date(),
            bookingOpenTime: "08:00",
            bookingCloseDate: new Date(),
            bookingCloseTime: "08:00",
            busType: "STUDENT",
            direction: "OUTBOUND"
        },
    });

    const {
        handleSubmit,
        setValue,
        reset,
        watch
    } = methods;

    const watchedBusType = watch('busType');

    // --- HELPERS ---

    const applyTemplateRules = (tmpl: any) => {
        if (!tmpl) return;

        // Calculate default booking times from offset hours
        const currentDate = methods.getValues('date') || new Date();
        const currentTime = methods.getValues('time') || '08:00';
        const departureDateTime = parse(currentTime, 'HH:mm', currentDate);

        // Booking opens X minutes before departure
        const bookingOpenDateTime = addMinutes(departureDateTime, -tmpl.rules.open_minutes_before);
        setValue('bookingOpenDate', bookingOpenDateTime);
        setValue('bookingOpenTime', formatInTimeZone(bookingOpenDateTime, 'Asia/Karachi', 'HH:mm'));

        // Booking closes X minutes before departure
        const bookingCloseDateTime = addMinutes(departureDateTime, -tmpl.rules.close_minutes_before);
        setValue('bookingCloseDate', bookingCloseDateTime);
        setValue('bookingCloseTime', formatInTimeZone(bookingCloseDateTime, 'Asia/Karachi', 'HH:mm'));

        // Auto-detect direction
        const stops = tmpl.stops;
        if (stops.length >= 2) {
            const firstStop = stops[0].name.toUpperCase();
            const lastStop = stops[stops.length - 1].name.toUpperCase();

            if (firstStop.includes("GIKI")) {
                setValue('direction', 'OUTBOUND');
            } else if (lastStop.includes("GIKI")) {
                setValue('direction', 'INBOUND');
            } else {
                const name = tmpl.route_name.toUpperCase();
                if (name.startsWith("GIKI")) {
                    setValue('direction', 'OUTBOUND');
                } else {
                    setValue('direction', 'INBOUND');
                }
            }
        } else {
            setValue('direction', 'OUTBOUND');
        }

        // Auto-select active stops
        const activeStopIds = tmpl.stops
            .filter((s: any) => s.is_active)
            .map((s: any) => s.stop_id);
        setValue('selectedStopIds', activeStopIds);
    };

    const applySourceTrip = (sourceTrip: any, tmpl: any, isDuplicate: boolean) => {
        if (!sourceTrip || !tmpl) return;

        // Pre-fill from existing trip
        setValue('routeId', sourceTrip.route_id);
        setValue('busType', sourceTrip.bus_type as any);
        setValue('basePrice', sourceTrip.base_price);
        setValue('totalCapacity', sourceTrip.total_capacity);
        setValue('direction', sourceTrip.direction as any);

        // Stops
        const stopIds = sourceTrip.stops.map((s: any) => s.stop_id);
        setValue('selectedStopIds', stopIds);

        // Dates & Times
        let departure: Date;
        if (!isDuplicate) {
            // Edit Mode
            departure = new Date(sourceTrip.departure_time);
        } else {
            // Duplicate Mode: Use current date + source time
            departure = new Date();
            const sourceTime = new Date(sourceTrip.departure_time);
            departure.setHours(sourceTime.getHours(), sourceTime.getMinutes());
        }

        setValue('date', departure);
        setValue('time', format(departure, 'HH:mm'));

        // Booking Windows (Deduced from Offsets)
        // logic: New Departure - (Old Departure - Old Open)
        const sourceDeparture = new Date(sourceTrip.departure_time);
        const sourceOpen = new Date(sourceTrip.booking_opens_at);
        const sourceClose = new Date(sourceTrip.booking_closes_at);

        const openOffset = differenceInMinutes(sourceDeparture, sourceOpen);
        const closeOffset = differenceInMinutes(sourceDeparture, sourceClose);

        const newOpen = addMinutes(departure, -openOffset);
        const newClose = addMinutes(departure, -closeOffset);

        setValue('bookingOpenDate', newOpen);
        setValue('bookingOpenTime', format(newOpen, 'HH:mm'));
        setValue('bookingCloseDate', newClose);
        setValue('bookingCloseTime', format(newClose, 'HH:mm'));
    };


    // --- EFFECTS ---

    // 1. Initial Load & Edit/Duplicate Population
    useEffect(() => {
        const init = async () => {
            // Load Routes first
            await fetchRoutes();

            const source = editingTrip || duplicateTemplate;
            if (source) {
                await selectRoute(source.route_id);
                const currentTemplate = useTripCreateStore.getState().template;

                applySourceTrip(source, currentTemplate, !!duplicateTemplate);
            }
        };

        init();
    }, []);


    const watchedCapacity = watch('totalCapacity');
    const soldTickets = editingTrip ? (editingTrip.total_capacity - editingTrip.available_seats) : 0;
    const isEditMode = !!editingTrip;

    const handleRouteChange = async (routeId: string) => {
        await selectRoute(routeId);
        setValue('routeId', routeId);

        const newTemplate = useTripCreateStore.getState().template;
        if (newTemplate) {
            applyTemplateRules(newTemplate);
        }
    };

    const onSubmit: SubmitHandler<CreateTripFormValues> = async (values) => {
        // Combine Date + Time for departure (Using proper timezone handling)
        const dateStr = format(values.date, 'yyyy-MM-dd');
        const departureDateTime = fromZonedTime(`${dateStr} ${values.time}`, 'Asia/Karachi');

        // Combine Date + Time for booking window (Using proper timezone handling)
        const bookingOpenDateStr = format(values.bookingOpenDate, 'yyyy-MM-dd');
        const bookingOpenDateTime = fromZonedTime(`${bookingOpenDateStr} ${values.bookingOpenTime}`, 'Asia/Karachi');

        const bookingCloseDateStr = format(values.bookingCloseDate, 'yyyy-MM-dd');
        const bookingCloseDateTime = fromZonedTime(`${bookingCloseDateStr} ${values.bookingCloseTime}`, 'Asia/Karachi');

        // Calculate offset in minutes (minutes before departure) — no rounding needed
        const openOffsetMinutes = differenceInMinutes(departureDateTime, bookingOpenDateTime);
        const closeOffsetMinutes = differenceInMinutes(departureDateTime, bookingCloseDateTime);



        // Validation: Capacity cannot be less than sold tickets
        if (editingTrip) {
            const sold = editingTrip.total_capacity - editingTrip.available_seats;
            if (values.totalCapacity < sold) {
                methods.setError('totalCapacity', {
                    type: 'manual',
                    message: `Capacity cannot be less than sold tickets (${sold})`
                });
                return;
            }
        }

        const payload = {
            route_id: values.routeId,
            departure_time: departureDateTime.toISOString(),
            booking_open_offset_minutes: openOffsetMinutes,
            booking_close_offset_minutes: closeOffsetMinutes,
            total_capacity: values.totalCapacity,
            base_price: values.basePrice,
            bus_type: values.busType,
            direction: values.direction,
            stops: values.selectedStopIds.map(id => ({ stop_id: id }))
        };

        if (editingTrip) {
            const success = await updateTrip(editingTrip.id, payload);
            if (success) {
                onSuccess?.();
            }
        } else {
            const success = await createTrip(payload);
            if (success) {
                if (duplicateTemplate) {
                    onSuccess?.();
                    setDuplicateTemplate(null);
                }
                reset();
            }
        }
    };

    return (
        <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-4xl mx-auto p-6 bg-white border rounded-xl shadow-sm">

                {isEditMode && (
                    <div
                        className="bg-amber-50 p-3 rounded-md border border-amber-200 text-sm text-amber-900"
                        role="note"
                    >
                        <span className="font-semibold">Route, direction, and stops are fixed for this trip.</span>{' '}
                        To change them, cancel and create a new trip instead.
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* --- LEFT COLUMN: Route & Schedule --- */}
                    <div className="space-y-6">
                        <RouteScheduleSection
                            routes={routes}
                            isLoadingRoutes={isLoadingRoutes}
                            quickSlots={template?.quick_slots}
                            onRouteSelect={handleRouteChange}
                            disabled={isEditMode}
                        />
                    </div>

                    {/* --- RIGHT COLUMN: Booking Window, Capacity & Stops --- */}
                    <div className="space-y-6">
                        {template && (
                            <>
                                <BookingWindowSection />
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Bus Type</label>
                                    <Controller
                                        name="busType"
                                        control={methods.control}
                                        render={({ field }) => (
                                            <Select
                                                options={[
                                                    { value: 'STUDENT', label: 'Student' },
                                                    { value: 'EMPLOYEE', label: 'Employee' }
                                                ]}
                                                value={field.value}
                                                onChange={field.onChange}
                                                placeholder="Select Bus Type"
                                                showLabel={false}
                                            />
                                        )}
                                    />
                                    {methods.formState.errors.busType && (
                                        <p className="text-xs text-red-500 mt-1">{methods.formState.errors.busType.message}</p>
                                    )}
                                </div>
                                <div>
                                    <CapacityPricingSection />
                                    {watchedCapacity < soldTickets && (
                                        <p className="text-red-600 text-xs mt-1 font-medium animate-pulse">
                                            ⚠️ Warning: Capacity ({watchedCapacity}) is less than sold tickets ({soldTickets}).
                                        </p>
                                    )}
                                </div>
                                <StopsSelectionSection stops={template.stops} disabled={isEditMode} />
                            </>
                        )}
                    </div>
                </div>

                <div className="flex justify-end pt-6 border-t gap-3">
                    {onSuccess && (
                        <Button type="button" variant="ghost" onClick={onSuccess}>
                            Cancel
                        </Button>
                    )}
                    <Button type="submit" disabled={isSubmitting || !template} size="lg">
                        {isSubmitting ? (editingTrip ? "Updating..." : "Creating...") : (editingTrip ? "Update Trip" : "Create Trip")}
                    </Button>
                </div>
            </form>
        </FormProvider>
    );
};
