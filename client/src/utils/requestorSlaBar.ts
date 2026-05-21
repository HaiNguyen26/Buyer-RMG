export type TrackingSlaShape = {
  status: 'on_time' | 'warning' | 'overdue' | 'completed';
  timeRemaining: string | null;
  timeOverdue: string | null;
  daysSinceCreated: number;
  percentConsumed?: number;
  estimatedDays?: number;
};

export function slaBarPercent(sla: TrackingSlaShape): number {
  if (typeof sla.percentConsumed === 'number' && Number.isFinite(sla.percentConsumed)) {
    return Math.max(0, Math.min(100, Math.round(sla.percentConsumed)));
  }
  if (sla.status === 'completed' || sla.status === 'overdue') return 100;
  if (sla.timeRemaining) {
    const match = sla.timeRemaining.match(/(\d+)\s*(ngày|giờ)/i);
    if (match) {
      const value = parseInt(match[1], 10);
      const total = sla.estimatedDays && sla.estimatedDays > 0 ? sla.estimatedDays : 30;
      const daysLeft = match[2].toLowerCase() === 'giờ' ? value / 24 : value;
      return Math.max(0, Math.min(100, Math.round((1 - daysLeft / total) * 100)));
    }
  }
  return sla.status === 'warning' ? 85 : 25;
}
