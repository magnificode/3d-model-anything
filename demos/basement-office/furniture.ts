import * as THREE from 'three';
import { boxSpan, cushion, cylinder, mesh, place, type V3 } from '../../packages/room-runtime/helpers';
import { mulberry32, textured, type Palette } from '../../packages/room-runtime/materials';
import { canvasTexture } from './window';

/**
 * Furniture, each piece built in its own frame (x across, y up, +z = front) and placed by its
 * RoomPlan centre and rotY with place(). Heights and depths that RoomPlan's boxes get wrong come
 * from the LiDAR mesh (room space, read with numpy); shapes, colours and counts from the photos.
 */

export function furnitureMaterials(m: Palette) {
  const mat = (color: string, roughness = 0.7, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  return {
    m,
    /** desk frame, ladder-shelf frame */
    steel: m.iron,
    /** desk top, chair frame and base, monitor shells */
    black: m.blackMatte,
    /** heathered grey fabric of the Secretlab Titan Evo (photos 113, 114, 171) */
    fabric: textured({ color: '#b4b4b8', set: 'wool', repeat: 3, normalScale: 0.8 }),
    /** walnut monitor riser and shelf-lamp frame (photos 0, 178, 86, 91) */
    walnut: m.darkWood,
    /** warm wood tiers of the ladder shelf (photos 142, 144) */
    oak: m.oak,
    /** unfinished pine cabinet (photos 22, 23, 159) */
    pine: textured({ color: '#ecd3a2', set: 'oak', repeat: 1.2, roughness: 0.75 }),
    /** butcher-block offcut (photos 161, 34) */
    butcher: textured({ color: '#e8b070', set: 'oak', repeat: 2.5, roughness: 0.6 }),
    /** the lamp's linen shade glows yellow-white (photo 22): a brighter clone of the palette shade */
    shade: (() => {
      const s = m.lampShade.clone();
      s.color.set('#fff1c4');
      s.emissive.set('#ffcf66');
      s.emissiveIntensity = 3;
      return s;
    })(),
    white: mat('#ecebe6', 0.5),
    silver: mat('#b9bcbf', 0.4, { metalness: 0.6 }),
    cardboard: mat('#b98f5e', 0.95),
    keycaps: mat('#3b3352', 0.6),
    beigeFleece: textured({ color: '#cdbba5', set: 'wool', repeat: 3 }),
    books: ['#7a2e2a', '#2f4a5e', '#d9d2c0', '#1c1c1e', '#1c1c1e', '#5b6b4a', '#b8892f', '#8c8c88', '#c8352b', '#e0b43a', '#2f7fb5', '#ece7dc']
      .map((c) => mat(c, 0.75)),
    clutter: { yellow: mat('#e9b640', 0.8), red: mat('#b8312c', 0.4), pink: mat('#ee8fb0', 0.95), green: mat('#3f8a5a', 0.6), purple: mat('#47305e', 0.7), terracotta: mat('#8a4b2c', 0.6) },
    screen: [screenMaterial(false), screenMaterial(true)],
  };
}
export type FurnitureMaterials = ReturnType<typeof furnitureMaterials>;

/** Dark editor on the left screen, a white document on the right (photo 178): emissive only, no light */
function screenMaterial(page: boolean) {
  const map = canvasTexture(512, 300, (ctx) => {
    ctx.fillStyle = '#1d2128';
    ctx.fillRect(0, 0, 512, 300);
    const rnd = mulberry32(page ? 7 : 3);
    ctx.fillStyle = '#2a303a';
    ctx.fillRect(0, 0, 70, 300);
    for (let y = 14; y < 290; y += 9) {
      ctx.fillStyle = ['#8fa7c4', '#9cc28a', '#c9c9c9', '#d0a36b'][Math.floor(rnd() * 4)];
      ctx.fillRect(84 + rnd() * 20, y, 40 + rnd() * 160, 3);
    }
    if (page) {
      ctx.fillStyle = '#f4f4f2';
      ctx.fillRect(170, 20, 200, 270);
    }
  });
  return new THREE.MeshStandardMaterial({ color: '#0c0d10', emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.9, roughness: 0.25 });
}

const named = (g: THREE.Object3D, name: string) => ((g.name = name), g);

/** Rotate a child about its own origin, then move it (for tilted parts inside a piece) */
function posed<T extends THREE.Object3D>(o: T, pos: V3, rot: [number, number, number]): T {
  o.position.set(...pos);
  o.rotation.set(...rot);
  return o;
}

/**
 * Standing desk (object 1, against wall 6, local +z into the room). Measured (mesh): top surface at
 * y 1.22 over room x −1.20…−0.36 (0.84 deep; RoomPlan's 0.97 includes the feet, 1.26 the monitors)
 * and z −0.17…1.55: 1.72 wide, so RoomPlan's 1.24 m box misses the north end (photo 150 puts the
 * north column at z ≈ −0.1, beside the window). Riser at y 1.30–1.34; monitors span the whole top,
 * tops at 1.72–1.78, leaning back. Modeled (photos 150, 124, 0, 178): black laminate top, two black
 * columns on T feet that run into the room, a crossbar, walnut riser, two 32" monitors toed in, an
 * off-white keyboard with purple caps.
 */
export function standingDesk(fm: FurnitureMaterials, center: V3, rotY: number) {
  const g = named(new THREE.Group(), 'desk');
  const TOP = 1.225, zBack = -0.465, zFront = 0.36, half = 0.86;
  g.add(boxSpan([-half, TOP - 0.025, zBack], [half, TOP, zFront], fm.black));
  // frame: side rails under the top, a crossbar between the columns, two telescoping columns on T feet
  const legX = 0.79, legZ = -0.07;
  g.add(boxSpan([-legX + 0.03, TOP - 0.085, legZ - 0.03], [legX - 0.03, TOP - 0.035, legZ + 0.03], fm.steel));
  for (const s of [-1, 1]) {
    const x = s * legX;
    g.add(
      boxSpan([x - 0.03, TOP - 0.065, zBack + 0.05], [x + 0.03, TOP - 0.025, zFront - 0.06], fm.steel),
      boxSpan([x - 0.04, 0.035, legZ - 0.035], [x + 0.04, 0.66, legZ + 0.035], fm.steel),
      boxSpan([x - 0.033, 0.66, legZ - 0.03], [x + 0.033, TOP - 0.065, legZ + 0.03], fm.steel),
      boxSpan([x - 0.035, 0, -0.43], [x + 0.035, 0.035, 0.44], fm.steel),
    );
  }
  // walnut monitor riser on two end blocks
  g.add(boxSpan([-0.82, 1.3, -0.31], [0.82, 1.33, 0.0], fm.walnut));
  for (const s of [-1, 1]) g.add(boxSpan([s * 0.8 - 0.03, TOP, -0.29], [s * 0.8 + 0.03, 1.3, -0.02], fm.walnut));
  // monitors, bottoms at 1.33, toed in, tilted back 8° (photo 178): a 27" on the south (local −x)
  // half, an Alienware ultrawide on the north half, meeting left of the keyboard
  const split = -0.15;
  for (const [s, w, h] of [[-1, 0.64, 0.47], [1, 0.88, 0.45]] as const) {
    const mon = new THREE.Group();
    const screen = mesh(new THREE.PlaneGeometry(w - 0.02, h - 0.03), fm.screen[s < 0 ? 0 : 1]);
    screen.position.set(0, h / 2 + 0.005, 0.002);
    mon.add(
      boxSpan([-w / 2, 0, -0.035], [w / 2, h, 0], fm.black),
      screen,
      boxSpan([-0.04, -0.03, -0.09], [0.04, 0.25, -0.035], fm.black),
    );
    g.add(posed(mon, [split + s * (w / 2 + 0.005), 1.33, -0.2], [-0.14, -s * 0.14, 0]));
  }
  g.add(
    boxSpan([-0.13, TOP, 0.06], [0.25, TOP + 0.03, 0.2], fm.white),
    boxSpan([-0.12, TOP + 0.03, 0.07], [0.24, TOP + 0.042, 0.19], fm.keycaps),
  );
  return place(g, center, rotY);
}

/**
 * Secretlab Titan Evo (object 0), local +z = the way it faces. Measured (mesh): seat top 0.46, back
 * top 1.30, back leaning ~14°; the chair stood at room (−0.63, 0.67) when the mesh and photos were
 * taken, not at RoomPlan's (−0.36, 0.93). Modeled (photos 113, 114, 171, 169): heathered grey seat
 * and back, black side trim and base, black lumbar pillow, 4D armrests, five-star base on casters.
 */
export function gamingChair(fm: FurnitureMaterials, center: V3, rotY: number) {
  const g = named(new THREE.Group(), 'chair');
  // five-star base and casters
  g.add(cylinder(0.05, 0.08, [0, 0.11, 0], fm.black, 16));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const leg = new THREE.Group();
    leg.add(posed(boxSpan([-0.02, -0.018, 0], [0.02, 0.018, 0.33], fm.black), [0, 0, 0], [0.12, 0, 0]));
    g.add(posed(leg, [0, 0.1, 0], [0, a, 0]));
    const caster = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.045, 12).rotateZ(Math.PI / 2), fm.black);
    g.add(posed(caster, [Math.sin(a) * 0.33, 0.03, Math.cos(a) * 0.33], [0, a, 0]));
  }
  g.add(
    cylinder(0.028, 0.24, [0, 0.27, 0], fm.silver, 16),
    boxSpan([-0.13, 0.37, -0.12], [0.13, 0.41, 0.12], fm.black),
    // seat: grey cushion on a black pan, black side bolsters
    boxSpan([-0.27, 0.39, -0.22], [0.27, 0.41, 0.28], fm.black),
    cushion([0.5, 0.07, 0.5], [0, 0.445, 0.03], 0.03, fm.fabric),
    cushion([0.05, 0.08, 0.48], [-0.255, 0.45, 0.03], 0.02, fm.black),
    cushion([0.05, 0.08, 0.48], [0.255, 0.45, 0.03], 0.02, fm.black),
  );
  // back pivots behind the seat and leans 14°; waist narrower than the shoulders, black edge trim
  const back = new THREE.Group();
  back.add(
    cushion([0.46, 0.32, 0.1], [0, 0.18, 0], 0.03, fm.fabric),
    cushion([0.54, 0.5, 0.1], [0, 0.58, 0], 0.035, fm.fabric),
    boxSpan([-0.29, 0.02, -0.07], [0.29, 0.84, -0.045], fm.black),
    cushion([0.38, 0.28, 0.11], [0, 0.17, 0.1], 0.045, fm.black),
  );
  for (const s of [-1, 1]) back.add(cushion([0.035, 0.8, 0.11], [s * 0.272, 0.43, -0.005], 0.015, fm.black));
  g.add(posed(back, [0, 0.47, -0.21], [-0.24, 0, 0]));
  // 4D armrests
  for (const s of [-1, 1]) {
    g.add(
      boxSpan([s * 0.3 - 0.025, 0.4, -0.05], [s * 0.3 + 0.025, 0.66, 0.02], fm.black),
      cushion([0.1, 0.035, 0.27], [s * 0.3, 0.675, 0.02], 0.012, fm.black),
    );
  }
  return place(g, center, rotY);
}

