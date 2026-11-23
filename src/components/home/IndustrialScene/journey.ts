export const STOP_SECONDS = 1.5;
export const CIRCUIT_SECONDS = 50;
export type Stop = { u: number; company: number; station: boolean };

export function journeyAt(elapsed: number, stops: readonly Stop[]) {
  const travel = CIRCUIT_SECONDS - stops.length * STOP_SECONDS;
  const time = elapsed % CIRCUIT_SECONDS;
  let leg = stops.length - 1;
  while (leg > 0 && time < leg * STOP_SECONDS + stops[leg].u * travel) leg--;
  const stop = stops[leg];
  const end = stops[leg + 1]?.u ?? 1;
  const legTime = time - (leg * STOP_SECONDS + stop.u * travel);
  const progress = Math.min(1, Math.max(0, (legTime - STOP_SECONDS) / ((end - stop.u) * travel)));
  const eased = progress * progress * (3 - 2 * progress);
  return { stop, legTime, stopped: legTime < STOP_SECONDS, u: stop.u + (end - stop.u) * eased };
}
