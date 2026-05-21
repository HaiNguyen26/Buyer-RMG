import { useId } from 'react';

type MiniSparklineProps = {
  points: number[];
  className?: string;
  strokeClassName?: string;
  height?: number;
  width?: number;
};

/** Biểu đồ đường thu nhỏ — SVG nhẹ, không phụ thuộc chart lib. */
export function MiniSparkline({
  points,
  className = '',
  strokeClassName = 'stroke-indigo-500',
  height = 36,
  width = 112,
}: MiniSparklineProps) {
  const gradientId = useId();
  const safe = points.length >= 2 ? points : [0, 0];
  const max = Math.max(...safe, 1);
  const min = Math.min(...safe, 0);
  const range = max - min || 1;
  const pad = 3;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const coords = safe.map((v, i) => {
    const x = pad + (i / (safe.length - 1)) * innerW;
    const y = pad + innerH - ((v - min) / range) * innerH;
    return [x, y] as const;
  });

  const lineD = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaD = `${lineD} L${coords[coords.length - 1][0].toFixed(1)},${(height - pad).toFixed(1)} L${coords[0][0].toFixed(1)},${(height - pad).toFixed(1)} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`block shrink-0 ${className}`}
      width={width}
      height={height}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} className={`${strokeClassName} opacity-30`} fill={`url(#${gradientId})`} />
      <path
        d={lineD}
        fill="none"
        className={strokeClassName}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
