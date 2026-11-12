/* ARCOS DA LAPA (Rio de Janeiro): the Carioca Aqueduct seen straight on from the square
   in front. Two rows of white semicircular arches, a pierced parapet, wires along the deck.
   By day a yellow tram crosses on top (the day photo); at night the arches stay white and
   a few lamps show through the openings (the night photo). Both photos are the owner's,
   used as reference only, and neither is in the repo.

   The foreground in both photos is a stone plaza, not a road: no zebra, no signal, no
   moving traffic. The white cars sit inside the lower openings, static, as in the day photo.
   What shows through the arches (palms on the left, low roofs, a painted wall on the right)
   is only as specific as the photos: the mural is colour blocks, no lettering. The crowd is
   the city's rhythm scaled down, because both photos show a wide, quiet square. */
import { L, Lp, WW, blitLayer, getW, newLayer, put, rect, snowCaps, type Layer } from '../engine/gfx';
import { mulberry32 } from '../engine/math';
import {
  AMB, AMBD, BMID, BNEAR, CBEIGE, CBLUE, CNAVY, CRED, CYELL, FORNG, HAIR1, LIGHT,
  SKIN1, SKIN2, STEEL, STONE, STONEL, TILEW, WHITE, WOOD, WWARM,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { S } from '../sky/state';
import { drawSky, drawSnowCaps, drawStreet, type Street } from './common';
import { type Palm, drawPalm } from './br-kit';
import { TRAM_W, tramByDay, tramLeft } from './arcos-rules';
import type { Scene } from './types';

/* Five bays at this pixel scale: a full semicircle tall enough to read, with a thick pier.
   The real aqueduct has many more arches; the photo is a crop of them. */
const BAYS = 5, BAY = 96, R = 34;
const CAP = 4, SCALLOP = 16, UP = 56, LO = 98, FOOT = 108;
const cxOf = (i: number) => BAY / 2 + i * BAY;

const wr = mulberry32(0xa1ca);
const back = newLayer(), arch = newLayer();
const SH = 180 - FOOT;
const street: Street = { y0: FOOT, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const wins: { x: number; y: number; rank: number }[] = [];
let caps = new Float32Array(0);

const PALMS: Palm[] = [
  { x: 48, ground: FOOT, h: 62, lean: -0.3, ph: 0.6, imperial: true },
  { x: 144, ground: FOOT, h: 56, lean: 0.2, ph: 2.1, imperial: true },
];
/** Lower openings that hold a parked white car in the day photo. */
const CARS = [1, 2, 4];
/** Openings with a lamp visible in the night photo. */
const LAMPS = [0, 2, 3, 4];

function voidArch(ly: Layer, cx: number, spring: number, r: number) {
  for (let dy = 0; dy <= r; dy++) {
    const half = Math.sqrt(r * r - dy * dy);
    const y = spring - dy, x0 = Math.ceil(cx - half), x1 = Math.floor(cx + half);
    for (let x = x0; x < x1; x++) Lp(ly, x, y, 255);
  }
  // a one-pixel intrados so the curve still reads when the sky behind it is pale
  for (let dy = 0; dy <= r; dy++) {
    const half = Math.sqrt(r * r - dy * dy);
    const y = spring - dy;
    Lp(ly, Math.ceil(cx - half), y, STEEL);
    Lp(ly, Math.floor(cx + half) - 1, y, STEEL);
  }
  Lp(ly, cx, spring - r, STEEL);
}

function buildBack() {
  // Only the lower part of each opening is a building. The rest stays empty so the real sky
  // shows through the arch, instead of a flat colour that reads as a solid dome.
  for (let i = 0; i < BAYS; i++) {
    const cx = cxOf(i), x0 = cx - R + 4, w = R * 2 - 8;
    const wall = i < 2 ? FORNG : BMID;
    L(back, x0, LO - 16, w, FOOT - (LO - 16), wall);
    L(back, x0, LO - 16, w, 2, i < 2 ? CYELL : STEEL);
    if (i === BAYS - 1) {
      L(back, x0 + 4, LO - 10, w - 8, 16, CBEIGE);
      L(back, x0 + 6, LO - 6, 8, 10, CYELL);
      L(back, x0 + 16, LO - 8, 10, 12, CRED);
      L(back, x0 + 28, LO - 4, 8, 8, CBLUE);
      L(back, x0 + 38, LO - 6, 8, 10, SKIN2);
    }
    wins.push({ x: cx - 6, y: LO - 8, rank: wr() });
  }
}

function buildArch() {
  L(arch, 0, CAP, WW, FOOT - CAP, WHITE);
  for (let x = 8; x < WW; x += 12) voidArch(arch, x, SCALLOP, 5);
  for (let i = 0; i < BAYS; i++) {
    const cx = cxOf(i);
    voidArch(arch, cx, UP, R);
    voidArch(arch, cx, LO, R);
  }
  // catenary poles and the two wires along the deck
  for (const x of [36, 156, 276, 396]) L(arch, x, CAP - 18, 1, 18, STEEL);
  L(arch, 0, CAP - 16, WW, 1, STEEL);
  L(arch, 0, CAP - 11, WW, 1, STEEL);
}

function buildGround() {
  // irregular flagstones, not a running-bond brick wall: each row shifts and the stones vary
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) {
    const rowH = 8 + ((d * 3) % 5);
    const row = (d / rowH) | 0;
    const stoneW = 14 + ((row * 5) % 9);
    const shift = (row * 17) % stoneW;
    const jx = (x + shift) % stoneW;
    const edge = jx < 1;
    const n = wr();
    street.base[d * WW + x] = d < 4 ? BNEAR : edge ? BMID : n < 0.5 ? STONE : n < 0.82 ? STONEL : BMID;
  }
  // the round drain on the right of the day photo
  const dx = 404, dy = 56;
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) {
    const a = (x - dx) / 5, b = (d - dy) / 3;
    if (a * a + b * b < 1 && a * a + b * b > 0.35) street.base[d * WW + x] = BMID;
  }
  for (let p = 0; p < 5; p++) {
    const px = wr() * WW, py = 8 + wr() * (SH - 14), rx = 12 + wr() * 20, ry = 2 + wr() * 2;
    for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) {
      const a = (x - px) / rx, b = (d - py) / ry;
      if (a * a + b * b < 1) street.pud[d * WW + x] = 1;
    }
  }
}