/**
 * Ladder bookshelf (object 5) inside the closet mouth, local +z out of the closet, back against
 * wall 1. Measured (RoomPlan): 1.19 wide, 1.77 tall, 0.42 deep at the floor; (mesh) the top tier
 * 0.17 deep; tier heights from photo 161's matched camera (about 0.38 apart, top at 1.66). Modeled (photos 161, 68, 142, 144): black steel A-frame, five
 * oak tiers, books on four of them (a seeded scatter of spines and flat stacks), frames, a plant and
 * a tiki mug on top, a dark box (monitor or printer) on the bottom tier.
 */
export function ladderShelf(fm: FurnitureMaterials, center: V3, rotY: number) {
  const g = named(new THREE.Group(), 'ladder-shelf');
  const H = 1.77, X = 0.58, zBack = -0.2, zFoot = 0.2, zTop = -0.06, bar = 0.028;
  const front = (y: number) => zFoot + (zTop - zFoot) * (y / H);
  const lean = Math.atan2(zFoot - zTop, H);
  const len = Math.hypot(zFoot - zTop, H);
  for (const s of [-1, 1]) {
    const x = s * X;
    g.add(boxSpan([x - bar / 2, 0, zBack - bar], [x + bar / 2, H, zBack], fm.steel));
    g.add(posed(boxSpan([-bar / 2, 0, -bar], [bar / 2, len, 0], fm.steel), [x, 0, zFoot], [-lean, 0, 0]));
  }
  g.add(boxSpan([-X, H - 0.04, zBack - bar], [X, H - 0.015, zBack], fm.steel));
  const tiers = [0.12, 0.5, 0.87, 1.25, 1.63];
  const T = 0.035;
  for (const y of tiers) {
    const zf = front(y + T) - 0.01;
    g.add(boxSpan([-X + bar / 2, y, zBack], [X - bar / 2, y + T, zf], fm.oak));
    for (const s of [-1, 1]) g.add(boxSpan([s * X - bar / 2, y - 0.025, zBack], [s * X + bar / 2, y, front(y)], fm.steel));
  }
  const rnd = mulberry32(5);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  /** fill [x0, x1] of a tier with upright spines and the odd flat stack, pushed to the back */
  const books = (y: number, x0: number, x1: number) => {
    const depthMax = front(y + 0.3) - zBack - 0.03;
    let x = x0;
    while (x < x1 - 0.02) {
      const r = rnd();
      if (r < 0.07) { x += 0.03 + rnd() * 0.05; continue; }
      const d = Math.min(depthMax, 0.13 + rnd() * 0.08);
      if (r < 0.17 && x1 - x > 0.25) {
        const w = 0.17 + rnd() * 0.06;
        let top = y;
        for (let i = 0, n = 3 + Math.floor(rnd() * 3); i < n; i++) {
          const t = 0.025 + rnd() * 0.03;
          g.add(boxSpan([x, top, zBack + 0.01], [x + w, top + t, zBack + 0.01 + d], pick(fm.books)));
          top += t;
        }
        x += w + 0.01;
        continue;
      }
      const t = 0.018 + rnd() * 0.035, h = 0.17 + rnd() * 0.12;
      g.add(boxSpan([x, y, zBack + 0.01], [x + t, y + h, zBack + 0.01 + d], pick(fm.books)));
      x += t + 0.001;
    }
  };
  const top = (i: number) => tiers[i] + T;
  g.add(boxSpan([-0.54, top(0), zBack + 0.02], [-0.12, top(0) + 0.27, zBack + 0.2], fm.black));
  books(top(0), -0.08, 0.55);
  books(top(1), -0.55, 0.2);
  books(top(2), -0.55, 0.55);
  books(top(3), -0.55, 0.3);
  // top tier and the free end of tier 4: frames, a plant, a tiki mug
  const y4 = top(4);
  for (const [x, w, h] of [[-0.46, 0.17, 0.14], [-0.25, 0.13, 0.17], [0.05, 0.12, 0.15]] as const) {
    g.add(posed(boxSpan([-w / 2, 0, -0.012], [w / 2, h, 0.012], fm.black), [x, y4, zBack + 0.05], [-0.12, 0, 0]));
    g.add(posed(boxSpan([-w / 2 + 0.02, 0.02, 0.012], [w / 2 - 0.02, h - 0.02, 0.014], fm.white), [x, y4, zBack + 0.05], [-0.12, 0, 0]));
  }
  g.add(
    cylinder(0.045, 0.08, [0.28, y4 + 0.04, zBack + 0.08], fm.clutter.terracotta, 12),
    place(mesh(new THREE.IcosahedronGeometry(0.08, 1), fm.clutter.green), [0.28, y4 + 0.15, zBack + 0.08]),
    cylinder(0.04, 0.14, [0.45, top(3) + 0.07, zBack + 0.1], fm.clutter.terracotta, 12),
  );
  return place(g, center, rotY);
}

