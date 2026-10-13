import { ellipseFromCirc, torsoRadiiAt } from './body.js';

// Builds a garment as one cloth mesh sized from the same finished
// measurements the 2D pattern is drafted from. For a given garment type
// the topology (vertex count, constraints, faces) never changes — only
// positions and rest lengths do — so measurement tweaks can be applied to
// a running simulation without rebuilding it.
//
// Each vertex carries a tag naming the measurement region it belongs to,
// so clicking or dragging the cloth in 3D maps back to a measurement.

const N = 40; // vertices around the torso / each leg
const SLEEVE_N = 20;
const lerp = (a, b, t) => a + (b - a) * t;

// Drag mapping per region: which measurement a sideways (width) or
// up/down (length) drag on that part of the garment changes.
export const REGION_DRAG = {
  waist: { h: 'waist', v: 'rise' },
  hip: { h: 'hip', v: 'rise' },
  thigh: { h: 'thigh', v: 'inseam' },
  knee: { h: 'knee', v: 'inseam' },
  legHem: { h: 'hem', v: 'inseam' },
  neck: { h: 'neck', v: null },
  shoulder: { h: 'shoulder', v: null },
  chest: { h: 'chest', v: 'length' },
  armhole: { h: 'chest', v: 'length' },
  topWaist: { h: 'waist', v: 'length' },
  topHem: { h: 'hem', v: 'length' },
  cap: { h: 'bicep', v: 'sleeve' },
  bicep: { h: 'bicep', v: 'sleeve' },
  sleeve: { h: 'bicep', v: 'sleeve' },
  cuff: { h: 'cuff', v: 'sleeve' },
};

function builder() {
  const pos = [];
  const tags = [];
  const pairs = []; // [a, b, kind]
  const faces = [];
  return {
    pos,
    tags,
    pairs,
    faces,
    add(p, tag) {
      pos.push(p);
      tags.push(tag);
      return pos.length - 1;
    },
    link(a, b, kind) {
      if (a != null && b != null) pairs.push([a, b, kind]);
    },
    quad(a, b, c, d) {
      const present = [a, b, c, d].filter((v) => v != null);
      if (present.length === 4) faces.push(a, b, c, a, c, d);
      // Where an opening narrows between rows (a V-neck), the corner cell
      // has three vertices; filling it keeps the edge smooth.
      else if (present.length === 3) faces.push(...present);
    },
  };
}

// Constraints for a grid of rows × columns (null = no vertex there).
// kind: 0 = across (circumference), 1 = along, 2 = shear, 3 = bend
// along the length, 4 = skip-one across. Kind 4 is as stiff as kind 0:
// without it a ring can widen under the weight of the garment hanging
// from it and slip down over the shoulders.
function gridConstraints(B, grid, closed) {
  const rows = grid.length;
  const cols = grid[0].length;
  const at = (r, c) => (r >= 0 && r < rows ? grid[r][closed ? (c + cols) % cols : c] ?? null : null);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!closed && c === cols - 1) continue;
      B.link(at(r, c), at(r, c + 1), 0);
      B.link(at(r, c), at(r + 1, c), 1);
      B.link(at(r, c), at(r + 1, c + 1), 2);
      B.link(at(r, c + 1), at(r + 1, c), 2);
      B.link(at(r, c), at(r, c + 2), 4);
      B.link(at(r, c), at(r + 2, c), 3);
      B.quad(at(r, c), at(r + 1, c), at(r + 1, c + 1), at(r, c + 1));
    }
  }
}

function ring(cx, y, cz, rx, rz, theta) {
  return [cx + rx * Math.cos(theta), y, cz + rz * Math.sin(theta)];
}

// Ring vertex i sits at angle θ = π/2 + 2πi/N: i = 0 is center front,
// N/4 the -x side, N/2 center back, 3N/4 the +x side.
const theta = (i, n = N) => Math.PI / 2 + (2 * Math.PI * i) / n;

// ---- Pants ----

const PANTS_UPPER_ROWS = 7;
const PANTS_LEG_ROWS = 22;