function drawWindows() {
  const lit = S.dayK < 0.45 ? 0.75 : 0;
  for (const w of wins) if (w.rank < lit) rect(w.x, w.y, 2, 2, WWARM);
}

function drawCars() {
  for (const i of CARS) {
    const x = cxOf(i) - 10, y = LO - 8;
    rect(x, y, 20, 6, WHITE);
    rect(x + 3, y + 1, 10, 3, CNAVY);
    rect(x + 2, y + 5, 4, 2, STEEL);
    rect(x + 14, y + 5, 4, 2, STEEL);
  }
}

function drawTram(x: number) {
  const y = CAP - 10;
  rect(x, y, TRAM_W, 11, CYELL);
  rect(x, y, TRAM_W, 2, WOOD);
  rect(x + 3, y + 3, TRAM_W - 8, 4, CNAVY);
  for (let i = 0; i < 6; i++) put(x + 5 + i * 5, y + 4, i & 1 ? SKIN2 : SKIN1);
  for (let i = 0; i < 6; i++) put(x + 5 + i * 5, y + 3, HAIR1);
  rect(x + 4, y + 9, 3, 2, STEEL);
  rect(x + TRAM_W - 8, y + 9, 3, 2, STEEL);
  put(x + (TRAM_W >> 1), y - 1, STEEL);
  put(x + (TRAM_W >> 1), y - 2, STEEL);
  put(x + (TRAM_W >> 1) + 3, y - 3, STEEL);
}

/** Right edge of each pier, only on the white wall, and only by day: a night shade would cut the floodlit arches. */
function pierShade() {
  if (S.dayK < 0.45) return;
  for (let i = 0; i < BAYS; i++) {
    const x = cxOf(i) + R;
    for (let y = SCALLOP; y < FOOT; y++) if (getW(x, y) === WHITE) put(x, y, TILEW);
  }
}

function bayLamps() {
  if (S.dayK >= 0.5) return;
  for (const i of LAMPS) {
    const x = cxOf(i);
    put(x, LO - 18, LIGHT);
    put(x - 1, LO - 18, AMB);
    put(x + 1, LO - 18, AMB);
    put(x, LO - 8, AMBD);
  }
}

function update(dt: number) {
  // both reference photos show a wide, quiet square: scale the city rhythm, don't replace it
  tickSpawns(dt, 0.34);
  updatePeople(dt);
}

function render() {
  drawSky(CAP);
  drawLightning();
  drawFireworks();
  blitLayer(back);
  drawWindows();
  for (const p of PALMS) drawPalm(p);
  drawCars();
  blitLayer(arch);
  pierShade();
  bayLamps();
  drawSnowCaps(caps);
  const tram = tramByDay(S.dayK) ? tramLeft(S.ms) : null;
  if (tram !== null) drawTram(tram);
  drawFarPrecip();
  drawStreet(street);
  drawPeople();
  drawRipples();
  drawNearPrecip();
}

let built = false;
export const arcosLapa: Scene = {
  id: 'arcos-da-lapa',
  name: 'Arcos da Lapa',
  build() {
    if (!built) {
      buildBack(); buildArch(); buildGround();
      caps = snowCaps(arch, wr);
      built = true;
    }
    setLanes([{ y: 136 }, { y: 162 }], { bikes: false });
    configure({ roofs: [{ x0: 0, x1: WW, y: CAP }], tips: [], lamps: [], ground0: FOOT, horizon: CAP });
    for (let i = 0; i < 150; i++) update(1 / 30);
  },
  update,
  render,
  debug() {
    const tram = tramByDay(S.dayK) ? tramLeft(S.ms) : null;
    return `active  people x${peopleCount()}  tram ${tram === null ? 'off' : Math.round(tram)}`;
  },
};