/**
 * Shelf floor lamp (object 2) in the south-east corner, local +z away from wall 9. Measured (mesh):
 * shade top 1.60 (RoomPlan's 1.40 stops under the shade), footprint about 0.25 × 0.35. Modeled
 * (photos 86, 22, 91, 92, 158): four walnut posts, base frame, shelves at 0.45, 0.86 and 1.27 with
 * tiki-mug boxes, a square linen shade lit warm (emissive only: the light budget is full).
 */
export function floorLamp(fm: FurnitureMaterials, center: V3, rotY: number) {
  const g = named(new THREE.Group(), 'shelf-lamp');
  const W = 0.14, D = 0.13, zc = -0.03, p = 0.028, TOP = 1.29;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (W - p / 2), z = zc + sz * (D - p / 2);
    g.add(boxSpan([x - p / 2, 0, z - p / 2], [x + p / 2, TOP, z + p / 2], fm.walnut));
  }
  for (const y of [0.04, 0.45, 0.86, 1.27]) g.add(boxSpan([-W, y, zc - D], [W, y + 0.018, zc + D], fm.walnut));
  g.add(boxSpan([-0.16, TOP, zc - 0.15], [0.16, TOP + 0.3, zc + 0.15], fm.shade));
  // boxed tiki mugs (Innsmouth Creep, Fin Fang Foom) and a small frame
  g.add(
    boxSpan([-0.11, 0.878, zc - 0.09], [0.04, 1.08, zc + 0.08], fm.clutter.purple),
    boxSpan([0.045, 0.878, zc - 0.07], [0.12, 1.06, zc + 0.08], fm.black),
    boxSpan([-0.06, 1.08, zc - 0.08], [0.1, 1.2, zc + 0.06], fm.black),
    posed(boxSpan([-0.07, 0, -0.01], [0.07, 0.17, 0.01], fm.oak), [0, 0.88, zc - 0.1], [-0.15, 0, 0]),
  );
  return place(g, center, rotY);
}

