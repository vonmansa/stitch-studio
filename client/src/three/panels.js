import { draftPiece, pieceSegments } from '../fit/patternDraft.js';
import { draftTopPanels } from '../fit/topDraft.js';
import { limbAtY } from './body.js';

// Builds a garment the way CLO does: each flat pattern piece becomes a
// triangulated cloth panel whose rest shape IS the flat pattern, the
// panels are arranged around the body, and virtual seams join matching
// edges for the simulation to pull closed.

const SPACING = 1.0; // inches between cloth vertices
const GAP = 0.6; // initial clearance off the body when arranging pieces

// ---- Geometry helpers ----

function cubicPoint(s, t) {
  const u = 1 - t;
  const k = [u ** 3, 3 * u * u * t, 3 * u * t * t, t ** 3];
  return {
    x: k[0] * s.p0.x + k[1] * s.c1.x + k[2] * s.c2.x + k[3] * s.p1.x,
    y: k[0] * s.p0.y + k[1] * s.c1.y + k[2] * s.c2.y + k[3] * s.p1.y,
  };
}

function cubicLength(s) {
  let len = 0;
  let prev = s.p0;
  for (let i = 1; i <= 24; i++) {
    const p = cubicPoint(s, i / 24);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
}

// Closed outline → boundary points about SPACING apart. Each point carries
// the label of the edge that starts at it.
function sampleOutline(segs) {
  const pts = [];
  for (const s of segs) {
    const n = Math.max(1, Math.round(cubicLength(s) / SPACING));
    for (let i = 0; i < n; i++) pts.push({ ...cubicPoint(s, i / n), label: s.label });
  }
  return pts;
}

// A half piece cut on the fold (x = 0 is the fold line) → the full piece.
// The fold edge itself is dropped; the right half keeps its labels with
// ":R", the mirrored left half gets ":L".
function unfold(segs) {
  const half = sampleOutline(segs);
  const centerAt = half.findIndex((p) => p.label === 'center');
  const centerEnd = (() => {
    let i = centerAt;
    while (half[(i + 1) % half.length].label === 'center') i = (i + 1) % half.length;
    return (i + 1) % half.length;
  })();
  // Open polyline from the top of the fold, around the piece, to the bottom.
  const open = [];
  for (let i = centerEnd; i !== centerAt; i = (i + 1) % half.length) open.push(half[i]);
  open.push(half[centerAt]);
  const right = open.map((p) => ({ ...p, x: Math.max(p.x, 0), label: `${p.label}:R` }));
  const left = [];
  for (let i = open.length - 2; i >= 1; i--) left.push({ x: -open[i].x, y: open[i].y, label: `${open[i - 1].label}:L` });
  right[right.length - 1].label = `${open[open.length - 2].label}:L`;
  return [...right, ...left];
}

const sided = (segs, side) => sampleOutline(segs).map((p) => ({ ...p, label: `${p.label}:${side}` }));

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function distToPolygon(x, y, poly) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - a.x - t * dx, y - a.y - t * dy));
  }
  return best;
}

// Bowyer–Watson Delaunay triangulation. O(n²), fine for a few hundred
// points per piece.
function delaunay(pts) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const size = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) * 10;
  const all = [...pts, { x: minX - size, y: minY - size }, { x: minX + 2 * size, y: minY - size }, { x: minX, y: minY + 2 * size }];
  const n = pts.length;

  const circum = (a, b, c) => {
    const [A, B, C] = [all[a], all[b], all[c]];
    const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
    const ux = ((A.x ** 2 + A.y ** 2) * (B.y - C.y) + (B.x ** 2 + B.y ** 2) * (C.y - A.y) + (C.x ** 2 + C.y ** 2) * (A.y - B.y)) / d;
    const uy = ((A.x ** 2 + A.y ** 2) * (C.x - B.x) + (B.x ** 2 + B.y ** 2) * (A.x - C.x) + (C.x ** 2 + C.y ** 2) * (B.x - A.x)) / d;
    return { a, b, c, x: ux, y: uy, r2: (A.x - ux) ** 2 + (A.y - uy) ** 2 };
  };

  let tris = [circum(n, n + 1, n + 2)];
  for (let k = 0; k < n; k++) {
    const p = all[k];
    const bad = [];
    const keep = [];
    for (const t of tris) ((p.x - t.x) ** 2 + (p.y - t.y) ** 2 < t.r2 ? bad : keep).push(t);
    const edges = new Map();
    for (const t of bad) {
      for (const [u, v] of [
        [t.a, t.b],
        [t.b, t.c],
        [t.c, t.a],
      ]) {
        const key = u < v ? `${u},${v}` : `${v},${u}`;
        edges.set(key, edges.has(key) ? null : [u, v]);
      }
    }
    tris = keep;
    for (const e of edges.values()) if (e) tris.push(circum(e[0], e[1], k));
  }
  return tris.filter((t) => t.a < n && t.b < n && t.c < n).map((t) => [t.a, t.b, t.c]);
}

