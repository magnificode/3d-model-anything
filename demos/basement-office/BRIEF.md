# Basement office: reconstruction brief

Room ID: `basement-office`
Inputs: `data/captures-in/basement-office/` (House Capture 5 export, iPhone 17 Pro Max, 2026-10-22, room 0 "Basement Office")
Converted: `data/demos/basement-office/room.json` (bundle_to_room.py, floor y=0, walls on X/Z)
Photos: `data/web-assets/basement-office/photos/NNNN.jpg` (187, prepared order = room.json order)
Scan: `data/web-assets/basement-office/mesh/room-0.ply` + `room-0-colors.bin` (458k faces, photo-coloured)
Output: `demos/basement-office/`: `index.ts` (walls, paint, ceiling, lights, furniture placement),
`window.ts`, `door.ts`, `furniture.ts`, `wall-art.ts`
Viewer: `npm run dev`, http://localhost:5188/?room=basement-office; capture page `/tools/capture.html?room=basement-office`

Each detail below is marked by where it comes from: **measured** (RoomPlan or the LiDAR mesh, read with numpy
in room space), **modeled** from photos (photo indices in parentheses), or **approximate**.

## Measured

### RoomPlan

- RoomPlan coverage 0.89, 187 detail photos over 463 s. Photo poses and intrinsics are kept in room.json.
- Footprint 2.49 × 4.04 m, 10 wall segments. West wall 6 (3.27 m) carries the window; east wall 9
  (2.50 m) the door at its north end; north wall 8 (2.05 m) the closet mouth (opening u 0.24–1.78, full
  height to 2.02 m). Walls 1, 3, 4, 5 and 7 are the closet's own faces (0.72 m deep); wall 0 is the south
  end; wall 2 is the room's chamfered north-east wall between the door and the closet.
- Door opening on wall 9: u 0–0.702, v 0–2.076.
- Object boxes: `layout.objects` keeps the RoomPlan boxes. Object 4 (a computer chair parked in front of
  the closet during the scan, x −0.63, z −1.09) is excluded. Object 1 (table) is the standing desk;
  RoomPlan's height includes the monitors.

### LiDAR mesh

- **Ceiling 2.40 m, flat except one duct box.** Method: down-facing mesh vertices in room space inside the
  floor polygon, binned by height: peak 2.38–2.40 m (11.8k vertices), 2.36–2.38 (5.2k), 2.40–2.42 (3.0k);
  weighted mean ≈ 2.385 m. Scan elevations (`view=w`, `view=n`) put the solid wall top at 2.41–2.42 m.
  `CEILING = 2.40` (within 2 cm of the mesh).
- **Duct box** in the south-east ceiling corner (white in photos 22, 23): down-facing surface at
  y ≈ 2.16 (bins 2.13–2.17) over x 1.08–1.22, z 1.32–1.98; its room-facing side at x ≈ 1.06 from y 1.95 up.
  Modeled as a white-plaster box from the wall 9 face to x ≈ 1.06, y 2.16–2.40, z 1.29–2.02 (meeting the
  south wall), on wall 9's group so the cutaway hides it with that wall. Apart from it and the door and
  closet-mouth headers, nothing faces down between 2.10 and 2.34 m.
- **Window correction** (wall 6): span u 2.02–3.20, v 0.72–1.94 (wall-local). The glass sits 0.30–0.34 m
  behind the wall face (a clean depth step over that rectangle), and the backlit region ends between v 1.90
  and 2.00. RoomPlan's opening (u 2.004–3.178, v 0.719–2.002) was close: the head comes down 6 cm and the
  north edge moves 2 cm. `index.ts` replaces the RoomPlan window with `WINDOW` from `window.ts`, and
  `layout.walls` uses the same corrected opening. room.json is unchanged. The shade surface sits 5 cm
  behind the wall face down to v ≈ 1.52.
- **Light positions**: four recessed cans at (x, z) = (−0.48, 1.41), (0.47, 1.46), (0.49, −0.05),
  (−0.47, −0.04), triangulated from bright spots in the photos (`lights_from_photos.py --ceiling 2.40`,
  52 hits, each can seen in 6–13 photos, spread ≤ 3 cm).