/**
 * Two-door pine cabinet (object 3, IKEA IVAR style) against wall 9, local +z into the room.
 * Measured: RoomPlan footprint 0.81 × 0.35, (mesh) top at 0.90–0.92 under the clutter. Modeled
 * (photos 22, 23, 159, 86): unfinished pine body and two plain doors with a 4 mm gap, and the
 * clutter on top (tissue box, candle jar, card, pink cloth, sugar skull, a black case).
 */
export function pineCabinet(fm: FurnitureMaterials, center: V3, rotY: number) {
  const g = named(new THREE.Group(), 'pine-cabinet');
  const W = 0.4, H = 0.9, zb = -0.18, zf = 0.12, t = 0.018, gap = 0.004;
  g.add(
    boxSpan([-W, 0, zb], [-W + t, H - t, zf], fm.pine),
    boxSpan([W - t, 0, zb], [W, H - t, zf], fm.pine),
    boxSpan([-W, H - t, zb], [W, H, zf + t], fm.pine),
    boxSpan([-W + t, 0, zb], [W - t, H - t, zb + 0.012], fm.pine),
    boxSpan([-W + t, 0, zf - 0.04], [W - t, 0.06, zf - 0.02], fm.pine),
    boxSpan([-W + gap / 2, 0.01, zf], [-gap / 2, H - t - gap, zf + t], fm.pine),
    boxSpan([gap / 2, 0.01, zf], [W - gap / 2, H - t - gap, zf + t], fm.pine),
  );
  const y = H;
  g.add(
    boxSpan([0.2, y, -0.15], [0.32, y + 0.13, -0.03], fm.clutter.yellow),
    posed(boxSpan([-0.11, 0, -0.003], [0.11, 0.17, 0.003], fm.white), [0.02, y, -0.13], [-0.2, 0, 0]),
    cylinder(0.04, 0.09, [0.08, y + 0.045, 0.03], fm.clutter.red, 16),
    cushion([0.17, 0.05, 0.11], [-0.15, y + 0.025, 0.05], 0.024, fm.clutter.pink),
    place(mesh(new THREE.SphereGeometry(0.045, 16, 12), fm.white), [-0.34, y + 0.045, 0.04]),
    boxSpan([-0.13, y, -0.06], [0.0, y + 0.04, 0.0], fm.black),
    boxSpan([0.22, y, 0.02], [0.33, y + 0.03, 0.09], fm.clutter.green),
  );
  return place(g, center, rotY);
}