// Flat outline → cloth panel: boundary points plus a hexagonal grid of
// interior points, triangulated; triangles outside the outline (in
// concave parts like the crotch curve) are dropped.
function triangulate(outline) {
  const interior = [];
  const minX = Math.min(...outline.map((p) => p.x));
  const maxX = Math.max(...outline.map((p) => p.x));
  const minY = Math.min(...outline.map((p) => p.y));
  const maxY = Math.max(...outline.map((p) => p.y));
  const rowH = SPACING * 0.866;
  for (let j = 0, y = minY + rowH / 2; y < maxY; j++, y += rowH) {
    for (let x = minX + (j % 2 ? SPACING / 2 : 0); x < maxX; x += SPACING) {
      if (pointInPolygon(x, y, outline) && distToPolygon(x, y, outline) > SPACING * 0.45) interior.push({ x, y });
    }
  }
  const pts = [...outline, ...interior];
  const tris = delaunay(pts).filter(([a, b, c]) => {
    const cx = (pts[a].x + pts[b].x + pts[c].x) / 3;
    const cy = (pts[a].y + pts[b].y + pts[c].y) / 3;
    return pointInPolygon(cx, cy, outline);
  });
  return { pts, tris };
}

// ---- Garment pieces: outline, arrangement around the body, region tags ----

function wrapOnEllipse(cx, cz, rx, rz, angle) {
  return [cx + (rx + GAP) * Math.cos(angle), cz + (rz + GAP) * Math.sin(angle)];
}

function pantsPieces(g, body) {
  const front = draftPiece(g, 'front');
  const back = draftPiece(g, 'back');
  const waistY = body.levels.crotchY - 0.5 + g.rise;
  const crotchY = waistY - g.rise;

  const tag = (y) => {
    if (y < g.rise * 0.3) return 'waist';
    if (y < g.rise) return 'hip';
    const t = (y - g.rise) / g.inseam;
    return t < 0.25 ? 'thigh' : t < 0.7 ? 'knee' : 'legHem';
  };

  // Front pieces wrap the front of the body, backs the back (z mirrored).
  // Above the crotch a piece wraps the hips, measured from center front;
  // below, it wraps its leg, measured from the crease. The crotch
  // extension (x < 0) tucks under the body toward the other piece.
  const arrange = (piece, s, zSign) => (x, y) => {
    const Y = waistY - y;
    const hip = () => {
      const [cx, cz, rx, rz] = limbAtY(body.torso, Math.max(Y, crotchY));
      if (x < 0) return [cx, Y, cz + (rz + GAP + x) * 1];
      const R = (rx + rz) / 2 + GAP;
      const [X, Z] = wrapOnEllipse(cx, cz, rx, rz, Math.PI / 2 - (s * x) / R);
      return [X, Y, Z];
    };
    const leg = () => {
      const [cx, cz, rx, rz] = limbAtY(body.legs[s > 0 ? 1 : 0], Y);
      const R = (rx + rz) / 2 + GAP;
      const [X, Z] = wrapOnEllipse(cx, cz, rx, rz, Math.PI / 2 - (s * (x - piece.crease)) / R);
      return [X, Y, Z];
    };
    const band = 2.5;
    let p;
    if (Y >= crotchY + band) p = hip();
    else if (Y <= crotchY) p = leg();
    else {
      const t = (Y - crotchY) / band;
      const a = hip();
      const b = leg();
      p = a.map((v, i) => b[i] + (v - b[i]) * t);
    }
    return [p[0], p[1], p[2] * zSign];
  };

  const pieces = [];
  for (const [side, s] of [
    ['R', 1],
    ['L', -1],
  ]) {
    pieces.push({ name: `front${side}`, outline: sided(pieceSegments(front), side), arrange: arrange(front, s, 1), tag: (x, y) => tag(y) });
    pieces.push({ name: `back${side}`, outline: sided(pieceSegments(back), side), arrange: arrange(back, s, -1), tag: (x, y) => tag(y) });
  }
  const seams = [];
  for (const side of ['R', 'L']) {
    seams.push([`front${side}`, `side:${side}`, `back${side}`, `side:${side}`]);
    seams.push([`front${side}`, `inseam:${side}`, `back${side}`, `inseam:${side}`]);
  }
  seams.push(['frontR', 'crotch:R', 'frontL', 'crotch:L']);
  seams.push(['backR', 'crotch:R', 'backL', 'crotch:L']);
  return { pieces, seams, pinLabels: ['waist:R', 'waist:L'] };
}