- Furniture heights and spans where RoomPlan's boxes are wrong (details in the table below): desk top
  y 1.22 and 1.72 m wide (RoomPlan: 1.24 m), chair position (−0.63, 0.67) (RoomPlan: 0.36 m away), lamp
  shade top 1.60 (RoomPlan: 1.40), cabinet top 0.90–0.92.

## Modeled from photos

### Architecture (photos 150, 82, 161, 73 and neighbours)

- Walls 0, 2, 6, 8, 9 (the room's own faces): charcoal knockdown paint, `#2a2c30` with the palette's
  plaster normal at 0.35 (82, 150, 161). Wall 2 is not a closet face: it carries the Man-Thing poster.
- Walls 1, 3, 4, 5, 7 (closet interior): light beige plaster `#e4dccd` (161).
- Ceiling and duct box: white knockdown `#f2f0ec` (22, 82).
- Baseboard and door trim: white semi-gloss `#f4f2ee`; the baseboard has a gap across the closet mouth.
  The closet mouth has no casing (161).
- Carpet: warm tan cut pile, a clone of the palette carpet tinted `#c9b08c` (150, 161). The two photos are
  exposed differently (150 brighter and more neutral, 161 warmer and darker); the model sits between them.
- Window (73, 150): drywall-wrapped reveal 0.30 m deep, deep drywall sill flush with the wall at 0.72 m, no
  wood casing. Horizontal slider with a thin aluminium frame and an offset meeting stile; glass is the
  palette glass at 14 % opacity. White cellular shade, half drawn, pleats every ~2.4 cm. Outside: an unlit
  plane 0.15 m behind the glass painted with sky, tree, the corrugated galvanised well and the rock bed.
  Daylight from one `RectAreaLight` just inside the glass.
- Door (82, 161): runtime casing, white jamb liners, carpet threshold. White six-panel leaf
  (0.665 × 2.04 × 0.035 m) hinged on the south jamb (161 shows the strike plate on the north jamb), swung
  95° into the hallway (82), nickel knob.
- Can trims: white ring 15 cm across (sized against the 0.70 m door in 82) with an emissive lens. The
  bulbs are smart RGB (164 shows pink); modeled warm white.

### Furniture and wall items (`furniture.ts`, `wall-art.ts`)

Each piece is a named group placed with `place()` by its RoomPlan centre and `rotY`, except where the mesh
disagrees. The eight furniture pieces are tagged `userData.physics = { type: 'static' }`: they are fixed
colliders in the playground and separate items in knolling. Wall items are added to their wall's group so
the dollhouse cutaway hides them with the wall.

| Piece | Measured | Modeled from photos | Approximate |
|---|---|---|---|
| `desk` (obj 1) | Top surface y 1.22 (mesh), x −1.20…−0.36, **z −0.17…1.55: 1.72 m wide, centred z 0.69**. RoomPlan's box is 1.24 m wide and misses the north end; photo 150's matched camera puts the north column at z ≈ −0.1, beside the window. Riser y 1.30–1.34, monitor tops 1.72–1.78 (mesh). | Black laminate top, black steel side rails, crossbar, two columns on T feet running into the room (150, 124); walnut riser; a 27" monitor on the south half and an Alienware ultrawide on the north half (178); off-white keyboard with purple caps (0, 178). | Column and foot sections, screen contents (emissive canvas), monitor sizes from photo 178 proportions. |
| `chair` (obj 0) | Seat top 0.46, back top 1.30, back leaning ~14° (mesh). **Placed at (−0.63, 0.67)**, where the mesh and photos show it; RoomPlan's (−0.36, 0.93) is 0.36 m off. | Grey Secretlab Titan Evo (113, 114, 171): heathered fabric seat on a black pan, black side bolsters and back trim, black lumbar pillow, 4D armrests, five-star base, casters. | Base and armrest proportions; the real seat is fuller and rounder. |
| `ladder-shelf` (obj 5) | 1.19 wide, 1.77 tall, 0.42 deep at the floor (RoomPlan); top tier 0.17 deep (mesh). | Black A-frame, five oak tiers at 0.12 / 0.50 / 0.87 / 1.25 / 1.63 (photo 161's matched camera). Books in 12 spine colours with flat stacks; frames, a plant and a tiki mug on top; a dark box on the bottom tier (161, 68, 142, 144). | Book counts and colours (seeded scatter). |
| `shelf-lamp` (obj 2) | Shade top 1.60 (mesh); RoomPlan's 1.40 stops under the shade. Footprint ≈ 0.28 × 0.26. | Four walnut posts, base frame, shelves at 0.45 / 0.86 / 1.27, boxed tiki mugs, square linen shade (86, 22, 91, 92, 158). The shade is a yellow-white emissive clone of the palette shade (`#fff1c4`, emissive `#ffcf66` at 3); no light added. | Shelf heights; the shade has no hot core (photo 22's core is blown out to white). |
| `pine-cabinet` (obj 3) | 0.81 × 0.35 footprint (RoomPlan), top 0.90–0.92 (mesh). | Unfinished pine body, two plain doors with a 4 mm gap; on top a tissue box, candle jar, card, pink cloth, sugar skull and black case (22, 23, 159). | Clutter sizes. |
| `acoustic-panel` | Something up to 1 m tall at x 0.9–1.15, z 1.47–1.62 (mesh). | Black panel with a silver rim, on edge between the cabinet and the lamp, leaning on the cabinet (88–90, 92, 93, 159). | Height 0.8 m. |
| `walking-pad` | x 0.0–0.45, up to 1.0 m against wall 0 (mesh). | Folded EGOFIT walking pad on its end: dark belt, silver side rails (94–96, 175). | Lean angle. |
| `dog-bed` | ≈ 0.6–0.75 across, bolster up to 0.25 (mesh), closet floor east of the shelf. | Tan fleece bed: a U-shaped bolster (back to the closet wall) around a low pad (65, 161). | Shape from rounded boxes. |
| `floor-clutter` | Purifier 0.35 tall at x −1.2…−1.0, z −0.1…0.15 (mesh). | Air purifier beside the desk's north column; power station under the window (photo 150's matched camera; not in the mesh); butcher-block offcut leaning on wall 2 and a flat cardboard box in front of it (161, 34, 82). | Sizes. |
| `poster-godzilla` (wall 9) | Frame edges in the wall-relative mesh depth map at u ≈ 1.0–1.15 and 1.95–2.0. | u 1.06–2.04, v 1.17–1.87, dark wood frame (22, 23, 85). | Print content is a painted stand-in. |
| `poster-man-thing`, `light-switch` (wall 2) | — | u 0.06–0.62, v 1.03–2.18 from photos 82 and 161's matched cameras; red mat; the switch plate right of it. | Print content is a painted stand-in. |
| `engraving-gilt` (wall 6) | Corroborated only: the wall-relative mesh depth map shows a raised rectangle here; its extent was not read numerically. | Ornate frame over the monitors, u 0.56–1.40, v 1.40–2.10 from photo 178's matched camera; antique-gilt clone; sepia print. | Frame profile is flat, not carved. |
| hallway (beyond the door) | — | Unlit backdrop box (1.5 m wide, 1.9 m deep): warm beige walls, carpet floor, white baseboard, a framed poster on the far wall (82, 161). Outside the room polygon and not walkable. | Painted backdrop; coat rack, backpack and stairs not modeled. |

