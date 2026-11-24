/* ARCOS DA LAPA (Rio de Janeiro): the Carioca Aqueduct seen straight on from the square
   in front. Two rows of white semicircular arches, a pierced parapet, wires along the deck.
   By day a yellow tram crosses on top (the day photo); at night the arches stay white and
   a few lamps show through the openings (the night photo). Both photos are the owner's,
   used as reference only, and neither is in the repo.

   The foreground in both photos is a stone plaza, not a road: no zebra, no signal, no
   moving traffic.
   Behind the arches are the cathedral, low urban facades and a painted wall on the right;
   the mural is colour blocks, no lettering. The crowd is
   the city's rhythm scaled down, because both photos show a wide, quiet square. */
import { L, Lp, WW, blitLayer, getW, newLayer, put, rect, snowCaps, type Layer } from '../engine/gfx';
import { mulberry32 } from '../engine/math';
import {
  AMB, AMBD, BMID, BNEAR, CBEIGE, CBLUE, CNAVY, CRED, CYELL, HAIR1, LIGHT,
  SKIN1, SKIN2, STEEL, STONE, STONEL, TILEW, WHITE, WOOD, WWARM,
} from '../engine/palette';
import { configure, drawFarPrecip, drawNearPrecip, drawRipples, precip } from '../fx/precip';
import { drawFireworks, drawLightning } from '../fx/sky-events';
import { drawPeople, peopleCount, setLanes, tickSpawns, updatePeople } from '../actors/people';
import { S } from '../sky/state';
import { drawSky, drawSnowCaps, drawStreet, type Street } from './common';
import { TRAM_W, tramByDay, tramLeft } from './arcos-rules';
import type { Scene } from './types';

/* Five bays at this pixel scale: a full semicircle tall enough to read, with a thick pier.
   The real aqueduct has many more arches; the photo is a crop of them. */
const BAYS = 5, BAY = 96, R = 34;
const CAP = 24, SCALLOP = 36, UP = 76, LO = 118, FOOT = 128;
const cxOf = (i: number) => BAY / 2 + i * BAY;

const wr = mulberry32(0xa1ca);
const back = newLayer(), arch = newLayer();
const SH = 180 - FOOT;
const street: Street = { y0: FOOT, base: new Uint8Array(SH * WW), pud: new Uint8Array(SH * WW), jit: precip.jit };
const wins: { x: number; y: number; rank: number }[] = [];
let caps = new Float32Array(0);

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
  // The cathedral rises behind the aqueduct: a truncated cone with concrete ribs
  // and the fine horizontal grid visible in the supplied reference photographs.
  const center = 338, top = 1, bottom = FOOT;
  for (let y = top; y < bottom; y++) {
    const k = (y - top) / (bottom - top);
    const half = 12 + k * 48;
    for (let x = Math.ceil(center - half); x <= Math.floor(center + half); x++) {
      const u = (x - center) / half;
      const rib = Math.abs(u) > 0.91 || Math.abs(u + 0.37) < 0.035 || Math.abs(u - 0.35) < 0.035;
      const grid = y % 4 === 0 || (Math.round((u + 1) * 16) % 3 === 0 && y % 4 < 2);
      Lp(back, x, y, rib ? STONEL : grid ? STEEL : BNEAR);
    }
  }
  L(back, center - 12, top, 24, 2, STONEL);
  // Low urban facades show through the lower arches, in front of the cathedral.
  for (let i = 0; i < BAYS; i++) {
    const cx = cxOf(i), x0 = cx - R + 4, w = R * 2 - 8;
    if (i !== 3) {
      L(back, x0, LO - 20, w, FOOT - (LO - 20), i < 2 ? STONE : BMID);
      L(back, x0, LO - 20, w, 2, STEEL);
      for (let x = x0 + 5; x < x0 + w - 3; x += 12) {
        L(back, x, LO - 15, 5, 5, CNAVY);
      }
    }
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
    // Continue each curved opening downward so the arches do not end as flat domes.
    L(arch, cx - R + 1, UP + 1, R * 2 - 2, 5, 255);
    L(arch, cx - R + 1, LO + 1, R * 2 - 2, FOOT - LO - 1, 255);
    L(arch, cx - R, UP + 1, 1, 5, STEEL);
    L(arch, cx + R - 1, UP + 1, 1, 5, STEEL);
    L(arch, cx - R, LO + 1, 1, FOOT - LO - 1, STEEL);
    L(arch, cx + R - 1, LO + 1, 1, FOOT - LO - 1, STEEL);
  }
  // catenary poles and the two wires along the deck
  for (const x of [36, 156, 276, 396]) L(arch, x, CAP - 18, 1, 18, STEEL);
  L(arch, 0, CAP - 16, WW, 1, STEEL);
  L(arch, 0, CAP - 11, WW, 1, STEEL);
}

function buildGround() {
  // Subtle stone paving: individual slabs share a tone instead of pixel noise.
  for (let d = 0; d < SH; d++) for (let x = 0; x < WW; x++) {
    const row = Math.floor(d / 9), shiftedX = x + (row % 2) * 11;
    const col = Math.floor(shiftedX / 22);
    const joint = d % 9 === 0 || shiftedX % 22 === 0;
    const tone = (row * 13 + col * 7) % 5;
    street.base[d * WW + x] = d < 3 ? BMID : joint ? STONE : tone === 0 ? STONEL : STONE;
  }
  // the round drain on the right of the day photo
  const dx = 404, dy = 38;
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
    setLanes([{ y: 148 }, { y: 169 }], { bikes: false });
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