function pants(g, body) {
  const B = builder();
  const waistY = body.levels.crotchY - 0.5 + g.rise;
  const crotchY = waistY - g.rise;
  const hipT = 0.72;

  // Waist → crotch: one tube around the hips.
  const upper = [];
  for (let r = 0; r < PANTS_UPPER_ROWS; r++) {
    const t = r / (PANTS_UPPER_ROWS - 1);
    const circ = t <= hipT ? lerp(g.waist, g.hip, t / hipT) : g.hip * lerp(1, 1.03, (t - hipT) / (1 - hipT));
    const [rx, rz] = ellipseFromCirc(circ, 0.78);
    const tag = t < 0.3 ? 'waist' : 'hip';
    upper.push(Array.from({ length: N }, (_, i) => B.add(ring(0, lerp(waistY, crotchY, t), 0, rx, rz, theta(i)), tag)));
  }
  const bottom = upper[PANTS_UPPER_ROWS - 1];

  // The crotch seam under the body, shared by both legs (back → front).
  const half = N / 2;
  const K = half - 1;
  const [, hipRz] = ellipseFromCirc(g.hip, 0.78);
  const crotch = Array.from({ length: K }, (_, k) => {
    const t = (k + 1) / (K + 1);
    return B.add([0, crotchY - 0.4 * Math.sin(Math.PI * t), lerp(-hipRz * 0.8, hipRz * 0.8, t)], 'hip');
  });

  const legRings = [-1, 1].map((s) => {
    const rows = [];
    // Row 0 is the crotch line: the outer half comes from the hip tube,
    // the inner half is the shared crotch seam.
    rows.push(
      Array.from({ length: N }, (_, j) => {
        if (j <= half) return s < 0 ? bottom[j] : bottom[(half + j) % N];
        const k = j - half - 1;
        return s < 0 ? crotch[k] : crotch[K - 1 - k];
      })
    );
    for (let r = 1; r < PANTS_LEG_ROWS; r++) {
      const t = r / (PANTS_LEG_ROWS - 1);
      const circ = t <= 0.46 ? lerp(g.thigh, g.knee, t / 0.46) : lerp(g.knee, g.hem, (t - 0.46) / 0.54);
      const [rx, rz] = ellipseFromCirc(circ, 0.92);
      const cx = s * body.legX * lerp(1, 1.08, t);
      const y = crotchY - g.inseam * t;
      const tag = t < 0.25 ? 'thigh' : t < 0.7 ? 'knee' : 'legHem';
      const offset = s < 0 ? 0 : Math.PI; // right leg starts its ring at the back
      rows.push(Array.from({ length: N }, (_, j) => B.add(ring(cx, y, 0, rx, rz, theta(j) + offset), tag)));
    }
    return rows;
  });

  gridConstraints(B, upper, true);
  for (const rows of legRings) gridConstraints(B, rows, true);
  // A belt: the waistband is held at its height but free to slide around.
  const pinY = new Set(upper[0]);
  return { ...B, pinY, stitches: [] };
}

// ---- Tops ----

const TOP_ROWS = { neck: 0, shoulder: 2, armpit: 8, waist: 14, hem: 20 };
const SLEEVE_ROWS = 12;

