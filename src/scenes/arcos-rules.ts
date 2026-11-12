/* Arcos da Lapa tram. Pure, so test/arcos-rules.test.ts can import it. No DOM.

   Art direction, not the Santa Teresa timetable: one tram crosses the deck, then waits
   offstage. The night photo has no tram, so the scene draws it only while tramByDay
   says it is still day. World width matches engine/gfx.ts WW. */

export const TRAM_W = 40;
export const WORLD_W = 480;
/** Full cycle, including the pause offstage. */
export const TRAM_CYCLE_MS = 64_000;
/** Time spent crossing; the rest of the cycle the tram is out of view. */
export const TRAM_TRAVEL_MS = 50_000;

/** Left edge of the tram in world pixels, or null while it waits offstage. */
export function tramLeft(ms: number): number | null {
  const t = ((ms % TRAM_CYCLE_MS) + TRAM_CYCLE_MS) % TRAM_CYCLE_MS;
  if (t >= TRAM_TRAVEL_MS) return null;
  return -TRAM_W + (t / TRAM_TRAVEL_MS) * (WORLD_W + TRAM_W);
}

/** The day photo shows the tram; the night photo does not. dayK is the shared sun grade. */
export const tramByDay = (dayK: number) => dayK >= 0.42;
