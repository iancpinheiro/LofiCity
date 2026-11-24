/* COPACABANA (Rio de Janeiro): the promenade seen straight out to sea, from the owner's day
   photo. The black-and-white wave calçada fills the foreground, coconut palms stand along it,
   then the sand and the Atlantic. The night photo is a different angle and is used only for
   the lamp posts: tall lights along this walk. No avenue in the day frame, so no road, zebra
   or traffic. Neither photo is in the repo. */
import { L, Lp, WW, blitLayer, newLayer, put } from '../engine/gfx';
import { mulberry32 } from '../engine/math';
import { BNEAR, CBEIGE, CBLUE, CRED, CYELL, FBLUE, LEAFG, LEAFGD, SKIN1, SKIN2, STONE, STONEL, TILEW } from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { S } from '../sky/state';
import { drawSky, drawStreet, type Street } from './common';
import { type Lamp, type Palm, drawPalm, lampLight, lampPost } from './br-kit';
import type { Scene } from './types';

const HORIZON = 48, SEA = 88, SAND = 116, WALK = 126;
const SH = 180 - WALK;
const wr = mulberry32(0xc0ca);
const mid = newLayer(), front = newLayer();
const street: Street = { y0: WALK, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const LAMPS: Lamp[] = [48, 156, 264, 372].map((x) => ({ x, top: 78, ground: 142, arms: 1 as const }));
const PALMS: Palm[] = [22, 89, 151, 213, 276, 339, 405].map((x, i) => ({
  x, ground: 142 + (i % 3) * 2, h: 60 + (i % 3) * 5, lean: i % 2 ? 2 : -2, ph: i * 1.3,
}));

function buildShore() {
  // A distant coastal ridge, inspired by the mountain in the supplied beach photo.
  for (let x = 270; x < WW; x++) {
    const peak1 = 30 * Math.exp(-(((x - 360) / 16) ** 2));
    const peak2 = 26 * Math.exp(-(((x - 380) / 17) ** 2));
    const foothill = 22 * Math.exp(-(((x - 370) / 48) ** 2));
    const ridge = HORIZON - Math.max(peak1, peak2, foothill);
    for (let y = Math.ceil(ridge); y < HORIZON; y++) {
      const rock = x > 344 && x < 398 && y < ridge + 10 + Math.sin(x * 0.17) * 3;
      const shade = Math.sin(x * 0.19 + y * 0.11) + Math.sin(x * 0.07 - y * 0.22);
      Lp(mid, x, y, rock ? (shade > 0.7 ? STONE : BNEAR) : (shade > 0.4 ? LEAFG : LEAFGD));
    }
  }
  for (let y = HORIZON; y < SEA; y++) for (let x = 0; x < WW; x++) Lp(mid, x, y, y < HORIZON + 3 ? FBLUE : CBLUE);
  for (let y = SEA; y < SAND; y++) for (let x = 0; x < WW; x++) Lp(mid, x, y, wr() < 0.08 ? STONEL : CBEIGE);
  // A few beach umbrellas sit on the sand, behind the foreground promenade.
  for (const [x, y, color] of [[66, 104, CRED], [183, 106, CYELL], [295, 103, CRED], [423, 106, CYELL]] as const) {
    L(mid, x, y + 1, 1, 8, STONE);
    for (let dy = 0; dy < 4; dy++) {
      const half = 2 + dy * 2;
      for (let dx = -half; dx <= half; dx++) {
        Lp(mid, x + dx, y - 3 + dy, (Math.floor((dx + 12) / 4) % 2) ? color : TILEW);
      }
    }
  }
  // A few distant beachgoers, kept entirely on the sand.
  for (const [x, y, skin, clothes] of [[79, 109, SKIN1, CBLUE], [198, 111, SKIN2, CRED], [307, 108, SKIN2, CBLUE]] as const) {
    Lp(mid, x, y - 3, skin);
    L(mid, x - 1, y - 2, 3, 2, clothes);
    L(mid, x - 1, y, 3, 1, skin);
  }
}

function buildWaves() {
  // the Copacabana wave: black stone ribbons on a light ground, several across the walk
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) {
    // Parallel, equally wide black and white bands share one wave phase, so they
    // never cross and fill the pavement like the Portuguese-stone mosaic.
    const wave = Math.sin(x * 2 * Math.PI / 58) * 4;
    const dark = Math.floor((d - wave + 160) / 8) % 2 === 0;
    street.base[d * WW + x] = dark ? BNEAR : TILEW;
  }
  for (let p = 0; p < 4; p++) {
    const cx = wr() * WW, cy = 4 + wr() * (SH - 8), rx = 14 + wr() * 18, ry = 2;
    for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) {
      const a = (x - cx) / rx, b = (d - cy) / ry;
      if (a * a + b * b < 1) street.pud[d * WW + x] = 1;
    }
  }
}