function topPieces(type, g, body, arm) {
  const draft = draftTopPanels(type, g);
  const neckY = body.levels.neckBaseY + 0.3;
  const { armY, capHeight, sleeveLength } = draft.levels;
  const waistY = Math.min(Math.max(armY + 3, g.length * 0.58), g.length - 2);
  const bodyTag = (x, y) => {
    // The neckline and the band just below it (where a collar or
    // neckband attaches) count as neck; the rest of the top edge is shoulder.
    if (y < 3.2 && Math.abs(x) < g.neck / 6 + 1.5) return 'neck';
    if (y < 1.6) return 'shoulder';
    if (y < armY + 1) return 'chest';
    return y < waistY ? 'topWaist' : 'topHem';
  };

  // Body pieces wrap the torso: front from center front, back from
  // center back, each side's side seam landing near the side of the body.
  const torso = (zSign) => (x, y) => {
    const Y = neckY - y;
    const [cx, cz, rx, rz] = limbAtY(body.torso, Y);
    const R = (rx + rz) / 2 + GAP;
    const [X, Z] = wrapOnEllipse(cx, cz, rx, rz, Math.PI / 2 - x / R);
    return [X, Y, Z * zSign];
  };

  // Sleeves wrap their arm: the center line along the top of the arm,
  // the front half of the sleeve toward the front of the body.
  const sleeve = (s) => {
    const { root, dir } = body.arms[s > 0 ? 1 : 0];
    const ex = [-dir[1], dir[0], 0];
    const up = s > 0 ? ex : ex.map((v) => -v);
    const t0 = Math.max(-1, (s * (g.shoulder / 2) * 0.95 - root[0]) / dir[0]);
    return (x, y) => {
      const along = t0 + y * 0.9;
      const r = arm.radiusAt(s, along) + GAP;
      const th = -x / r;
      return [0, 1, 2].map((i) => root[i] + dir[i] * along + up[i] * r * Math.cos(th) + (i === 2 ? r * Math.sin(th) : 0));
    };
  };
  const sleeveTag = (x, y) => {
    if (y < capHeight * 0.75) return 'cap';
    if (y < capHeight + 3) return 'bicep';
    return y > sleeveLength - 3 ? 'cuff' : 'sleeve';
  };

  const pieces = [
    { name: 'front', outline: unfold(draft.front), arrange: torso(1), tag: bodyTag, armhole: true },
    { name: 'back', outline: unfold(draft.back), arrange: torso(-1), tag: bodyTag, armhole: true },
    { name: 'sleeveR', outline: sampleOutline(draft.sleeve), arrange: sleeve(1), tag: sleeveTag },
    { name: 'sleeveL', outline: sampleOutline(draft.sleeve), arrange: sleeve(-1), tag: sleeveTag },
  ];
  const seams = [];
  for (const side of ['R', 'L']) {
    seams.push(['front', `shoulder:${side}`, 'back', `shoulder:${side}`]);
    seams.push(['front', `side:${side}`, 'back', `side:${side}`]);
    seams.push(['front', `armhole:${side}`, `sleeve${side}`, 'capFront']);
    seams.push(['back', `armhole:${side}`, `sleeve${side}`, 'capBack']);
    seams.push([`sleeve${side}`, 'underarmFront', `sleeve${side}`, 'underarmBack']);
  }
  return { pieces, seams, pinLabels: [] };
}

// ---- Assembly ----

// Kind of a constraint from its direction in the flat pattern, relative
// to the grainline (vertical): across (weft), along (warp) or bias.
function kindOf(a, b) {
  const angle = Math.abs(Math.atan2(b.y - a.y, b.x - a.x));
  const fromHorizontal = Math.min(angle, Math.PI - angle);
  if (fromHorizontal < Math.PI / 8) return 0;
  if (fromHorizontal > (3 * Math.PI) / 8) return 1;
  return 2;
}

