// Run with `pnpm test`. The Lapa tram's crossing (src/scenes/arcos-rules.ts); the drawing is not imported.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRAM_CYCLE_MS, TRAM_TRAVEL_MS, TRAM_W, WORLD_W, tramByDay, tramLeft } from '../src/scenes/arcos-rules.ts';

test('one tram crosses the deck, then waits offstage, and the cycle repeats', () => {
  assert.equal(tramLeft(0), -TRAM_W);
  assert.equal(tramLeft(TRAM_TRAVEL_MS - 1)! > WORLD_W - 2, true);
  assert.equal(tramLeft(TRAM_TRAVEL_MS), null);
  assert.equal(tramLeft(TRAM_CYCLE_MS - 1), null);
  assert.equal(tramLeft(TRAM_CYCLE_MS), tramLeft(0));
  const a = tramLeft(8_000)!, b = tramLeft(24_000)!;
  assert.ok(b > a, 'it travels west to east');
  assert.equal(tramLeft(-TRAM_CYCLE_MS), tramLeft(0));
});

test('the tram is a daytime sight: the night photo has none', () => {
  assert.equal(tramByDay(0.42), true);
  assert.equal(tramByDay(1), true);
  assert.equal(tramByDay(0.419), false);
  assert.equal(tramByDay(0), false);
});
