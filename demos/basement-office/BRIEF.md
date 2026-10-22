# Basement office — reconstruction brief

Room ID: `basement-office`
Inputs: `data/captures-in/basement-office/` (House Capture 5 export, iPhone 17 Pro Max, 2026-10-22, room 0 "Basement Office")
Converted: `data/demos/basement-office/room.json` (bundle_to_room.py, floor y=0, walls on X/Z)
Photos: `data/web-assets/basement-office/photos/NNNN.jpg` (187, prepared order = room.json order)
Scan: `data/web-assets/basement-office/mesh/room-0.ply` + `room-0-colors.bin` (458k faces, photo-coloured)
Output: `demos/basement-office/` (baseline module exists; extend it, don't restart)
Viewer: `npm run dev`, http://localhost:5188/?room=basement-office; capture page `/tools/capture.html?room=basement-office`

## Evidence

- RoomPlan coverage 0.89, 187 detail photos over 463 s. Photo poses + intrinsics preserved in room.json.
- Footprint 2.49 × 4.04 m; 10 wall segments. West wall 6 (3.27 m) carries the window; east wall 9 (2.50 m)
  the door; north wall 8 (2.05 m) the closet mouth (opening u 0.24–1.78, full height to 2.02 m); walls 2–5, 7
  are the closet's own faces (shallow, 0.72 m deep). Wall 0/1 form the south end with a chamfered corner.
- Ceiling: RoomPlan says flat 2.40 m. Verify from the mesh (height histogram) — basement ceilings often step.
- Object 4 (chair at x −0.63, z −1.09) is a parked computer chair, excluded. Object 1 (table, 1.24 × 1.25 ×
  0.97 m) is the standing desk; RoomPlan's height includes the monitor(s).

## Architecture (from photos 150, 82, 161 and neighbours)

- Walls: dark charcoal paint (near-black), medium knockdown texture. White painted baseboard, ~9 cm, square top.
  Closet interior walls are light beige/off-white, not charcoal.
- Ceiling: white knockdown texture. Warm recessed can lights (one visible in photo 82 near the door; find the
  rest from upward-facing photos).
- Floor: tan/beige cut-pile carpet.
- Window (wall 6): basement egress-style, deep sill at roughly desk height (~0.72 m), sheer white curtain,
  cables and a power strip on the sill. Window casing appears white. Bright daylight in the photos.
- Door (wall 9): white six-panel door, white casing, opens to a hallway with stairs and a coat rack visible
  through it (photo 82). Model the hallway as a lit backdrop, not a room.
- Closet mouth (wall 8): open, no door, drywall-wrapped corners (no casing), ceiling continues through.

## Furniture and details

- Standing desk (object 1): black steel frame (L-foot visible in photo 150), top likely dark/black; sits
  against the window wall; monitor(s) on it. Cables everywhere — ignore.
- Ladder-style bookshelf (object 5, storage 1.19 × 1.77 × 0.42): black metal frame, warm wood shelves,
  five tiers, full of books, framed photos, plants, trinkets. Stands inside/at the closet mouth (photo 161).
- Storage objects 2 and 3 (east wall, x ≈ 1.03): one tall narrow (0.39 × 1.40), one low wide
  (0.81 × 1.00). Check photos around the door; one may be the black acoustic-panel/pegboard stack
  visible at the right of photo 82.
- Chair (object 0, by the desk): black mesh task chair (Herman Miller-style), photo 161 left edge.
- Dog bed: tan, in the closet's floor corner (photo 161). Small, optional.
- Wall art: large framed "Man-Thing" poster (red mat, dark wood frame) on the east wall beside the door
  (photos 82, 161); black acoustic panels on the wall right of the door (photo 82, right edge).
- Loose clutter to ignore: butcher-block offcut leaning on the wall, cardboard box, paint can, air purifier
  and portable power station under the desk (photo 150) unless wanted for realism.

## Verification

- Matched-camera pairs: start with photos 150 (west, desk/window), 82 (east, door), 161 (north, closet).
  `CAP_URL=http://localhost:5188 "$S/cmp_photo.sh" basement-office 150 82 161`
- Plan: `"$S/cmp.sh" plan 'room=basement-office&view=top&ppm=110'` — baseline already matches the scan outline.
- Fix the largest discrepancy first: ceiling height/steps, then desk + window sill, then shelf, then paint/light.
- Record which details are measured (RoomPlan/mesh), modeled from photos, or approximate.
