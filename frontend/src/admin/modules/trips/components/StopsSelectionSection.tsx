import { useFormContext, Controller } from 'react-hook-form';
import { ArrowRight } from 'lucide-react';
import { CreateTripFormValues } from '../schema';
import { StopItem } from '../types';

interface StopsSelectionSectionProps {
    stops: StopItem[];
    disabled?: boolean;
}

export const StopsSelectionSection = ({ stops, disabled }: StopsSelectionSectionProps) => {
    const { control, formState: { errors } } = useFormContext<CreateTripFormValues>();

    return (
        <div className={disabled ? "border rounded-md p-4 mt-4 bg-gray-50 opacity-90" : "border rounded-md p-4 mt-4 bg-gray-50"}>
            <h4 className="font-medium mb-3 flex items-center gap-2 text-sm text-gray-900">
                <ArrowRight className="h-4 w-4" />
                Stops Selection
            </h4>
            <Controller
                control={control}
                name="selectedStopIds"
                render={({ field }) => (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                        {stops
                            .sort((a, b) => a.sequence - b.sequence)
                            .map((item) => (
                                <div
                                    key={item.stop_id}
                                    className="flex items-center space-x-3 p-2 bg-white rounded border"
                                >
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary disabled:cursor-not-allowed"
                                        checked={field.value?.includes(item.stop_id)}
                                        disabled={disabled}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            const current = field.value || [];
                                            if (checked) {
                                                field.onChange([...current, item.stop_id]);
                                            } else {
                                                field.onChange(current.filter(val => val !== item.stop_id));
                                            }
                                        }}
                                    />
                                    <span className="text-sm text-gray-700 font-medium">
                                        {item.name}
                                    </span>
                                </div>
                            ))}
                        {errors.selectedStopIds && <p className="text-sm text-red-500">{errors.selectedStopIds.message}</p>}
                    </div>
                )}
            />
        </div>
    );
};