Not modeled: cables and the sill clutter (power strip, chargers), the microphone, speakers and desk clutter,
the pine board leaning by the lamp, the paint can and trash can by the door, the bag on the shelf.

## Approximate / unresolved

- **Chair (decided).** The chair at the desk in the mesh and photos 113, 114 and 171 is a grey Secretlab
  Titan Evo, and that is what is modeled. The black mesh chair in photos 147 and 161 is a Herman Miller
  Embody parked in front of the closet during the scan (RoomPlan object 4), excluded as a non-room object.
  Dominic's call: keep the Titan at the desk; the Embody is not modeled.
- **Large hex-perforated panel** at the right edge of photo 82: not in the LiDAR mesh (nothing tall stands
  between that camera and wall 9). It was moved during the capture, so it is not modeled. The
  silver-rimmed panel between the cabinet and the lamp, which the mesh does show, is modeled instead.
- Baseboard height: the runtime baseboard profile is 16.2 cm, the real one about 9 cm (photo 150).
  `walls.ts` was not forked.
- Hallway: a painted backdrop, not a modeled space.
- A faint seam shows at the north leg of the door casing.
- The view out of the window has weak parallax (the outside plane is 0.15 m behind the glass so it never
  shows above the wall top in the orbit view).
- Can-trim diameter (15 cm), sized against the door in one photo.
- Lamp shade: yellow-white and bright, but without the photo's blown-out core or any light spill (no light
  budget left for it). The duct box above it therefore stays white instead of lit warm (photo 22).
