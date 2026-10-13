import { seamSegments } from './patternDraft.js';
import { TOP_TYPES } from './topModel.js';

// Drafts flat pattern pieces for tops from finished garment measurements.
// Coordinates are inches; x runs outward from center front/back (x = 0),
// y runs down from the high shoulder point. Each piece is normalized at
// the end so its top-left corner is (0, 0), the format PatternSheet lays out.

const DRAFT = {
  tshirt: { armExtra: 0, capEase: 0.25, extension: 0, facing: 0, extraNeckDepth: 0.75 },
  shirt: { armExtra: 0.25, capEase: 0.75, extension: 0.75, facing: 1.25, extraNeckDepth: 0 },
  jacket: { armExtra: 0.75, capEase: 1.25, extension: 1.25, facing: 0, extraNeckDepth: 0 },
};
const BACK_NECK_DEPTH = 0.75;
const SHIRT_CUFF_DEPTH = 2.5;
const SHIRT_BLOUSING = 0.5; // extra sleeve length that drapes over the cuff
const SHIRT_CUFF_EASE = 1.5; // sleeve hem width eased/pleated into the cuff

// ---- Bézier helpers ----

const lerp = (a, b, t) => a + (b - a) * t;
const P = (x, y) => ({ x, y });

function bezierPoint(p0, c1, c2, p1, t) {
  const u = 1 - t;
  const k = [u ** 3, 3 * u * u * t, 3 * u * t * t, t ** 3];
  return P(
    k[0] * p0.x + k[1] * c1.x + k[2] * c2.x + k[3] * p1.x,
    k[0] * p0.y + k[1] * c1.y + k[2] * c2.y + k[3] * p1.y
  );
}

function bezierLength(p0, c1, c2, p1, steps = 48) {
  let len = 0;
  let prev = p0;
  for (let i = 1; i <= steps; i++) {
    const pt = bezierPoint(p0, c1, c2, p1, i / steps);
    len += Math.hypot(pt.x - prev.x, pt.y - prev.y);
    prev = pt;
  }
  return len;
}

// Unit normal at t, choosing the side that points along `toward`.
function bezierNormal(p0, c1, c2, p1, t, toward) {
  const a = bezierPoint(p0, c1, c2, p1, Math.max(0, t - 0.01));
  const b = bezierPoint(p0, c1, c2, p1, Math.min(1, t + 0.01));
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const n = [(b.y - a.y) / len, -(b.x - a.x) / len];
  return n[0] * toward[0] + n[1] * toward[1] >= 0 ? n : [-n[0], -n[1]];
}

