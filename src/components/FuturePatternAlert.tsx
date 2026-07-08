export type FuturePatternAlertProps = {
  futureAlerts: Array<Record<string, unknown>>;
  onInterception: (payload: { future_alert_id: string; active_pattern_id: string; response: string }) => void;
};

export function FuturePatternAlert(_props: FuturePatternAlertProps) {
  return null;
}