- Print artwork on the three posters is a stand-in painted in code.

## Lights and performance

- Light budget, 6 `THREE.Light`s: 4 shadowed `SpotLight`s at the cans (`#ffe7c8`, 55°, penumbra 0.9,
  distance 6, 1024² shadow maps), 1 window `RectAreaLight`, 1 `HemisphereLight` fill. The lamp shade and
  monitor screens are emissive only. Exposure 1.2, environment intensity 0.7.
- `optimize()` (`batchStatic` over the room group): **294 meshes before, 78 after**, measured on a fresh
  `build()` in the viewer.
- Draw calls after `optimize()` (capture page `&stats`, model only): 99 from the orbit camera, 84 from eye
  height at the south end; 19 shader programs; about 22.6k triangles.
- No `transmission` materials, no per-frame work in the module.

## Verification

Matched-camera comparisons (photo left, model from that photo's pose right) and the scan-vs-model plan:

```sh
export S=$PWD/.agents/skills/scan-to-threejs/scripts CAP_URL=http://localhost:5188 CAP_SESSION=scan-to-threejs
zsh "$S/cmp_photo.sh" basement-office 150 82 161 22 73   # west wall low, door wall, closet, east wall, window
zsh "$S/cmp.sh" plan 'room=basement-office&view=top&ppm=110'
```

- 150: desk column and T foot, purifier, power station, window sill line.
- 82: door, casing, hallway backdrop, Man-Thing poster, switch, can trim.
- 161: closet mouth, shelf tiers, dog bed, poster, butcher block, box.
- 22: Godzilla print, cabinet and clutter, lamp, duct box.
- 73: window reveal, meeting stile, shade bottom, sill.
- Plan: walls on the scan outline; desk, shelf, dog bed, cabinet, lamp, walking pad on their scan blobs.

Viewer modes checked on `?room=basement-office`: Dollhouse renders; Walk around starts (pointer lock
granted); Layout shows ten walls and five objects; Knolling lists the eight furniture pieces; Scan and
Overlay load the reference mesh (246k vertices) with no console errors. `walkable()` is true at the room
centre and on 572 of 588 grid points between x ±1.0, z −1.0…1.8 (the rest lie within its 0.2 m wall
clearance), and false 0.5 m outside each side.

There is no node-side test: importing the module needs three.js, a JSON import without an import attribute
and a DOM canvas, and the repo has no test runner. The comparisons above and the repo gates are the checks:

```sh
npx tsc -p tsconfig.json
npm run build
python3 tools/audit-public.py
python3 .agents/skills/scan-to-threejs/scripts/test_house_import.py
```

## Plan variant

`?room=basement-office-plan` is a copy of this room for trying out new layouts. It shares the walls,
window, door, wall art, lights and scan reference with the scanned room (`buildRoom()` in `index.ts`).
Only the furniture differs: `plan.ts` places it from two lists.

- `ARRANGEMENT`: one entry per modeled piece, `{ piece, at: [x, z], rotY }`. It starts as a copy of the
  scanned positions. The floor clutter is left out.
- `BLOCKOUTS`: translucent boxes for pieces nobody has modeled yet, `{ name, size: [w, h, d], at: [x, z], rotY }`.

To iterate, edit the two lists and the viewer reloads. Layout draws the overhead plan from the placed
pieces' bounds. Overlay shows the scan mesh, so you can check a layout against the real room. Knolling
lists the pieces and block-outs. The scanned room (`?room=basement-office`) is the record and stays as captured.