/** Thin panel standing on its foot edge, leaning `lean` rad back toward local −z (the wall behind it) */
function leaning(g: THREE.Group, lean: number) {
  const outer = new THREE.Group();
  outer.add(posed(g, [0, 0, 0], [-lean, 0, 0]));
  return outer;
}

/**
 * Black acoustic panel with a silver rim, standing in the gap between the pine cabinet and the lamp,
 * square to wall 9 and leaning on the cabinet (photos 88–90, 92, 93, 159, 22; mesh: something about
 * up to 1 m at room x 0.9–1.15, z 1.47–1.62; photo 22: its top stays below the cabinet top, so 0.8). Approximate: the large hex-perforated panel at the
 * right edge of photo 82 is not in the mesh, so it was moved during the capture; not modeled there.
 */
export function acousticPanel(fm: FurnitureMaterials, center: V3, rotY: number) {
  const g = new THREE.Group();
  const W = 0.15, H = 0.8;
  g.add(boxSpan([-W, 0.02, -0.025], [W, H - 0.02, 0.0], fm.black));
  for (const s of [-1, 1]) g.add(boxSpan([s * W - 0.02, 0, -0.03], [s * W + 0.02, H, 0.005], fm.silver));
  g.add(boxSpan([-W, H - 0.03, -0.03], [W, H, 0.005], fm.silver));
  return named(place(leaning(g, 0.12), center, rotY), 'acoustic-panel');
}