// Increasing f on [lo, hi] → the x where f(x) = target.
function solve(f, target, lo, hi) {
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---- Piece building ----

// A path is a start point plus line/cubic segments; kept as data so the
// piece can be measured, bounded and shifted before becoming an SVG path.
function path(start) {
  const segs = [];
  const api = {
    start,
    segs,
    L(to) {
      segs.push({ to });
      return api;
    },
    C(c1, c2, to) {
      segs.push({ c1, c2, to });
      return api;
    },
  };
  return api;
}

function samplePath(p) {
  const pts = [p.start];
  let prev = p.start;
  for (const s of p.segs) {
    if (s.c1) {
      for (let i = 1; i <= 16; i++) pts.push(bezierPoint(prev, s.c1, s.c2, s.to, i / 16));
    } else {
      pts.push(s.to);
    }
    prev = s.to;
  }
  return pts;
}

// Shifts every feature so the piece's bounding box starts at (0, 0) and
// produces the SVG path string.
function finalize(piece) {
  const pts = samplePath(piece.outline);
  const minX = Math.min(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const sx = (x) => x - minX;
  const sy = (y) => y - minY;
  const f = (pt) => `${sx(pt.x).toFixed(3)} ${sy(pt.y).toFixed(3)}`;
  const { outline } = piece;
  const d = [
    `M ${f(outline.start)}`,
    ...outline.segs.map((s) => (s.c1 ? `C ${f(s.c1)} ${f(s.c2)} ${f(s.to)}` : `L ${f(s.to)}`)),
    'Z',
  ].join(' ');
  const line = (l) => l && { x1: sx(l.x1), y1: sy(l.y1), x2: sx(l.x2), y2: sy(l.y2) };

  return {
    key: piece.key,
    name: piece.name,
    cut: piece.cut,
    note: piece.note,
    path: d,
    width: Math.max(...pts.map((p) => p.x)) - minX,
    height: Math.max(...pts.map((p) => p.y)) - minY,
    grainLine: line(piece.grain),
    onFold: line(piece.onFold),
    folds: (piece.folds ?? []).map(([a, b]) => [
      [sx(a.x), sy(a.y)],
      [sx(b.x), sy(b.y)],
    ]),
    notches: (piece.notches ?? []).map((n) => ({ ...n, x: sx(n.x), y: sy(n.y) })),
    marks: (piece.marks ?? []).map((m) => ({ x: sx(m.x), y: sy(m.y) })),
    labelAt: piece.labelAt && { x: sx(piece.labelAt.x), y: sy(piece.labelAt.y) },
    rotated: piece.rotated,
  };
}

const rect = (w, h) => path(P(0, 0)).L(P(w, 0)).L(P(w, h)).L(P(0, h));

// ---- Neckline ----

// Front and back neck curves, from the side neck point (w, 0) to center.
function neckCurves(w, extraDepth) {
  const fd = w + 0.6 + extraDepth;
  const front = [P(w, 0), P(w, fd * 0.55), P(w * 0.55, fd), P(0, fd)];
  const back = [P(w, 0), P(w, BACK_NECK_DEPTH * 0.6), P(w * 0.5, BACK_NECK_DEPTH), P(0, BACK_NECK_DEPTH)];
  return { fd, front, back, frontLen: bezierLength(...front), backLen: bezierLength(...back) };
}

// Neck width chosen so the whole neckline (both halves of front and back)
// measures exactly the neck measurement.
function solveNeck(neck, extraDepth) {
  const w = solve((x) => 2 * (neckCurves(x, extraDepth).frontLen + neckCurves(x, extraDepth).backLen), neck, 0.8, 7);
  return { w, ...neckCurves(w, extraDepth) };
}

const reverse = ([p0, c1, c2, p1]) => [p1, c2, c1, p0];

// ---- Bodice (front / back) ----

function draftBodice(type, m, side) {
  const cfg = DRAFT[type];
  const isFront = side === 'front';
  const neck = solveNeck(m.neck, cfg.extraNeckDepth);
  const snp = P(neck.w, 0);
  const sp = P(m.shoulder / 2, isFront ? 1.9 : 1.4);
  const across = m.shoulder / 2 - (isFront ? 0.75 : 0.4);
  const armY = m.chest / 8 + 4 + cfg.armExtra;
  const armpit = P(Math.max(m.chest / 4, across + 0.5), armY);
  const waistY = Math.min(Math.max(armY + 3, m.length * 0.58), m.length - 2);
  const waist = P(m.waist / 4, waistY);
  const hem = P(m.hem / 4, m.length);

  const arm = [sp, P(across, lerp(sp.y, armY, 0.55)), P(across + 0.15 * (armpit.x - across), armY), armpit];
  const armholeLen = bezierLength(...arm);

  const opening = isFront && type !== 'tshirt';
  const edgeX = opening ? -(cfg.extension + cfg.facing) : 0;
  const breakY = armY + 2.5;

  const outline = path(snp).L(sp).C(arm[1], arm[2], armpit);
  for (const s of seamSegments([armpit, waist, hem])) outline.C(P(s.c1.x, s.c1.y), P(s.c2.x, s.c2.y), P(s.p1.x, s.p1.y));
  outline.L(P(edgeX, m.length));

  const features = { folds: [], marks: [] };
  let lapel = null;
  if (!isFront) {
    const [, c1, c2, end] = reverse(neck.back);
    outline.L(P(0, BACK_NECK_DEPTH)).C(c1, c2, end);
    features.onFold = { x1: 0, y1: BACK_NECK_DEPTH, x2: 0, y2: m.length };
  } else if (type === 'tshirt') {
    const [, c1, c2, end] = reverse(neck.front);
    outline.L(P(0, neck.fd)).C(c1, c2, end);
    features.onFold = { x1: 0, y1: neck.fd, x2: 0, y2: m.length };
  } else if (type === 'shirt') {
    const [, c1, c2, end] = reverse(neck.front);
    outline.L(P(edgeX, neck.fd)).L(P(0, neck.fd)).C(c1, c2, end);
    // Cut-on button placket: folds back along the extension line.
    features.folds.push([P(-cfg.extension, neck.fd), P(-cfg.extension, m.length)]);
    for (let y = neck.fd + 0.5; y < m.length - 2; y += 3.5) features.marks.push(P(0, y));
  } else {
    // Jacket: the front edge rises to the break point, then the lapel
    // extends out past it and folds back along the roll line.
    lapel = {
      breakPt: P(edgeX, breakY),
      peak: P(edgeX - 2.6, 3.4),
      notch: P(edgeX - 1.3, 2.4),
      gorge: P(neck.w * 0.35, 1.5),
    };
    outline.L(lapel.breakPt).L(lapel.peak).L(lapel.notch).L(lapel.gorge);
    features.folds.push([lapel.breakPt, P(neck.w - 0.2, 0.25)]);
    features.marks.push(P(0, breakY + 0.5), P(0, breakY + 4.5));
  }

  const armNotchT = 0.5;
  const notches = [
    { x: waist.x, y: waist.y, dir: [1, 0], double: !isFront },
    {
      ...bezierPoint(...arm, armNotchT),
      dir: bezierNormal(...arm, armNotchT, [1, -0.3]),
      double: !isFront,
    },
  ];

  const name = isFront ? 'FRONT' : 'BACK';
  const cut = !isFront
    ? 'Cut 1 on fold'
    : type === 'tshirt'
      ? 'Cut 1 on fold'
      : type === 'jacket'
        ? 'Cut 2 · interface lapel'
        : 'Cut 2';

  return {
    measures: {
      chest: armpit.x,
      waist: waist.x,
      hem: hem.x,
      shoulderX: sp.x,
      armholeLen,
      neckLen: isFront ? neck.frontLen : neck.backLen,
      neck,
      snp,
      sp,
      lapel,
      edgeX,
    },
    piece: {
      key: side,
      name,
      cut,
      outline,
      grain: { x1: armpit.x * 0.6, y1: armY + 1, x2: armpit.x * 0.6, y2: m.length - 2 },
      labelAt: P(Math.max(armpit.x * 0.3, 0.9), lerp(armY, m.length, 0.45)),
      rotated: true,
      notches,
      ...features,
    },
  };
}

// ---- Sleeve ----

function capCurves(bw, h) {
  const left = [P(-bw, h), P(-bw * 0.62, h), P(-bw * 0.38, 0), P(0, 0)];
  const right = [P(0, 0), P(bw * 0.38, 0), P(bw * 0.62, h), P(bw, h)];
  return { left, right, length: 2 * bezierLength(...left) };
}

function draftSleeve(type, m, armholeTotal) {
  const cfg = DRAFT[type];
  const bw = m.bicep / 2;
  const isShirt = type === 'shirt';
  const length = isShirt ? m.sleeve - SHIRT_CUFF_DEPTH + SHIRT_BLOUSING : m.sleeve;
  const hemW = isShirt ? m.cuff + SHIRT_CUFF_EASE : m.cuff;

  // Cap height that makes the cap exactly armhole + ease long, so the
  // sleeve sets into the armhole with the right amount of easing.
  const target = armholeTotal + cfg.capEase;
  const maxH = Math.max(1, Math.min(length - 1, bw * 2));
  const h = solve((x) => capCurves(bw, x).length, target, 0.3, maxH);
  const cap = capCurves(bw, h);
  const L = Math.max(length, h + 1);

  const outline = path(cap.left[0])
    .C(cap.left[1], cap.left[2], cap.left[3])
    .C(cap.right[1], cap.right[2], cap.right[3])
    .L(P(hemW / 2, L))
    .L(P(-hemW / 2, L));

  return {
    measures: { bicep: 2 * bw, hemW, length: L, capEase: cap.length - armholeTotal },
    piece: {
      key: 'sleeve',
      name: 'SLEEVE',
      cut: 'Cut 2',
      note: isShirt ? 'Ease or pleat the hem into the cuff' : null,
      outline,
      grain: { x1: 0, y1: h + 0.75, x2: 0, y2: L - 1 },
      labelAt: P(-bw * 0.35, lerp(h, L, 0.5)),
      rotated: L - h > bw,
      notches: [
        { ...bezierPoint(...cap.left, 0.5), dir: bezierNormal(...cap.left, 0.5, [-1, -1]) },
        { ...bezierPoint(...cap.right, 0.5), dir: bezierNormal(...cap.right, 0.5, [1, -1]), double: true },
        { x: 0, y: 0, dir: [0, -1] },
      ],
    },
  };
}

// ---- Small pieces ----

function detailPieces(type, m, { includeDetails, includePockets }, front, back) {
  const pieces = [];
  const neckline = 2 * (front.neckLen + back.neckLen);

  if (type === 'tshirt') {
    if (includeDetails) {
      const len = neckline * 0.85;
      pieces.push({
        key: 'neckband',
        name: 'NECKBAND',
        cut: 'Cut 1 · rib knit · fold lengthwise',
        note: 'Cut 85% of the neckline length — stretch it to fit as you sew',
        outline: rect(len, 2.25),
        folds: [[P(0, 1.125), P(len, 1.125)]],
        notches: [{ x: len / 2, y: 2.25, dir: [0, 1] }],
      });
    }
    if (includePockets) pieces.push(patchPocket('pocket', 'CHEST POCKET', 4.5, 5.25, 'Cut 1'));
  }

  if (type === 'shirt') {
    const ext = DRAFT.shirt.extension;
    if (includeDetails) {
      const standLen = m.neck + 2 * ext;
      pieces.push({
        key: 'collar-stand',
        name: 'COLLAR STAND',
        cut: 'Cut 2 · interface 1',
        outline: path(P(0.5, 0))
          .L(P(standLen - 0.5, 0))
          .C(P(standLen - 0.2, 0), P(standLen, 0.3), P(standLen, 0.6))
          .L(P(standLen, 1.25))
          .L(P(0, 1.25))
          .L(P(0, 0.6))
          .C(P(0, 0.3), P(0.2, 0), P(0.5, 0)),
        notches: [
          { x: standLen / 2, y: 1.25, dir: [0, 1] },
          { x: ext + front.neckLen, y: 1.25, dir: [0, 1] },
          { x: standLen - ext - front.neckLen, y: 1.25, dir: [0, 1] },
        ],
      });
      pieces.push({
        key: 'collar',
        name: 'COLLAR',
        cut: 'Cut 2 · interface 1',
        outline: path(P(0, 0)).L(P(m.neck, 0)).L(P(m.neck + 0.6, 2.75)).L(P(-0.6, 2.75)),
        notches: [{ x: m.neck / 2, y: 0, dir: [0, -1] }],
      });
      pieces.push({
        key: 'cuff',
        name: 'CUFF',
        cut: 'Cut 4 · interface 2',
        note: `Finished ${m.cuff} in around plus 1 in button overlap`,
        outline: rect(m.cuff + 1, SHIRT_CUFF_DEPTH),
        grain: { x1: 1, y1: 1.6, x2: m.cuff, y2: 1.6 },
      });
    }
    if (includePockets) pieces.push(patchPocket('pocket', 'CHEST POCKET', 5, 5.75, 'Cut 1'));
  }

  if (type === 'jacket') {
    if (includeDetails) {
      const { lapel, snp, sp, edgeX } = front;
      const toSp = Math.hypot(sp.x - snp.x, sp.y - snp.y);
      const s1 = P(snp.x + ((sp.x - snp.x) / toSp) * 1.5, snp.y + ((sp.y - snp.y) / toSp) * 1.5);
      const inner = edgeX + 3.5;
      pieces.push({
        key: 'facing',
        name: 'FRONT FACING',
        cut: 'Cut 2 · interface',
        outline: path(s1)
          .L(snp)
          .L(lapel.gorge)
          .L(lapel.notch)
          .L(lapel.peak)
          .L(lapel.breakPt)
          .L(P(edgeX, m.length))
          .L(P(inner, m.length))
          .L(P(inner, lapel.breakPt.y + 1.5))
          .C(P(inner, lapel.breakPt.y * 0.5), P(s1.x, s1.y + 2), s1),
        grain: { x1: edgeX + 1.75, y1: lapel.breakPt.y + 2, x2: edgeX + 1.75, y2: m.length - 2 },
        labelAt: P(edgeX + 1.75, lerp(lapel.breakPt.y, m.length, 0.45)),
        rotated: true,
      });
      const gorgeLen = Math.hypot(snp.x - lapel.gorge.x, snp.y - lapel.gorge.y);
      const collarLen = 2 * (back.neckLen + gorgeLen);
      pieces.push({
        key: 'collar',
        name: 'COLLAR',
        cut: 'Cut 2 (top collar + undercollar)',
        outline: path(P(0, 0)).L(P(collarLen, 0)).L(P(collarLen + 0.5, 1.4)).L(P(collarLen - 0.4, 3)).L(P(0.4, 3)).L(P(-0.5, 1.4)),
        notches: [{ x: collarLen / 2, y: 0, dir: [0, -1] }],
      });
    }
    if (includePockets) {
      pieces.push({
        key: 'flap',
        name: 'POCKET FLAP',
        cut: 'Cut 4',
        outline: path(P(0, 0))
          .L(P(6.5, 0))
          .L(P(6.5, 1.9))
          .C(P(6.5, 2.25), P(6.25, 2.5), P(5.9, 2.5))
          .L(P(0.6, 2.5))
          .C(P(0.25, 2.5), P(0, 2.25), P(0, 1.9)),
        grain: { x1: 1, y1: 1.25, x2: 5.5, y2: 1.25 },
      });
    }
  }

  return pieces;
}

function patchPocket(key, name, w, h, cut) {
  return {
    key,
    name,
    cut,
    note: 'Fold the top edge to the inside on the fold line',
    outline: path(P(0, 0)).L(P(w, 0)).L(P(w, h - 0.75)).L(P(w / 2, h)).L(P(0, h - 0.75)),
    folds: [[P(0, 1), P(w, 1)]],
  };
}

// ---- Entry point ----

export function draftTop(type, m, options) {
  const front = draftBodice(type, m, 'front');
  const back = draftBodice(type, m, 'back');
  const armholeTotal = front.measures.armholeLen + back.measures.armholeLen;
  const sleeve = draftSleeve(type, m, armholeTotal);
  const details = detailPieces(type, m, options, front.measures, back.measures);

  const sleeveOpening = type === 'shirt' ? sleeve.measures.hemW - SHIRT_CUFF_EASE : sleeve.measures.hemW;
  const sleeveLength =
    type === 'shirt' ? sleeve.measures.length + SHIRT_CUFF_DEPTH - SHIRT_BLOUSING : sleeve.measures.length;
  const checks = [
    { label: 'Chest', target: m.chest, total: 2 * (front.measures.chest + back.measures.chest) },
    { label: 'Waist', target: m.waist, total: 2 * (front.measures.waist + back.measures.waist) },
    { label: 'Hem', target: m.hem, total: 2 * (front.measures.hem + back.measures.hem) },
    { label: 'Shoulder width', target: m.shoulder, total: 2 * back.measures.shoulderX },
    type !== 'jacket' && {
      label: 'Neckline',
      target: m.neck,
      total: 2 * (front.measures.neckLen + back.measures.neckLen),
    },
    { label: 'Bicep', target: m.bicep, total: sleeve.measures.bicep },
    { label: 'Sleeve opening', target: m.cuff, total: sleeveOpening },
    { label: 'Sleeve length', target: m.sleeve, total: sleeveLength },
    {
      label: 'Sleeve cap ease (cap − armhole)',
      target: DRAFT[type].capEase,
      total: sleeve.measures.capEase,
    },
  ].filter(Boolean);

  return {
    pieces: [front.piece, back.piece, sleeve.piece, ...details].map(finalize),
    checks,
    title: `${TOP_TYPES[type].label} · chest ${m.chest} in · length ${m.length} in · sleeve ${m.sleeve} in`,
  };
}
