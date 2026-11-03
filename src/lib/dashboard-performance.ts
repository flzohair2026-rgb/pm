// Local diagnostics only. Never include guest data, tokens, or raw responses.
export function measureDashboard(label: string) {
  const enabled = process.env.NODE_ENV === 'development';
  const started = enabled ? performance.now() : 0;
  let previous = started;
  const timings: Record<string, number> = {};
  return {
    mark(stage: string) {
      if (!enabled) return;
      const now = performance.now();
      timings[`${stage}_ms`] = Math.round(now - previous);
      previous = now;
    },
    finish(details: Record<string, string | number | boolean> = {}) {
      if (!enabled) return;
      console.info(`[dashboard-perf] ${label}`, {
        ...timings,
        total_ms: Math.round(performance.now() - started),
        ...details,
      });
    },
  };
}
