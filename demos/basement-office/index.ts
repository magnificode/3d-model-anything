import * as THREE from 'three';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import scan from '../../data/demos/basement-office/room.json';
import { buildWall, type Opening, type WallDef } from '../../packages/room-runtime/walls';
import { box, boxUV, mesh, place } from '../../packages/room-runtime/helpers';
import { loadTextures, materials } from '../../packages/room-runtime/materials';
import { batchStatic } from '../../packages/room-runtime/batch';
import type { BuiltRoom, PhotoPose, RoomModule, V3 } from '../../packages/room-runtime/types';

/**
 * Basement office, baseline from the 2026-10-22 House Capture scan (room 0, iPhone 17 Pro Max).
 *
 * Measured (RoomPlan): floor polygon, ten wall segments, window / door / opening spans, object
 * bounding boxes. Schematic: furniture is drawn as its bounding box only; materials are stand-ins.
 * Ceiling height is RoomPlan's flat 2.40 m until the mesh/photos say otherwise.
 */
export const CEILING = 2.4;
const WALL_THICKNESS = 0.12;

const v3 = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
export const polygon = scan.polygon as [number, number][];

export function insideRoom(x: number, z: number) {
  let hit = false;
  for (let i = 0; i < polygon.length; i++) {
    const [x1, z1] = polygon[i], [x2, z2] = polygon[(i + 1) % polygon.length];
    if (z1 > z !== z2 > z && x < x1 + ((z - z1) * (x2 - x1)) / (z2 - z1)) hit = !hit;
  }
  return hit;
}

/** RoomPlan walls → WallDefs (origin: interior face, left end, floor; n into the room). */
export const WALLS: WallDef[] = scan.walls.map((w) => {
  const u = v3(w.u), origin = v3(w.origin), n = v3(w.n);
  // slab overrun past an end only when that end is an outside corner (probe just past the end, slightly behind the face)
  const endExt = (p: THREE.Vector3, dir: THREE.Vector3) => {
    const probe = p.clone().addScaledVector(dir, 0.08).addScaledVector(n, -0.02);
    return insideRoom(probe.x, probe.z) ? 0 : WALL_THICKNESS;
  };
  const end = origin.clone().addScaledVector(u, w.length);
  const openings: Opening[] = w.openings.map((o) => ({
    kind: 'rect', u0: o.u0, u1: o.u1, v0: o.v0, v1: Math.min(o.v1, CEILING - 0.02), casing: o.kind !== 'opening',
  }));
  // the runtime only gaps the baseboard for cased openings; an uncased floor-level opening
  // (the closet mouth on wall 8) still needs the gap
  const baseboardGaps: [number, number][] = w.openings.filter((o) => o.kind === 'opening' && o.v0 <= 0.05).map((o) => [o.u0, o.u1]);
  return {
    name: `basement-office-${w.index}`,
    origin, u, n,
    length: w.length,
    thickness: WALL_THICKNESS,
    height: CEILING,
    openings,
    panels: [],
    crown: false,
    baseboardGaps,
    ext: [endExt(origin, u.clone().negate()), endExt(end, u)],
  };
});

/**
 * RoomPlan objects that are not part of the room. Index into scan.objects.
 * 4: computer chair parked in front of the closet during the scan (being moved).
 */
const EXCLUDED_OBJECTS = new Set([4]);
const ROOM_OBJECTS = scan.objects.filter((_, i) => !EXCLUDED_OBJECTS.has(i));

function flat(poly: [number, number][], y: number, material: THREE.Material, facingUp: boolean) {
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, facingUp ? -z : z)));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(facingUp ? -Math.PI / 2 : Math.PI / 2);
  boxUV(geo);
  const m = mesh(geo, material);
  m.position.y = y;
  return m;
}

/** Schematic furniture: RoomPlan's oriented bounding boxes, coloured by category. */
function furniture(m: ReturnType<typeof materials>) {
  const g = new THREE.Group();
  g.name = 'furniture-boxes';
  const byCategory: Record<string, THREE.Material> = {
    table: m.oak, chair: m.greyChair, storage: m.darkWood,
  };
  for (const o of ROOM_OBJECTS) {
    const mat = byCategory[o.category] ?? m.console;
    const b = box(o.size as V3, [0, 0, 0], mat);
    b.name = `${o.category}-box`;
    g.add(place(b, o.center as V3, o.rotY));
  }
  return g;
}

