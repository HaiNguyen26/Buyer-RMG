import { useCountUp } from '../../hooks/useCountUp';

type CountUpNumberProps = {
  /** Giá trị đích (số nguyên ≥ 0). */
  end: number;
  /** Thời gian đếm (ms). */
  durationMs?: number;
};

/** Hiển thị số đếm dần + định dạng vi-VN — dùng trong StatCard / KPI. */
export function CountUpNumber({ end, durationMs = 1100 }: CountUpNumberProps) {
  const n = useCountUp(end, durationMs);
  return <>{n.toLocaleString('vi-VN')}</>;
}