export function buildPanelGarment(type, garment, body) {
  const arm = {
    radiusAt: (s, along) => {
      const limb = body.arms[s > 0 ? 1 : 0];
      const segs = limb.segments;
      const root = limb.root;
      for (const sg of segs) {
        const t0 = (sg.a.p[0] - root[0]) * limb.dir[0] + (sg.a.p[1] - root[1]) * limb.dir[1];
        const t = (along - t0) / sg.len;
        if (t >= 0 && t <= 1) return (sg.a.rx + (sg.b.rx - sg.a.rx) * t + sg.a.rz + (sg.b.rz - sg.a.rz) * t) / 2;
      }
      return (segs[0].a.rx + segs[0].a.rz) / 2;
    },
  };
  const { pieces, seams, pinLabels } = type === 'pants' ? pantsPieces(garment, body) : topPieces(type, garment, body, arm);

  const pos = [];
  const rest = [];
  const tags = [];
  const faces = [];
  const pairs = [];
  const edges = {}; // piece → label → ordered vertex indices
  const pinY = new Set();

  for (const piece of pieces) {
    const { pts, tris } = triangulate(piece.outline);
    const base = pos.length;
    pts.forEach((p) => {
      pos.push(piece.arrange(p.x, p.y));
      rest.push([p.x, p.y, 0]);
      tags.push(piece.tag(p.x, p.y));
    });

    // Cloth near the armhole seam is tagged so the fit map can color it
    // from the measurement check (seam pull isn't fit).
    if (piece.armhole) {
      const seamPts = piece.outline.filter((p) => p.label.startsWith('armhole'));
      pts.forEach((p, i) => {
        if (seamPts.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 1.2)) tags[base + i] = 'armhole';
      });
    }

    // Edges, in outline order, each including its end point.
    edges[piece.name] = {};
    piece.outline.forEach((p, i) => {
      const list = (edges[piece.name][p.label] ??= []);
      if (!list.length || list[list.length - 1] !== base + i) list.push(base + i);
      const next = (i + 1) % piece.outline.length;
      if (piece.outline[next].label !== p.label) list.push(base + next);
    });
    for (const label of pinLabels) for (const v of edges[piece.name][label] ?? []) pinY.add(v);

    const seen = new Set();
    const edgeTris = new Map();
    const link = (a, b, kind) => pairs.push([base + a, base + b, kind]);
    for (const [a, b, c] of tris) {
      faces.push(base + a, base + b, base + c);
      for (const [u, v, w] of [
        [a, b, c],
        [b, c, a],
        [c, a, b],
      ]) {
        const key = u < v ? `${u},${v}` : `${v},${u}`;
        if (!seen.has(key)) {
          seen.add(key);
          link(u, v, kindOf(pts[u], pts[v]));
        }
        // Bending: across each shared edge, link the two opposite corners.
        if (edgeTris.has(key)) link(edgeTris.get(key), w, 3);
        else edgeTris.set(key, w);
      }
    }
  }

  // Seams: both edges are measured by length along the edge and sewn
  // point-for-point at matching fractions, so a longer edge (a sleeve cap
  // with ease) is gathered evenly along the shorter one, as when sewing.
  // Edge direction is chosen from the arrangement (whichever pairing puts
  // the ends closest), so seams sew the right way round.
  const stitches = [];
  const dist3 = (a, b) => Math.hypot(pos[a][0] - pos[b][0], pos[a][1] - pos[b][1], pos[a][2] - pos[b][2]);
  const fractions = (list) => {
    const cum = [0];
    for (let i = 1; i < list.length; i++) {
      const a = rest[list[i - 1]];
      const b = rest[list[i]];
      cum.push(cum[i - 1] + Math.hypot(a[0] - b[0], a[1] - b[1]));
    }
    const total = cum[cum.length - 1] || 1;
    return cum.map((c) => c / total);
  };
  const sewOnto = (from, fFrom, onto, fOnto) => {
    from.forEach((v, i) => {
      const f = fFrom[i];
      let j = 0;
      while (j < onto.length - 2 && fOnto[j + 1] < f) j++;
      const w = Math.min(1, Math.max(0, (f - fOnto[j]) / (fOnto[j + 1] - fOnto[j] || 1)));
      stitches.push([v, onto[j], onto[j + 1], w]);
    });
  };
  for (const [pa, la, pb, lb] of seams) {
    const a = edges[pa]?.[la];
    let b = edges[pb]?.[lb];
    if (!a || !b || a.length < 2 || b.length < 2) continue;
    const straight = dist3(a[0], b[0]) + dist3(a[a.length - 1], b[b.length - 1]);
    const crossed = dist3(a[0], b[b.length - 1]) + dist3(a[a.length - 1], b[0]);
    if (crossed < straight) b = [...b].reverse();
    const fa = fractions(a);
    const fb = fractions(b);
    sewOnto(a, fa, b, fb);
    sewOnto(b, fb, a, fa);
  }

  return { pos, restPos: rest, tags, faces, pairs, stitches, pinY };
}