function surf() {
  const t = S.ms / 900;
  for (const base of [58, 69, 80, 86]) {
    for (let x = 0; x < WW; x++) {
      const y = base + Math.round(Math.sin(x * 0.065 + t * 0.45 + base) * 1.2 + Math.sin(x * 0.14 + base) * 0.6);
      const breaks = Math.sin(x * 0.19 + base * 3 + t * 0.35) + Math.sin(x * 0.047 - base);
      if (y >= HORIZON && y < SEA && breaks > (base === 86 ? -0.1 : 0.75)) put(x, y, TILEW);
    }
  }
  // Surfers travel gently along the water and bob with the swell.
  if (S.dayK > 0.42) for (const [center, base, board, skin, phase] of [[100, 65, CRED, SKIN1, 0], [215, 76, CYELL, SKIN2, 2], [305, 65, CRED, SKIN2, 4]] as const) {
    const x = Math.round(center + Math.sin(S.ms / 16000 + phase) * 38);
    const y = base + Math.round(Math.sin(t * 0.6 + phase) * 1);
    for (let dx = -6; dx <= 6; dx++) put(x + dx, y, board);
    for (let dx = -4; dx <= 4; dx++) put(x + dx, y + 1, board);
    for (let dx = -2; dx <= 2; dx++) put(x + dx, y - 1, BNEAR);
    for (let dy = 2; dy <= 4; dy++) {
      put(x - 1, y - dy, BNEAR);
      put(x, y - dy, BNEAR);
    }
    put(x - 2, y - 3, skin);
    put(x + 1, y - 3, skin);
    put(x - 1, y - 5, skin);
    put(x, y - 5, skin);
    put(x - 1, y - 6, BNEAR);
    put(x, y - 6, BNEAR);
  }
}

function update(dt: number) {
  tickSpawns(dt, 0.6);
  updatePeople(dt);
}

function render() {
  drawSky(HORIZON);
  drawLightning();
  drawFireworks();
  blitLayer(mid);
  surf();
  drawFarPrecip();
  drawStreet(street);
  blitLayer(front);
  for (const p of PALMS) drawPalm(p);
  for (const l of LAMPS) lampLight(l);
  drawPeople();
  drawRipples();
  drawNearPrecip();
}

let built = false;
export const copacabana: Scene = {
  id: 'copacabana',
  name: 'Copacabana',
  build() {
    if (!built) {
      buildShore();
      buildWaves();
      for (const l of LAMPS) lampPost(front, l);
      L(front, 0, WALK, WW, 1, STONE);
      built = true;
    }
    setLanes([{ y: 150 }, { y: 169 }], { bikes: false });
    configure({ roofs: [], tips: [], lamps: LAMPS.map((l) => ({ x: l.x + 14, y: l.top })), ground0: WALK, horizon: HORIZON });
    for (let i = 0; i < 120; i++) update(1 / 30);
  },
  update,
  render,
  debug() { return `active  people x${peopleCount()}`; },
};