function lights() {
  const g = new THREE.Group();
  g.name = 'basement-office-lights';
  g.add(new THREE.HemisphereLight('#dfe7ef', '#d8d2c8', 1.2));
  // one overhead fixture until the photos locate the real ones
  const spot = new THREE.SpotLight('#fff2e0', 18, 7, Math.PI / 2.4, 0.6, 1.4);
  spot.position.set(0, CEILING - 0.05, 0);
  spot.target.position.set(0, 0, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0004;
  g.add(spot, spot.target);
  // window daylight (wall 6, west): soft fill from the opening
  const win = scan.walls[6], wo = win.openings[0];
  if (wo) {
    const u = v3(win.u), n = v3(win.n), origin = v3(win.origin);
    const c = origin.clone().addScaledVector(u, (wo.u0 + wo.u1) / 2).add(new THREE.Vector3(0, (wo.v0 + wo.v1) / 2, 0)).addScaledVector(n, 0.05);
    const rect = new THREE.RectAreaLight('#eaf2ff', 6, wo.u1 - wo.u0, wo.v1 - wo.v0);
    rect.position.copy(c);
    rect.lookAt(c.clone().add(n));
    g.add(rect);
  }
  return g;
}

/** LiDAR mesh from the capture, photo-coloured by the app's preview, moved into room coordinates. */
async function loadScan(onProgress?: (p: number) => void) {
  const loader = new PLYLoader();
  const geo = await loader.loadAsync('/basement-office/mesh/room-0.ply', (e) => onProgress?.(e.total ? (e.loaded / e.total) * 0.9 : 0.5));
  try {
    const buf = await (await fetch('/basement-office/mesh/room-0-colors.bin')).arrayBuffer();
    const rgb = new Uint8Array(buf);
    if (rgb.length === geo.getAttribute('position').count * 3) geo.setAttribute('color', new THREE.BufferAttribute(rgb, 3, true));
  } catch (e) {
    console.warn('basement-office: photo colours unavailable, using coverage colours', e);
  }
  geo.applyMatrix4(new THREE.Matrix4().fromArray(scan.transform.worldToRoom));
  geo.computeVertexNormals();
  const m = mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  m.name = 'basement-office-scan';
  onProgress?.(1);
  return m;
}

export async function buildBasementOffice(): Promise<BuiltRoom> {
  await loadTextures();
  const m = materials();
  const group = new THREE.Group();
  group.name = 'basement-office';

  const walls = WALLS.map((def) => ({ def, group: buildWall(def, m) }));
  const floor = flat(polygon, 0, m.carpet, true);
  floor.name = 'floor';
  floor.castShadow = false;
  const ceiling = flat(polygon, CEILING, m.ceiling, false);
  ceiling.name = 'ceiling';
  group.add(floor, ceiling, ...walls.map((w) => w.group), furniture(m));

  const photos: PhotoPose[] = scan.photos.map((p, i) => ({
    url: `/basement-office/photos/${String(i).padStart(4, '0')}.jpg`,
    position: p.position, forward: p.forward, up: p.up, fovY: p.fovY, aspect: p.aspect,
  }));

  let optimized: ReturnType<typeof batchStatic> | undefined;
  return {
    layout: {
      note: 'Baseline: RoomPlan measurements from the 2026-10-22 scan. Furniture boxes are bounds, not models.',
      polygon: scan.polygon,
      walls: scan.walls.map((w) => ({ a: w.a, b: w.b, u: w.u, length: w.length, openings: w.openings })),
      objects: ROOM_OBJECTS,
    },
    group,
    lights: lights(),
    optimize(opts) {
      if (!optimized) optimized = batchStatic(group, [...walls.map((w) => w.group), ceiling], { mergeDynamic: !!opts?.static });
      return optimized;
    },
    walls,
    ceiling: [ceiling],
    wallTop: CEILING,
    exposure: 1.1,
    walkable: (x, z) => insideRoom(x, z) && insideRoom(x + 0.2, z) && insideRoom(x - 0.2, z) && insideRoom(x, z + 0.2) && insideRoom(x, z - 0.2),
    // door is on wall 9 (east); start just inside it looking across at the desk
    camera: { orbit: [4.5, 5, 5.5], target: [0, 0.8, 0], walk: [0.8, 1.6, 0.1], walkLook: [-0.7, 1.1, 0.9] },
    environment: { center: [0, 1.3, 0], intensity: 0.9 },
    loadReference: loadScan,
    referenceAvailable: true,
    referenceKind: 'scan',
    photos,
  };
}

export const basementOffice: RoomModule = { id: 'basement-office', label: 'Basement office', build: buildBasementOffice };
