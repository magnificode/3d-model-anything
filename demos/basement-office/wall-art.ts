import * as THREE from 'three';
import { wallMatrix, type WallDef } from '../../packages/room-runtime/walls';
import { boxSpan, mesh } from '../../packages/room-runtime/helpers';
import { mulberry32 } from '../../packages/room-runtime/materials';
import { canvasTexture } from './window';

/** Framed print in a wall's (u, v, out) frame: a moulding ring of `frame` width and a print plane inside it */
function framed(w: WallDef, name: string, [u0, u1, v0, v1]: [number, number, number, number], print: THREE.Texture, frameMat: THREE.Material, frame = 0.035, depth = 0.025) {
  const g = new THREE.Group();
  g.name = name;
  g.applyMatrix4(wallMatrix(w));
  g.add(
    boxSpan([u0, v0, 0], [u0 + frame, v1, depth], frameMat),
    boxSpan([u1 - frame, v0, 0], [u1, v1, depth], frameMat),
    boxSpan([u0 + frame, v0, 0], [u1 - frame, v0 + frame, depth], frameMat),
    boxSpan([u0 + frame, v1 - frame, 0], [u1 - frame, v1, depth], frameMat),
  );
  const plane = mesh(new THREE.PlaneGeometry(u1 - u0 - 2 * frame, v1 - v0 - 2 * frame), new THREE.MeshStandardMaterial({ map: print, roughness: 0.45 }), `${name}-print`);
  plane.position.set((u0 + u1) / 2, (v0 + v1) / 2, depth - 0.006);
  plane.castShadow = false;
  g.add(plane);
  return g;
}

const blob = (ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string, rot = 0) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
};

/**
 * Godzilla vs. Biollante style screen print (photos 22, 23, 85): yellow ground with orange bursts,
 * a shaggy blue monster left of centre, a dark blue Godzilla on the right, magenta and purple clouds
 * along the bottom, pink katakana down the right edge. A painted stand-in, not the artwork.
 */
function godzillaPrint() {
  const W = 1024, H = 700;
  return canvasTexture(W, H, (ctx) => {
    const rnd = mulberry32(21);
    ctx.fillStyle = '#f6d327';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f39a2a';
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(560, 330);
      ctx.lineTo(560 + Math.cos(a) * 900, 330 + Math.sin(a) * 900);
      ctx.lineTo(560 + Math.cos(a + 0.12) * 900, 330 + Math.sin(a + 0.12) * 900);
      ctx.fill();
    }
    // tendrils behind the monster
    ctx.strokeStyle = '#2c63c4';
    ctx.lineWidth = 18;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(330, 230 + i * 40);
      ctx.bezierCurveTo(150, 90 + i * 70, 90, 420, 30 + i * 25, 120 + i * 80);
      ctx.stroke();
    }
    // shaggy blue monster filling the left half: overlapping tufts, a red maw with pale teeth
    for (let i = 0; i < 520; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 250;
      blob(ctx, 390 + Math.cos(a) * r * 1.05, 300 + Math.sin(a) * r * 0.95, 22, 11, ['#2c63c4', '#3b7fe0', '#1d3f8f', '#5b9cf0', '#14306e'][i % 5], a);
    }
    blob(ctx, 430, 340, 120, 70, '#d8203f');
    ctx.fillStyle = '#f6dfe4';
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.moveTo(330 + i * 24, 285); ctx.lineTo(342 + i * 24, 320); ctx.lineTo(354 + i * 24, 285);
      ctx.moveTo(330 + i * 24, 395); ctx.lineTo(342 + i * 24, 360); ctx.lineTo(354 + i * 24, 395);
      ctx.fill();
    }
    // Godzilla on the right, dorsal spikes in pink
    ctx.fillStyle = '#1c2f73';
    ctx.beginPath();
    ctx.moveTo(650, 600); ctx.lineTo(680, 330); ctx.lineTo(720, 190); ctx.lineTo(800, 150); ctx.lineTo(850, 200);
    ctx.lineTo(820, 290); ctx.lineTo(880, 430); ctx.lineTo(900, 600);
    ctx.fill();
    ctx.fillStyle = '#e6418f';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(840 + i * 8, 220 + i * 50); ctx.lineTo(890 + i * 8, 240 + i * 50); ctx.lineTo(850 + i * 8, 260 + i * 50);
      ctx.fill();
    }
    // clouds
    for (let i = 0; i < 30; i++) blob(ctx, rnd() * W, H - 40 - rnd() * 70, 60 + rnd() * 50, 30 + rnd() * 20, ['#a23ab5', '#e6418f', '#7b2c9e'][i % 3]);
    ctx.fillStyle = '#e6418f';
    for (let i = 0; i < 6; i++) ctx.fillRect(930, 60 + i * 52, 46, 34);
  });
}

