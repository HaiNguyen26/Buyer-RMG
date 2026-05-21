import type { CSSProperties, ReactElement } from 'react';
import type { PieSectorShapeProps } from 'recharts';
import { Sector } from 'recharts';

/** Tooltip style like premium dark mock (PR theo loại hover). */
export const DONUT_DARK_TOOLTIP_CONTENT_STYLE: CSSProperties = {
  borderRadius: '12px',
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  color: '#f8fafc',
  fontSize: '12px',
  boxShadow: '0 12px 40px rgba(15, 23, 42, 0.35)',
};

export const DONUT_DARK_TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: '#e2e8f0',
  fontWeight: 600,
  marginBottom: 4,
};

export const DONUT_DARK_TOOLTIP_ITEM_STYLE: CSSProperties = {
  color: '#f8fafc',
};

/**
 * Angular gap between slices so hover “explode” reads along visible grooves
 * (Chart.js doughnut `spacing` ~px at outer edge → Recharts `paddingAngle` in degrees).
 */
export function donutPaddingAngleDeg(outerRadiusPx: number, gapPx = 10): number {
  const r = Math.max(40, outerRadiusPx);
  const deg = (gapPx / r) * (180 / Math.PI);
  return Math.min(10, Math.max(4, deg));
}

/** Chart.js-style rounded slice ends; Recharts clamps by ring thickness. */
export const DONUT_CORNER_RADIUS = 20;

/** Initial load animation for Pie. */
export const DONUT_ANIMATION_DURATION_MS = 600;

/** Biểu đồ chi tiết Branch Overview — vẽ mượt khi vào viewport. */
export const BRANCH_OVERVIEW_CHART_DURATION_MS = 1500;

/**
 * ease-out quart–like deceleration (Recharts accepts named easings or cubic-bezier()).
 */
export const DONUT_ANIMATION_EASING = 'cubic-bezier(0.25, 1, 0.5, 1)' as const;

/** Hover slide duration — CSS on `transform` (activeShape swaps instantly; `shape` + transition does not). */
export const DONUT_HOVER_TRANSITION_MS = 600;

/** Radial translate (px): scales with ring size. */
function hoverTranslatePx(outerRadius: number): number {
  return Math.round(Math.min(56, Math.max(22, outerRadius * 0.32)));
}

/**
 * Single sector renderer: Recharts sets `isActive` on hover.
 * Use CSS `transition` on `transform` so the slice eases out instead of snapping (unlike `activeShape`).
 */
export function donutSectorShape(props: PieSectorShapeProps): ReactElement {
  const { isActive, midAngle, startAngle, endAngle, outerRadius: or } = props;
  const outerRadius = Number(or ?? 0);
  const mid = midAngle ?? (startAngle + endAngle) / 2;
  const RADIAN = Math.PI / 180;
  const angleRad = -RADIAN * mid;
  const t = isActive ? hoverTranslatePx(outerRadius) : 0;
  const dx = t * Math.cos(angleRad);
  const dy = t * Math.sin(angleRad);

  const gStyle: CSSProperties = {
    transform: `translate(${dx}px, ${dy}px)`,
    transition: `transform ${DONUT_HOVER_TRANSITION_MS}ms ${DONUT_ANIMATION_EASING}`,
    willChange: 'transform',
  };

  return (
    <g style={gStyle}>
      <Sector {...props} stroke="none" strokeWidth={0} />
    </g>
  );
}

/** Cùng bo góc Sector như donutSectorShape nhưng không dịch khi hover — tooltip vẫn hiện, chart nằm im. */
export function donutSectorShapeStatic(props: PieSectorShapeProps): ReactElement {
  return (
    <g>
      <Sector {...props} stroke="none" strokeWidth={0} />
    </g>
  );
}
