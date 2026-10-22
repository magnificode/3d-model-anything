import * as THREE from 'three';
import { mesh, place } from '../../packages/room-runtime/helpers';
import type { RoomLayout, RoomModule } from '../../packages/room-runtime/types';
import {
  acousticPanel, dogBed, floorLamp, gamingChair, ladderShelf, pineCabinet, standingDesk, walkingPad, type FurnitureMaterials,
} from './furniture';
import { buildRoom, fixed } from './index';

/**
 * Basement office, plan variant: the scanned shell with the furniture placed from the two lists below.
 * Edit them and the room reloads. The scanned room (index.ts) is the record and stays as captured.
 *
 * Room frame, metres, seen from above: +x east (toward the door wall), −z north (toward the closet),
 * the origin near the middle of the room. `at` is the piece's floor centre [x, z]. `rotY` is in
 * radians and turns the piece's own front (+z) about the vertical: 0 faces south (+z), Math.PI / 2
 * faces east, -Math.PI / 2 west, Math.PI north. The starting values copy the scanned room, where
 * RoomPlan measured a few degrees off square (−1.5908 rather than -Math.PI / 2).
 *
 * The floor clutter (air purifier, power station, butcher block, cardboard box) is left out on purpose.
 */
export const ARRANGEMENT: Placement[] = [
  { piece: 'desk', at: [-0.739, 0.69], rotY: 1.5508 },
  { piece: 'chair', at: [-0.63, 0.67], rotY: -1.5912 },
  { piece: 'ladder-shelf', at: [-0.58, -1.67], rotY: -0.02 },
  { piece: 'shelf-lamp', at: [1.033, 1.821], rotY: -1.5908 },
  { piece: 'pine-cabinet', at: [1.042, 1.056], rotY: -1.5908 },
  { piece: 'acoustic-panel', at: [1.06, 1.565], rotY: 0 },
  { piece: 'walking-pad', at: [0.22, 1.8], rotY: Math.PI },
  { piece: 'dog-bed', at: [0.3, -1.47], rotY: 0 },
];

/**
 * Pieces nobody has modeled yet: translucent boxes standing on the floor, same frame as above.
 * size is [width (local x), height, depth (local z)], e.g.
 *   { name: 'new-bookcase', size: [0.8, 1.8, 0.3], at: [-1.0, -0.5], rotY: Math.PI / 2 },
 * Knolling lists each one as "Blockout <name>" (the prefix keeps names like floor-lamp or
 * window-seat clear of the viewer's structural-name filter).
 */
export const BLOCKOUTS: Blockout[] = [];

const PIECES = {
  desk: standingDesk,
  chair: gamingChair,
  'ladder-shelf': ladderShelf,
  'shelf-lamp': floorLamp,
  'pine-cabinet': pineCabinet,
  'acoustic-panel': acousticPanel,
  'walking-pad': walkingPad,
  'dog-bed': dogBed,
};

interface Placement { piece: keyof typeof PIECES; at: [number, number]; rotY: number }
interface Blockout { name: string; size: [number, number, number]; at: [number, number]; rotY: number }

function arrange(fm: FurnitureMaterials) {
  const pieces = ARRANGEMENT.map(({ piece, at: [x, z], rotY }) => {
    // the type only checks at compile time; the dev server doesn't typecheck
    const build = PIECES[piece] as (typeof PIECES)[keyof typeof PIECES] | undefined;
    if (!build) throw new Error(`Unknown piece "${piece}" in ARRANGEMENT`);
    return build(fm, [x, 0, z], rotY);
  });
  const fill = new THREE.MeshStandardMaterial({ color: '#3d8fd6', transparent: true, opacity: 0.35, depthWrite: false });
  const outline = new THREE.LineBasicMaterial({ color: '#1d5f99' });
  const blocks = BLOCKOUTS.map(({ name, size: [w, h, d], at: [x, z], rotY }) => {
    const g = new THREE.Group();
    g.name = `blockout-${name}`;
    const body = mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), fill);
    body.castShadow = false;
    const corners = [[-w, -d], [w, -d], [w, d], [-w, d]].map(([cx, cz]) => new THREE.Vector3(cx / 2, 0.005, cz / 2));
    g.add(body, new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(corners), outline));
    return place(g, [x, 0, z], rotY);
  });
  return fixed([...pieces, ...blocks]);
}

/** Box of each placed piece in its own frame, centred and turned by its rotY for the overhead plan */
function footprints(pieces: THREE.Object3D[]): RoomLayout['objects'] {
  return pieces.map((p) => {
    const rotY = p.rotation.y;
    p.rotation.y = 0;
    p.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(p, true);
    p.rotation.y = rotY;
    p.updateMatrixWorld(true);
    const c = box.getCenter(new THREE.Vector3()).sub(p.position).applyAxisAngle(THREE.Object3D.DEFAULT_UP, rotY).add(p.position);
    const s = box.getSize(new THREE.Vector3());
    const category = p.name === 'desk' ? 'table' : p.name === 'chair' ? 'chair' : 'storage';
    return { category, center: [c.x, 0, c.z], size: [s.x, s.y, s.z], rotY };
  });
}

export const basementOfficePlan: RoomModule = {
  id: 'basement-office-plan',
  label: 'Basement office (plan)',
  build: () => buildRoom({
    furniture: arrange,
    objects: footprints,
    note: "Plan variant: furniture placed from ARRANGEMENT in plan.ts; boxes are the modeled pieces' bounds. The scanned room is unchanged.",
  }),
};