/**
 * "The Man-Thing" poster (photos 34, 82, 161, 185): red mat, a dark green swamp figure with red eyes
 * against a yellow-green jungle, the title in yellow along the bottom. Painted stand-in.
 */
function manThingPrint() {
  const W = 600, H = 980;
  return canvasTexture(W, H, (ctx) => {
    const rnd = mulberry32(13);
    ctx.fillStyle = '#9b2a2c';
    ctx.fillRect(0, 0, W, H);
    const m = 42;
    const bg = ctx.createLinearGradient(0, m, 0, H - m);
    bg.addColorStop(0, '#2d3a1d');
    bg.addColorStop(0.55, '#7f8a2a');
    bg.addColorStop(1, '#c9bf3a');
    ctx.fillStyle = bg;
    ctx.fillRect(m, m, W - 2 * m, H - 2 * m);
    // hanging vines
    for (let i = 0; i < 40; i++) blob(ctx, m + rnd() * (W - 2 * m), m + rnd() * 260, 10 + rnd() * 30, 30 + rnd() * 60, ['#1e2a14', '#3c5a22', '#5f7d2a'][i % 3]);
    // the figure: a hulking mound of dark green, red eyes
    for (let i = 0; i < 160; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
      blob(ctx, 300 + Math.cos(a) * r * 190, 470 + Math.sin(a) * r * 260, 22, 14, ['#1f3a1c', '#2f5426', '#14261a', '#3f6b2c'][i % 4], a);
    }
    blob(ctx, 265, 330, 14, 9, '#e0241d');
    blob(ctx, 335, 330, 14, 9, '#e0241d');
    ctx.fillStyle = '#f1c62f';
    ctx.strokeStyle = '#8f1d1d';
    ctx.lineWidth = 6;
    ctx.font = 'bold 74px Impact, Arial Black, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText('MAN-THING', W / 2, H - 90);
    ctx.fillText('MAN-THING', W / 2, H - 90);
  });
}

/** Sepia engraving in an ornate gilt frame over the desk (photo 178): winged figures, painted stand-in */
function engravingPrint() {
  const W = 800, H = 620;
  return canvasTexture(W, H, (ctx) => {
    const rnd = mulberry32(31);
    ctx.fillStyle = '#4a3a22';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) {
      ctx.strokeStyle = rnd() < 0.5 ? 'rgba(24,16,8,0.6)' : 'rgba(205,165,95,0.55)';
      ctx.lineWidth = 1 + rnd() * 2;
      const x = rnd() * W, y = rnd() * H, a = rnd() * Math.PI;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 30, y + Math.sin(a) * 30);
      ctx.stroke();
    }
    blob(ctx, 560, 230, 140, 70, 'rgba(40,28,16,0.6)', -0.4);
    blob(ctx, 300, 330, 70, 120, 'rgba(215,180,110,0.5)');
  });
}

/**
 * Wall art, each built in its wall's frame and returned per wall so it can join that wall's group
 * (the cutaway hides it with the wall). Positions are approximate unless noted:
 * - Godzilla print on wall 9 over the pine cabinet, u 1.06–2.04, v 1.17–1.87 (mesh: frame edges in
 *   the wall-relative depth map at u ≈ 1.0–1.15 and 1.95–2.0; photo 22: bottom ~0.25 above the cabinet top).
 * - Man-Thing poster on wall 2, u 0.06–0.62, v 1.03–2.18 (photos 82, 161 matched cameras) and the light switch right of it.
 * - Gilt-framed engraving on wall 6 above the monitors, u 0.56–1.40, v 1.40–2.10 (photo 178 matched camera; the
 *   mesh depth map shows the frame's edges about 0.1 lower and further south).
 */
export function wallArt(walls: WallDef[], gilt: THREE.Material, white: THREE.Material) {
  const darkFrame = new THREE.MeshStandardMaterial({ color: '#2b221c', roughness: 0.6 });
  const switchPlate = new THREE.Group();
  switchPlate.name = 'light-switch';
  switchPlate.applyMatrix4(wallMatrix(walls[2]));
  switchPlate.add(boxSpan([0.665, 1.16, 0], [0.735, 1.275, 0.006], white), boxSpan([0.693, 1.2, 0.006], [0.707, 1.235, 0.012], white));
  return {
    9: [framed(walls[9], 'poster-godzilla', [1.06, 2.04, 1.17, 1.87], godzillaPrint(), darkFrame)],
    2: [framed(walls[2], 'poster-man-thing', [0.06, 0.62, 1.03, 2.18], manThingPrint(), darkFrame, 0.03), switchPlate],
    6: [framed(walls[6], 'engraving-gilt', [0.56, 1.4, 1.4, 2.1], engravingPrint(), gilt, 0.075, 0.04)],
  } as Record<number, THREE.Object3D[]>;
}