/** EGOFIT walking pad folded up on its end against wall 0 (photos 94–96, 175; mesh: x 0.0–0.45, up to 1.0 m) */
export function walkingPad(fm: FurnitureMaterials, center: V3, rotY: number) {
  const g = new THREE.Group();
  g.add(boxSpan([-0.2, 0.03, -0.07], [0.2, 1.0, 0], fm.black));
  for (const s of [-1, 1]) g.add(boxSpan([s * 0.22 - 0.03, 0, -0.09], [s * 0.22 + 0.03, 1.02, 0.01], fm.silver));
  g.add(boxSpan([-0.22, 0.96, -0.09], [0.22, 1.02, 0.01], fm.silver));
  return named(place(leaning(g, 0.13), center, rotY), 'walking-pad');
}

/** Tan bolster dog bed on the closet floor east of the shelf (photos 65, 161; mesh: 0.6–0.75 across, bolster 0.25) */
export function dogBed(fm: FurnitureMaterials, center: V3) {
  const g = named(new THREE.Group(), 'dog-bed');
  // U-shaped bolster (back to the closet wall, local −z) around a pad sunk below its top
  g.add(
    cushion([0.72, 0.08, 0.6], [0, 0.04, 0], 0.03, fm.beigeFleece),
    cushion([0.72, 0.22, 0.17], [0, 0.11, -0.215], 0.07, fm.beigeFleece),
    cushion([0.16, 0.19, 0.5], [-0.28, 0.095, 0.05], 0.07, fm.beigeFleece),
    cushion([0.16, 0.19, 0.5], [0.28, 0.095, 0.05], 0.07, fm.beigeFleece),
    cushion([0.44, 0.12, 0.12], [0, 0.06, 0.24], 0.05, fm.beigeFleece),
  );
  return place(g, center);
}

/**
 * Loose floor items seen in the photos, approximate sizes: the air purifier beside the desk's north
 * column (mesh: 0.35 tall at x −1.20…−1.0, z −0.10…0.15) and the power station under the window
 * (photo 150's matched camera; the mesh misses it), the
 * butcher-block offcut leaning on wall 2 and the flat cardboard box in front of it (photos 161, 34, 82).
 */
export function floorClutter(fm: FurnitureMaterials) {
  const g = named(new THREE.Group(), 'floor-clutter');
  g.add(
    cylinder(0.1, 0.36, [-1.1, 0.18, 0.08], fm.white, 24),
    boxSpan([-1.22, 0, -0.78], [-0.98, 0.28, -0.58], fm.black),
  );
  // wall 2 runs from (0.87, −1.25) toward the door corner (1.25, −0.48); n = (−0.9, 0, 0.435)
  const block = new THREE.Group();
  block.add(boxSpan([-0.15, 0, -0.04], [0.15, 0.6, 0], fm.butcher));
  g.add(place(leaning(block, 0.2), [0.99, 0, -0.64], -1.12));
  g.add(place(boxSpan([-0.16, 0, -0.1], [0.16, 0.08, 0.1], fm.cardboard), [0.89, 0, -0.87], -1.12));
  return g;
}