function tops(type, g, body) {
  const B = builder();
  const L = body.levels;
  const neckY = L.neckBaseY + 0.3;
  const shoulderY = L.shoulderY + 0.2;
  const armpitY = neckY - (g.chest / 8 + 4);
  const waistY = neckY - Math.min(Math.max(g.length * 0.58, neckY - armpitY + 3), g.length - 2);
  const hemY = neckY - g.length;

  const [, chestRz] = ellipseFromCirc(g.chest, 0.72);
  const keys = [
    { row: TOP_ROWS.neck, y: neckY, r: ellipseFromCirc(g.neck, 0.9) },
    { row: TOP_ROWS.shoulder, y: shoulderY, r: [g.shoulder / 2, chestRz] },
    { row: TOP_ROWS.armpit, y: armpitY, r: ellipseFromCirc(g.chest, 0.72) },
    { row: TOP_ROWS.waist, y: waistY, r: ellipseFromCirc(g.waist, 0.74) },
    { row: TOP_ROWS.hem, y: hemY, r: ellipseFromCirc(g.hem, 0.76) },
  ];
  const level = (row) => {
    const i = keys.findIndex((k, n) => row >= k.row && row <= keys[n + 1]?.row);
    const a = keys[i];
    const b = keys[i + 1];
    const t = (row - a.row) / (b.row - a.row);
    return { y: lerp(a.y, b.y, t), rx: lerp(a.r[0], b.r[0], t), rz: lerp(a.r[1], b.r[1], t) };
  };

  // Front neckline: T-shirts and shirts scoop down at the front. The
  // scooped part rests on the chest, so it's sized to sit just off the
  // body there rather than to the neck measurement (which is checked at
  // the back and sides, where a collar actually grips).
  const neckDepth = type === 'tshirt' ? 3 : 2.5;
  const scoop = (row, th) => {
    if (type === 'jacket' || row > 1) return 0;
    const shape = Math.max(0, Math.sin(th)) ** 1.5;
    return neckDepth * shape * (row === 0 ? 1 : 0.45);
  };
  const ringPoint = (row, i, y, rx, rz) => {
    const th = vEdgeAngle(row, i) ?? theta(i);
    const dip = scoop(row, th);
    if (dip < 0.5) return ring(0, y, 0, rx, rz, th);
    const [brx, brz] = torsoRadiiAt(body, y - dip);
    return ring(0, y - dip, 0, Math.max(rx, brx + 0.3), Math.max(rz, brz + 0.3), th);
  };
  // A jacket's V-neck is an opening, not a dip: a wedge of front columns
  // is left out above the break point, narrowing to nothing at the break.
  const breakRow = TOP_ROWS.armpit + 1;
  const vHalfWidth = (row) => 0.6 * (1 - row / breakRow) + 0.01;
  const fromFront = (i) => {
    const d = ((theta(i) - Math.PI / 2 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
    return d;
  };
  const isNeckOpening = (row, i) => type === 'jacket' && row < breakRow && Math.abs(fromFront(i)) < vHalfWidth(row);
  // The first column either side of the opening is moved onto the V line
  // itself, so the lapel edge is straight rather than stair-stepped.
  const vEdgeAngle = (row, i) => {
    if (type !== 'jacket' || row >= breakRow) return null;
    const d = fromFront(i);
    const w = vHalfWidth(row);
    return Math.abs(d) >= w && Math.abs(d) < w + (2 * Math.PI) / N ? Math.PI / 2 + Math.sign(d) * w : null;
  };
  // Armholes: no cloth at the sides between shoulder and armpit; the
  // sleeves are stitched to the edge of these openings.
  const isArmhole = (row, i) => row >= TOP_ROWS.shoulder && row < TOP_ROWS.armpit && Math.abs(Math.cos(theta(i))) > 0.9;
  const tagFor = (row) =>
    row < TOP_ROWS.shoulder ? 'neck' : row === TOP_ROWS.shoulder ? 'shoulder' : row <= TOP_ROWS.armpit + 1 ? 'chest' : row <= 16 ? 'topWaist' : 'topHem';

  const torso = [];
  for (let row = 0; row <= TOP_ROWS.hem; row++) {
    const { y, rx, rz } = level(row);
    torso.push(
      Array.from({ length: N }, (_, i) =>
        isArmhole(row, i) || isNeckOpening(row, i) ? null : B.add(ringPoint(row, i, y, rx, rz), tagFor(row))
      )
    );
  }
  gridConstraints(B, torso, true);

  // Across a jacket's V opening, an invisible link per row keeps the
  // neckline acting as a closed loop (as the buttoned front and back neck
  // do on a real jacket); without it the front could spread open and the
  // jacket would slide off the shoulders.
  for (const row of torso) {
    const gapStart = row.findIndex((v, i) => v != null && row[(i + 1) % N] == null);
    if (gapStart < 0 || row.every((v, i) => v != null || !isNeckOpening(torso.indexOf(row), i))) continue;
    let gapEnd = (gapStart + 1) % N;
    while (row[gapEnd] == null) gapEnd = (gapEnd + 1) % N;
    B.link(row[gapStart], row[gapEnd], 4);
  }

  // The armhole edge on each side: torso vertices bordering the opening.
  const edge = (side) => {
    const out = [];
    for (let row = TOP_ROWS.shoulder; row <= TOP_ROWS.armpit; row++) {
      for (let i = 0; i < N; i++) {
        const v = torso[row][i];
        if (v == null || Math.sign(Math.cos(theta(i))) !== side) continue;
        const near = [torso[row][(i + 1) % N], torso[row][(i + N - 1) % N], torso[row - 1]?.[i], torso[row + 1]?.[i]];
        if (near.some((n) => n === null) || row === TOP_ROWS.shoulder || row === TOP_ROWS.armpit) {
          if (Math.abs(Math.cos(theta(i))) > 0.75) out.push(v);
        }
      }
    }
    return out;
  };

  const stitches = [];
  [-1, 1].forEach((s, armIndex) => {
    const { root, dir } = body.arms[armIndex];

    // The armhole edge as an ordered loop, sorted by angle around its
    // center in the side (y, z) plane, plus its total length.
    const edgeVerts = edge(s);
    // The torso cloth along the armhole seam: colored from the chest
    // measurement in the fit map, since the seam pull there isn't fit.
    for (const v of edgeVerts) B.tags[v] = 'armhole';
    const yc = edgeVerts.reduce((sum, v) => sum + B.pos[v][1], 0) / edgeVerts.length;
    const loop = edgeVerts
      .map((v) => ({ v, angle: Math.atan2(B.pos[v][2], B.pos[v][1] - yc) }))
      .sort((a, b) => a.angle - b.angle);
    let armholeLength = 0;
    loop.forEach((e, i) => {
      const a = B.pos[e.v];
      const b = B.pos[loop[(i + 1) % loop.length].v];
      armholeLength += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    });

    // Centered on the arm, starting where the arm passes the garment's
    // shoulder point, so the sleeve begins wrapped around the arm.
    // (Slightly further down the arm than the shoulder point itself, so
    // the sleeve's top edge wraps the deltoid instead of poking up above it.)
    const t0 = Math.max(-1, (s * (g.shoulder / 2) * 0.95 - root[0]) / dir[0]) + 0.75;
    const start = [root[0] + dir[0] * t0, root[1] + dir[1] * t0, root[2]];
    // Cross-section frame: width in the arm's frontal plane, depth along z.
    const ex = [-dir[1], dir[0], 0];
    // The sleeve's top edge is as long as the armhole plus a little ease,
    // as in the 2D draft, so sewing it in doesn't drag the shoulders.
    const capCirc = armholeLength * 1.03;
    const rows = [];
    for (let r = 0; r < SLEEVE_ROWS; r++) {
      const t = r / (SLEEVE_ROWS - 1);
      const along = g.sleeve * t;
      const circ = along < 3 ? lerp(capCirc, g.bicep, along / 3) : lerp(g.bicep, g.cuff, (along - 3) / Math.max(g.sleeve - 3, 0.1));
      const [rx, rz] = ellipseFromCirc(circ, 0.85);
      const c = [start[0] + dir[0] * along, start[1] + dir[1] * along, start[2]];
      const tag = r < 2 ? 'cap' : t < 0.3 ? 'bicep' : t < 0.8 ? 'sleeve' : 'cuff';
      rows.push(
        Array.from({ length: SLEEVE_N }, (_, j) => {
          const th = (2 * Math.PI * j) / SLEEVE_N;
          return B.add(
            [c[0] + ex[0] * rx * Math.cos(th), c[1] + ex[1] * rx * Math.cos(th), c[2] + rz * Math.sin(th)],
            tag
          );
        })
      );
    }
    gridConstraints(B, rows, true);

    // Virtual stitching, matched proportionally around the seam: each
    // sleeve-edge vertex is sewn to the armhole point at the same angle,
    // and the simulation pulls the seam closed — the same idea CLO uses
    // to join pattern pieces.
    for (const v of rows[0]) {
      const angle = Math.atan2(B.pos[v][2], B.pos[v][1] - yc);
      let best = loop[0];
      for (const e of loop) {
        const diff = (x) => Math.abs(Math.atan2(Math.sin(x - angle), Math.cos(x - angle)));
        if (diff(e.angle) < diff(best.angle)) best = e;
      }
      stitches.push([v, best.v]);
    }
  });

  return { ...B, pinY: new Set(), stitches };
}

export function buildGarmentMesh(type, garment, body) {
  return type === 'pants' ? pants(garment, body) : tops(type, garment, body);
}
