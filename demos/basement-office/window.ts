import * as THREE from 'three';
import { wallMatrix, type WallDef } from '../../packages/room-runtime/walls';
import { boxSpan, mesh } from '../../packages/room-runtime/helpers';
import type { Palette } from '../../packages/room-runtime/materials';

/**
 * Wall 6 egress window, measured from the LiDAR mesh in wall-local coordinates (u along the wall,
 * v up, out into the room): glass sits 0.30 m behind the wall face over u 2.02–3.20, v 0.72–1.94.
 * RoomPlan's span (u 2.004–3.178, v 0.719–2.002) was close; the head is lower.
 */
export const WINDOW = { u0: 2.02, u1: 3.2, v0: 0.72, v1: 1.94 };
/** depth of the drywall reveal, wall face to glass (mesh: −0.30 to −0.34) */
const REVEAL = 0.3;
/** cellular shade bottom rail (mesh: shade surface at out −0.05 down to v ≈ 1.52; photo 73: about half drawn) */
const SHADE_BOTTOM = 1.52;
const SHADE_OUT = -0.05;

export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Honeycomb shade: soft horizontal pleats every ~2.4 cm (photo 73) */
function pleatTexture(pleats: number) {
  const t = canvasTexture(8, 64, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, '#d9d6cf');
    g.addColorStop(0.15, '#fbfaf7');
    g.addColorStop(0.8, '#f1efea');
    g.addColorStop(1, '#cfccc4');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 64);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, pleats);
  return t;
}

/**
 * The view out (photo 73): a corrugated galvanised window well with rocks at the bottom and a strip
 * of sky and tree above its rim. Painted for a plane spanning v from `vBottom` to `vTop`, set 0.15 m
 * behind the glass (any farther and it shows over the wall top in the orbit view): seen from eye
 * height 0.8 m away, the photo's rim (top of the glass) and rock line (a quarter up the clear glass)
 * land near v 1.95 and 0.84 on that plane.
 */
