import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

interface QrCodeProps {
    value: string;
    /** Rendered width/height in px. */
    size?: number;
    className?: string;
}

/** A real, scannable QR code drawn as one SVG path (no canvas, no images). */
export const QrCode = ({ value, size = 176, className }: QrCodeProps) => {
    const { d, n } = useMemo(() => {
        const qr = qrcode(0, 'M');
        qr.addData(value);
        qr.make();
        const count = qr.getModuleCount();
        let path = '';
        for (let r = 0; r < count; r++) {
            for (let c = 0; c < count; c++) {
                if (qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
            }
        }
        return { d: path, n: count };
    }, [value]);

    return (
        <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" aria-hidden="true" className={className}>
            <path d={d} fill="currentColor" />
        </svg>
    );
};
