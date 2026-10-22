import * as THREE from 'three';
import { wallMatrix, type WallDef } from '../../packages/room-runtime/walls';
import { boxSpan, mesh } from '../../packages/room-runtime/helpers';
import type { Palette } from '../../packages/room-runtime/materials';

/** Wall 9 door opening (RoomPlan): u 0–0.702, v 0–2.076. Hinges on the south jamb (photo 161: strike plate on the north one). */
const OPENING = { u0: 0, u1: 0.702, v1: 2.076 };
const LEAF = { width: 0.665, height: 2.04, thickness: 0.035 };
/** swung into the hallway, a little past square (photo 82) */
const SWING = THREE.MathUtils.degToRad(95);
/** hallway box beyond the door (photos 82, 161): warm beige, lit, a framed poster on the far wall */
const HALL = { u0: -0.55, u1: 0.95, depth: 1.9, height: 2.4 };

/**
 * Six-panel leaf from boxes, in its own frame: hinge edge at x = 0, leaf toward −x, faces at z = 0
 * and z = thickness. Stiles and rails are full thickness; the panels are a thinner core with a
 * raised field, so each panel reads as recessed with a bevel line.
 */
function sixPanelLeaf(material: THREE.Material) {
  const { width: W, height: H, thickness: T } = LEAF;
  const g = new THREE.Group();
  g.name = 'door-leaf';
  const stile = 0.115, mid = 0.1;
  // rows bottom → top: [rail below, panel height]; the top rail closes it
  const rows: [number, number][] = [[0.22, 0.56], [0.18, 0.66], [0.12, 0.21]];
  const topRail = H - rows.reduce((s, [r, p]) => s + r + p, 0);
  const pw = (W - 2 * stile - mid) / 2;
  const recess = 0.008;
  g.add(
    boxSpan([-W, 0, recess], [0, H, T - recess], material),
    boxSpan([-W, 0, 0], [-W + stile, H, T], material),
    boxSpan([-stile, 0, 0], [0, H, T], material),
  );
  let y = 0;
  for (const [rail, ph] of rows) {
    g.add(boxSpan([-W + stile, y, 0], [-stile, y + rail, T], material));
    y += rail;
    g.add(boxSpan([-W + stile + pw, y, 0], [-stile - pw, y + ph, T], material));
    for (const x0 of [-W + stile, -stile - pw]) {
      const inset = 0.028;
      g.add(boxSpan([x0 + inset, y + inset, recess / 2], [x0 + pw - inset, y + ph - inset, T - recess / 2], material));
    }
    y += ph;
  }
  g.add(boxSpan([-W + stile, y, 0], [-stile, y + topRail, T], material));
  return g;
}

/** Brushed-nickel knob, both faces, on the latch stile */
function knob(m: Palette) {
  const g = new THREE.Group();
  g.name = 'door-knob';
  for (const side of [-1, 1]) {
    const rose = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 24).rotateX(Math.PI / 2), m.silver);
    const face = side * LEAF.thickness / 2;
    rose.position.set(0, 0, face + side * 0.005);
    const ball = mesh(new THREE.SphereGeometry(0.027, 20, 14), m.silver);
    ball.position.set(0, 0, face + side * 0.055);
    const neck = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 12).rotateX(Math.PI / 2), m.silver);
    neck.position.set(0, 0, face + side * 0.03);
    g.add(rose, ball, neck);
  }
  return g;
}

function hallway() {
  const g = new THREE.Group();
  g.name = 'hallway';
  const { u0, u1, depth, height } = HALL;
  const basic = (color: string) => new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  // BoxGeometry groups: +x (south wall), −x (north wall), +y ceiling, −y floor, +z (room side: open), −z far wall
  const faces = [basic('#cfae76'), basic('#e2c487'), basic('#eedcb2'), basic('#8d775a'), new THREE.MeshBasicMaterial({ visible: false }), basic('#dcbd82')];
  // starts inside the slab (a face at the wall plane would z-fight through it); the threshold covers the floor gap
  const back = -0.03;
  const box = mesh(new THREE.BoxGeometry(u1 - u0, height, depth), faces, 'hallway-box');
  box.position.set((u0 + u1) / 2, height / 2, back - depth / 2);
  box.castShadow = box.receiveShadow = false;
  g.add(box);
  // framed poster on the far wall (photo 82), and the far wall's white baseboard
  const far = back - depth;
  const flat = (color: string) => new THREE.MeshBasicMaterial({ color });
  const parts = [
    boxSpan([-0.12, 0.95, far], [0.5, 1.9, far + 0.025], flat('#3a2a22')),
    boxSpan([-0.08, 0.99, far + 0.025], [0.46, 1.86, far + 0.03], flat('#9c3a33')),
    boxSpan([-0.03, 1.05, far + 0.03], [0.41, 1.8, far + 0.035], flat('#4a5440')),
    boxSpan([u0, 0, far], [u1, 0.09, far + 0.012], flat('#efe8da')),
  ];
  for (const p of parts) p.castShadow = p.receiveShadow = false;
  g.add(...parts);
  return g;
}

/** White six-panel door standing open into a lit hallway backdrop; built in wall 9's (u, v, out) frame */
export function buildDoor(w: WallDef, m: Palette, doorPaint: THREE.Material, trim: THREE.Material) {
  const g = new THREE.Group();
  g.name = 'door';
  g.applyMatrix4(wallMatrix(w));
  // jamb liners (the slab's own hole faces read dark) and a carpet threshold across the slab
  const { u0, u1, v1 } = OPENING, t = w.thickness, j = 0.016;
  const threshold = mesh(new THREE.PlaneGeometry(u1 - u0, t + 0.01).rotateX(-Math.PI / 2), m.carpet, 'threshold');
  threshold.position.set((u0 + u1) / 2, 0.001, -(t + 0.01) / 2);
  threshold.castShadow = false;
  g.add(
    threshold,
    boxSpan([u0, 0, -t - 0.005], [u0 + j, v1, -0.001], trim),
    boxSpan([u1 - j, 0, -t - 0.005], [u1, v1, -0.001], trim),
    boxSpan([u0, v1 - j, -t - 0.005], [u1, v1, -0.001], trim),
  );
  const pivot = new THREE.Group();
  pivot.name = 'door-hinge';
  // hinge on the hallway face of the south jamb; the leaf closes into the opening
  pivot.position.set(u1 - j, 0.01, -t - 0.005);
  pivot.rotation.y = -SWING;
  pivot.add(sixPanelLeaf(doorPaint));
  const k = knob(m);
  k.position.set(-LEAF.width + 0.065, 0.92, LEAF.thickness / 2);
  pivot.add(k);
  g.add(pivot, hallway());
  return g;
}