function outsideTexture(vBottom: number, vTop: number, width: number) {
  const H = 1024, W = Math.round((H * width) / (vTop - vBottom));
  const py = (v: number) => ((vTop - v) / (vTop - vBottom)) * H;
  const pxPerM = H / (vTop - vBottom);
  return canvasTexture(W, H, (ctx) => {
    const rim = py(1.95), rocks = py(0.84);
    const sky = ctx.createLinearGradient(0, 0, 0, rim);
    sky.addColorStop(0, '#cfe0f0');
    sky.addColorStop(1, '#f2f6f8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // tree canopy behind the rim
    ctx.fillStyle = '#a3b47c';
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.ellipse(rnd() * W, rim - rnd() * 0.12 * pxPerM, 0.06 * pxPerM, 0.03 * pxPerM, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // corrugated well wall: ridges every ~6.8 cm
    const period = 0.068 * pxPerM;
    for (let y = rim; y < rocks; y += period) {
      const g = ctx.createLinearGradient(0, y, 0, y + period);
      g.addColorStop(0, '#e3e8eb');
      g.addColorStop(0.45, '#b9c2c8');
      g.addColorStop(0.75, '#949ea6');
      g.addColorStop(1, '#d8dee2');
      ctx.fillStyle = g;
      ctx.fillRect(0, y, W, period + 1);
    }
    ctx.fillStyle = '#c9d0d4';
    ctx.fillRect(0, rim - 4, W, 6);
    // rock bed: pea gravel, 2–4 cm stones
    ctx.fillStyle = '#7d6f5e';
    ctx.fillRect(0, rocks, W, H - rocks);
    const stones = ['#b7a184', '#9c8a73', '#c9b89c', '#857563', '#d6c8b0', '#a89a88'];
    const area = (W * (H - rocks)) / (0.025 * pxPerM) ** 2;
    for (let i = 0; i < area * 1.4; i++) {
      const r = (0.008 + rnd() * 0.012) * pxPerM;
      ctx.fillStyle = stones[Math.floor(rnd() * stones.length)];
      ctx.beginPath();
      ctx.ellipse(rnd() * W, rocks + rnd() * (H - rocks), r, r * (0.6 + rnd() * 0.3), rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export interface WindowMaterials {
  /** white drywall for the reveal and sill */
  reveal: THREE.Material;
}

/**
 * Horizontal-slider egress window set 0.30 m deep in a drywall-wrapped reveal (no casing): thin
 * aluminium frame with a centre meeting stile, glass, a white cellular shade half drawn from a head
 * rail, and an unlit "outside" plane so the opening reads as daylight. Children are built in the
 * wall's (u, v, out) frame; add the group to the wall's group so the cutaway hides it with the wall.
 */
export function buildWindow(w: WallDef, m: Palette, mats: WindowMaterials) {
  const { u0, u1, v0, v1 } = WINDOW;
  const uc = (u0 + u1) / 2;
  const g = new THREE.Group();
  g.name = 'window';
  g.applyMatrix4(wallMatrix(w));

  // reveal: jambs and head cover the slab's 12 cm hole faces and continue to the frame
  const back = -REVEAL - 0.04;
  g.add(
    boxSpan([u0 - 0.04, v0, back], [u0 + 0.002, v1, -0.002], mats.reveal),
    boxSpan([u1 - 0.002, v0, back], [u1 + 0.04, v1, -0.002], mats.reveal),
    boxSpan([u0 - 0.04, v1 - 0.002, back], [u1 + 0.04, v1 + 0.04, -0.002], mats.reveal),
    // deep drywall sill at desk height, flush with the wall: its front edge is the charcoal wall (photos 73, 150)
    boxSpan([u0 - 0.04, v0 - 0.03, back], [u1 + 0.04, v0 + 0.002, -0.002], mats.reveal),
  );

  // aluminium frame at the back of the reveal
  const frame = new THREE.MeshStandardMaterial({ color: '#c3c7cb', metalness: 0.55, roughness: 0.45 });
  const f = 0.045, fo = -REVEAL, fd = 0.06;
  g.add(
    boxSpan([u0, v0, fo - fd], [u0 + f, v1, fo], frame),
    boxSpan([u1 - f, v0, fo - fd], [u1, v1, fo], frame),
    boxSpan([u0, v0, fo - fd], [u1, v0 + f, fo], frame),
    boxSpan([u0, v1 - f, fo - fd], [u1, v1, fo], frame),
    // meeting stiles of the two sashes, slightly offset in depth like a slider
    boxSpan([uc - 0.035, v0, fo - 0.03], [uc + 0.002, v1, fo + 0.005], frame),
    boxSpan([uc - 0.002, v0, fo - 0.06], [uc + 0.035, v1, fo - 0.025], frame),
  );

  const glassMat = (m.glass as THREE.MeshStandardMaterial).clone();
  glassMat.color.set('#a9b6c0');
  glassMat.opacity = 0.14;
  glassMat.depthWrite = false;
  const glass = mesh(new THREE.PlaneGeometry(u1 - u0 - 2 * f, v1 - v0 - 2 * f), glassMat, 'glass');
  glass.position.set(uc, (v0 + v1) / 2, fo - 0.03);
  glass.castShadow = false;
  g.add(glass);

  // the view out: unlit and bright, just behind the glass and hidden by the reveal at its edges
  const vb = v0 - 0.2, vt = v1 + 0.1, ow = u1 - u0 + 0.3;
  const outsideMat = new THREE.MeshBasicMaterial({ map: outsideTexture(vb, vt, ow) });
  outsideMat.color.setScalar(1.35);
  const outside = mesh(new THREE.PlaneGeometry(ow, vt - vb), outsideMat, 'outside');
  outside.position.set(uc, (vb + vt) / 2, -REVEAL - 0.15);
  outside.castShadow = outside.receiveShadow = false;
  g.add(outside);

  // cellular shade: head rail, pleated fabric glowing with the daylight behind it, bottom rail
  const shadeWhite = new THREE.MeshStandardMaterial({ color: '#f3f1ec', roughness: 0.6 });
  const fabricH = v1 - 0.05 - SHADE_BOTTOM;
  const pleats = pleatTexture(Math.round(fabricH / 0.024));
  const fabricMat = new THREE.MeshStandardMaterial({
    color: '#f4f2ed', map: pleats, emissive: '#fff6e8', emissiveMap: pleats, emissiveIntensity: 0.55,
    roughness: 0.95, transparent: true, opacity: 0.94, side: THREE.DoubleSide,
  });
  const fabric = mesh(new THREE.PlaneGeometry(u1 - u0 - 0.02, fabricH), fabricMat, 'shade');
  fabric.position.set(uc, SHADE_BOTTOM + fabricH / 2, SHADE_OUT);
  fabric.castShadow = false;
  g.add(
    fabric,
    boxSpan([u0 + 0.005, v1 - 0.05, SHADE_OUT - 0.03], [u1 - 0.005, v1 - 0.002, SHADE_OUT + 0.03], shadeWhite),
    boxSpan([u0 + 0.01, SHADE_BOTTOM - 0.02, SHADE_OUT - 0.015], [u1 - 0.01, SHADE_BOTTOM, SHADE_OUT + 0.015], shadeWhite),
  );
  return g;
}

/** Daylight from the glass (below the shade it is unobstructed; the shade passes some through) */
export function windowLight(w: WallDef, intensity: number) {
  const { u0, u1, v0, v1 } = WINDOW;
  const rect = new THREE.RectAreaLight('#e6eefa', intensity, u1 - u0 - 0.1, v1 - v0 - 0.1);
  const m = wallMatrix(w);
  rect.position.set((u0 + u1) / 2, (v0 + v1) / 2, -REVEAL + 0.02).applyMatrix4(m);
  rect.lookAt(rect.position.clone().add(w.n));
  rect.name = 'window-daylight';
  return rect;
}
