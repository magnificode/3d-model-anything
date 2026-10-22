import * as THREE from 'three';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import scan from '../../data/demos/basement-office/room.json';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildWall, wallMatrix, type Opening, type WallDef } from '../../packages/room-runtime/walls';
import { boxSpan, boxUV, mesh } from '../../packages/room-runtime/helpers';
import { loadTextures, materials, type Palette } from '../../packages/room-runtime/materials';
import { batchStatic } from '../../packages/room-runtime/batch';
import type { BuiltRoom, PhotoPose, RoomLayout, RoomModule, V3 } from '../../packages/room-runtime/types';
import { buildDoor } from './door';
import {
  acousticPanel, dogBed, floorClutter, floorLamp, furnitureMaterials, gamingChair, ladderShelf, pineCabinet, standingDesk, walkingPad,
  type FurnitureMaterials,
} from './furniture';
import { wallArt } from './wall-art';
import { buildWindow, WINDOW, windowLight } from './window';

/**
 * Basement office, baseline from the 2026-10-22 House Capture scan (room 0, iPhone 17 Pro Max).
 *
 * Measured (RoomPlan): floor polygon, ten wall segments, door / closet-mouth spans, object bounding
 * boxes. Measured (LiDAR mesh): ceiling height, window span and reveal depth (window.ts), can-light
 * positions (photo triangulation), desk / shelf / lamp / cabinet heights. Modeled from photos: paint,
 * trim, window, door, hallway backdrop, furniture (furniture.ts) and wall art (wall-art.ts). See BRIEF.md.
 */
/** Mesh: down-facing ceiling vertices peak at 2.38–2.40 m (mean ≈ 2.385); flat except the duct box (ductBox). */
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

/** RoomPlan openings, with the window replaced by the mesh measurement (window.ts) */
function roomOpenings(w: (typeof scan.walls)[number]) {
  return w.openings.map((o) => (o.kind === 'window' ? { ...o, ...WINDOW } : o));
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
  const openings: Opening[] = roomOpenings(w).map((o) => ({
    kind: 'rect', u0: o.u0, u1: o.u1, v0: o.v0, v1: Math.min(o.v1, CEILING - 0.02),
    // the window is drywall-wrapped (window.ts builds its reveal); doors keep the runtime casing
    casing: o.kind === 'door',
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
    // wall 2's far end is the corner where wall 9's door opening starts: an overrun there would
    // stick into the doorway (wall 9's own slab already closes the corner)
    ext: [endExt(origin, u.clone().negate()), w.index === 2 ? 0 : endExt(end, u)],
  };
});

/**
 * RoomPlan objects that are not part of the room. Index into scan.objects.
 * 4: computer chair parked in front of the closet during the scan (being moved).
 */
/**
 * Closet interior faces (light beige): 1 back (west part), 3 east, 4 back, 5 step, 7 west.
 * Wall 2 is the room's chamfered north-east wall with the poster (photos 82, 161): charcoal.
 */
const CLOSET_WALLS = new Set([1, 3, 4, 5, 7]);

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

const obj = (i: number) => scan.objects[i];
const onFloor = (i: number): V3 => [obj(i).center[0], 0, obj(i).center[2]];

/** Fixed furniture: static colliders in the playground, one item each in knolling */
export function fixed(pieces: THREE.Object3D[]) {
  for (const p of pieces) p.userData.physics = { type: 'static' };
  return pieces;
}

/**
 * Furniture by RoomPlan object (index into scan.objects), each placed by its centre and rotY.
 * Exceptions from the mesh: the chair stood at (−0.63, 0.67), 0.36 m from RoomPlan's box; the desk is
 * 1.72 m wide, centred at z 0.69, where RoomPlan's box is 1.24 m and stops short of its north end.
 */
function scannedFurniture(fm: FurnitureMaterials) {
  const pieces = [
    standingDesk(fm, [obj(1).center[0], 0, 0.69], obj(1).rotY),
    gamingChair(fm, [-0.63, 0, 0.67], obj(0).rotY),
    ladderShelf(fm, onFloor(5), obj(5).rotY),
    floorLamp(fm, onFloor(2), obj(2).rotY),
    pineCabinet(fm, onFloor(3), obj(3).rotY),
    // not RoomPlan objects: positions from the mesh and photos (furniture.ts)
    acousticPanel(fm, [1.06, 0, 1.565], 0),
    walkingPad(fm, [0.22, 0, 1.8], Math.PI),
    dogBed(fm, [0.3, 0, -1.47]),
  ];
  return [...fixed(pieces), floorClutter(fm)];
}

/**
 * White duct box in the south-east ceiling corner, along wall 9 to the south wall (photos 22, 23).
 * Mesh: underside y ≈ 2.16, room face x ≈ 1.06, z 1.29–2.02; in wall 9's frame u 1.77–2.50.
 */
function ductBox(w: WallDef, material: THREE.Material) {
  const b = boxSpan([1.77, 2.16, -0.02], [2.52, CEILING, 0.145], material);
  b.applyMatrix4(wallMatrix(w));
  b.name = 'duct-box';
  return b;
}

/**
 * Recessed cans, triangulated from 52 bright-spot hits in the photos (lights_from_photos.py,
 * ceiling 2.40): each seen in 6–13 photos, spread ≤ 3 cm. Smart RGB bulbs, modeled warm white.
 */
const CANS: [number, number][] = [[-0.48, 1.41], [0.47, 1.46], [0.49, -0.05], [-0.47, -0.04]];

/** Can trims (white ring, ~15 cm across: photo 82 against the 0.70 m door) and glowing lenses, merged into two meshes */
function canFixtures(m: Palette) {
  const g = new THREE.Group();
  g.name = 'can-lights';
  // ring profile [radius, y below the ceiling]: flange, lip, then up into the can
  const ringGeo = new THREE.LatheGeometry(
    [[0.075, 0], [0.075, -0.004], [0.07, -0.007], [0.058, -0.005], [0.056, 0.01]].map(([r, y]) => new THREE.Vector2(r, y)), 40,
  );
  const lensGeo = new THREE.CircleGeometry(0.057, 40).rotateX(Math.PI / 2);
  const rings = CANS.map(([x, z]) => ringGeo.clone().translate(x, CEILING, z));
  const lenses = CANS.map(([x, z]) => lensGeo.clone().translate(x, CEILING - 0.002, z));
  const lensMat = new THREE.MeshStandardMaterial({ color: '#fff4e2', emissive: '#ffd9ad', emissiveIntensity: 2.5, roughness: 0.5 });
  // palette trim is double-sided, so the lathe's winding doesn't matter
  const ring = mesh(mergeGeometries(rings), m.trim, 'can-trims');
  const lens = mesh(mergeGeometries(lenses), lensMat, 'can-lenses');
  ring.castShadow = lens.castShadow = false;
  lens.userData.physics = { type: 'none' };
  g.add(ring, lens);
  return g;
}

/** Light budget (6): four shadowed can spots, the window's area light, one hemisphere fill. */
function lights() {
  const g = new THREE.Group();
  g.name = 'basement-office-lights';
  g.add(new THREE.HemisphereLight('#e4e6ea', '#8a8178', 1.0));
  for (const [x, z] of CANS) {
    const spot = new THREE.SpotLight('#ffe7c8', 9, 6, THREE.MathUtils.degToRad(55), 0.9, 2);
    spot.position.set(x, CEILING - 0.02, z);
    spot.target.position.set(x, 0, z);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.camera.near = 0.05;
    spot.shadow.camera.far = 6;
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.015;
    g.add(spot, spot.target);
  }
  RectAreaLightUniformsLib.init();
  g.add(windowLight(WALLS[6], 4));
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

/** What differs between the scanned room and an arrangement of it; the shell, lights and scan are shared. */
export interface RoomOptions {
  /** placed pieces, added under the 'furniture' group */
  furniture(fm: FurnitureMaterials, m: Palette): THREE.Object3D[];
  /** overhead-plan boxes, given the placed pieces */
  objects(pieces: THREE.Object3D[]): RoomLayout['objects'];
  note: string;
  camera?: BuiltRoom['camera'];
}

// door is on wall 9 (east); start just inside it looking across at the desk
const CAMERA: BuiltRoom['camera'] = { orbit: [4.5, 5, 5.5], target: [0, 0.8, 0], walk: [0.8, 1.6, 0.1], walkLook: [-0.7, 1.1, 0.9] };

export async function buildRoom(opts: RoomOptions): Promise<BuiltRoom> {
  await loadTextures();
  const m = materials();
  const group = new THREE.Group();
  group.name = 'basement-office';

  // charcoal knockdown paint (photos 82, 150, 161); the closet's own faces are light beige
  const charcoal = m.wall.clone();
  charcoal.color.set('#2a2c30');
  charcoal.normalScale.set(0.35, 0.35);
  const closetPaint = m.wall.clone();
  closetPaint.color.set('#e4dccd');
  closetPaint.normalScale.set(0.3, 0.3);
  const whitePlaster = m.ceiling.clone();
  whitePlaster.color.set('#f2f0ec');
  whitePlaster.normalScale.set(0.35, 0.35);
  // semi-gloss white trim: baseboard, door casing and jambs, door leaf
  const whiteTrim = m.trim.clone();
  whiteTrim.color.set('#f4f2ee');
  const doorPaint = whiteTrim.clone();
  doorPaint.side = THREE.FrontSide;
  // the open leaf stands in the hallway, which is lit by its own (unmodeled) light
  doorPaint.emissive.set('#5a4a36');

  const walls = WALLS.map((def, i) => {
    const material = CLOSET_WALLS.has(i) ? closetPaint : charcoal;
    return { def, group: buildWall({ ...def, material, trimMaterial: whiteTrim }, m) };
  });
  walls[6].group.add(buildWindow(WALLS[6], m, { reveal: whitePlaster }));
  // warm tan cut pile (photos 150, 161): the palette carpet reads grey-beige
  const carpet = m.carpet.clone();
  carpet.color.set('#c9b08c');
  walls[9].group.add(buildDoor(WALLS[9], { ...m, carpet }, doorPaint, whiteTrim), ductBox(WALLS[9], whitePlaster));
  // antique gilt (photo 178): darker and duller than the palette's
  const gilt = m.gilt.clone();
  gilt.color.set('#6e4c26');
  gilt.roughness = 0.5;
  for (const [i, items] of Object.entries(wallArt(WALLS, gilt, whiteTrim))) walls[+i].group.add(...items);
  const floor = flat(polygon, 0, carpet, true);
  floor.name = 'floor';
  floor.castShadow = false;
  const ceilingPlane = flat(polygon, CEILING, whitePlaster, false);
  ceilingPlane.name = 'ceiling-plane';
  const ceiling = new THREE.Group();
  ceiling.name = 'ceiling';
  ceiling.add(ceilingPlane, canFixtures(m));
  const furniture = new THREE.Group();
  furniture.name = 'furniture';
  const pieces = opts.furniture(furnitureMaterials(m), m);
  furniture.add(...pieces);
  group.add(floor, ceiling, ...walls.map((w) => w.group), furniture);

  const photos: PhotoPose[] = scan.photos.map((p, i) => ({
    url: `/basement-office/photos/${String(i).padStart(4, '0')}.jpg`,
    position: p.position, forward: p.forward, up: p.up, fovY: p.fovY, aspect: p.aspect,
  }));

  let optimized: ReturnType<typeof batchStatic> | undefined;
  return {
    layout: {
      note: opts.note,
      polygon: scan.polygon,
      walls: scan.walls.map((w) => ({ a: w.a, b: w.b, u: w.u, length: w.length, openings: roomOpenings(w) })),
      objects: opts.objects(pieces),
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
    exposure: 1.2,
    walkable: (x, z) => insideRoom(x, z) && insideRoom(x + 0.2, z) && insideRoom(x - 0.2, z) && insideRoom(x, z + 0.2) && insideRoom(x, z - 0.2),
    camera: opts.camera ?? CAMERA,
    environment: { center: [0, 1.3, 0], intensity: 0.7 },
    loadReference: loadScan,
    referenceAvailable: true,
    referenceKind: 'scan',
    photos,
  };
}

export function buildBasementOffice(): Promise<BuiltRoom> {
  return buildRoom({
    furniture: scannedFurniture,
    objects: () => ROOM_OBJECTS,
    note: 'RoomPlan measurements from the 2026-10-22 scan; window span corrected from the LiDAR mesh. Object boxes are RoomPlan bounds; the modeled furniture follows the mesh where they differ.',
  });
}

export const basementOffice: RoomModule = { id: 'basement-office', label: 'Basement office', build: buildBasementOffice };
