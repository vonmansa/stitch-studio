// Drafts flat front/back pant pieces from finished garment measurements.
// Coordinates are in inches: y runs down from the waist, the crotch
// extension points toward negative x and the side seam toward positive x.
//
// This is a simplified classic trouser draft: circumferences are split
// between front and back (back gets an extra ½″ for the seat), the back
// crotch extension is twice the front's, and the back waist is raised
// and tilted at center back so the seat has room when sitting.

const lerp = (a, b, t) => a + (b - a) * t;

export function draftPiece(m, side) {
  const isBack = side === 'back';
  const adj = isBack ? 0.5 : -0.5;

  const hipY = m.rise * 0.72;
  const crotchY = m.rise;
  const kneeY = m.rise + m.inseam * 0.46;
  const hemY = m.rise + m.inseam;

  const ext = isBack ? m.hip / 8 : m.hip / 16;
  const drop = isBack ? 0.375 : 0;

  const centerTop = isBack ? { x: 1, y: -1 } : { x: 0, y: 0 };
  // CB slants from the raised waist down to the crotch line; CF is straight.
  const centerAtHip = isBack
    ? { x: lerp(1, 0, (hipY + 1) / (crotchY + 1)), y: hipY }
    : { x: 0, y: hipY };

  const waistWidth = m.waist / 4 + adj;
  const waistRun = Math.sqrt(waistWidth ** 2 - centerTop.y ** 2);
  const sideWaist = { x: centerTop.x + waistRun, y: 0 };
  const sideHip = { x: centerAtHip.x + m.hip / 4 + adj, y: hipY };
  // When the thigh is narrower than the hip + crotch extension (slim
  // fits), split the reduction between the inseam and the side seam
  // instead of taking it all from the side, which would pinch the side
  // seam in sharply under the hip.
  const thighWidth = m.thigh / 2 + adj;
  const excess = sideHip.x + ext - thighWidth;
  const fromInseam = excess > 0 ? Math.min(excess / 2, ext * 0.4) : 0;
  const crotchTip = { x: -ext + fromInseam, y: crotchY + drop };
  const sideCrotch = { x: crotchTip.x + thighWidth, y: crotchY };

  // The crease/grainline runs through the middle of the leg at the crotch line.
  const crease = (crotchTip.x + sideCrotch.x) / 2;
  const kneeHalf = (m.knee / 2 + adj) / 2;
  const hemHalf = (m.hem / 2 + adj) / 2;

  const points = {
    centerTop,
    sideWaist,
    sideHip,
    sideCrotch,
    kneeOuter: { x: crease + kneeHalf, y: kneeY },
    hemOuter: { x: crease + hemHalf, y: hemY },
    hemInner: { x: crease - hemHalf, y: hemY },
    kneeInner: { x: crease - kneeHalf, y: kneeY },
    crotchTip,
    centerAtHip,
  };

  return {
    side,
    points,
    crease,
    levels: { hipY, crotchY, kneeY, hemY },
    // Seam-line widths, for checking the draft adds back up to the
    // finished measurements.
    widths: {
      waist: Math.hypot(sideWaist.x - centerTop.x, sideWaist.y - centerTop.y),
      hip: sideHip.x - centerAtHip.x,
      thigh: sideCrotch.x - crotchTip.x,
      knee: kneeHalf * 2,
      hem: hemHalf * 2,
    },
  };
}

// Builds the seam-line path. `map` converts draft coordinates to sheet
// coordinates (used to position and mirror pieces).
export function piecePath(piece, map) {
  const p = piece.points;
  const { hipY, crotchY } = piece.levels;
  const f = (pt) => {
    const [x, y] = map(pt);
    return `${x.toFixed(3)} ${y.toFixed(3)}`;
  };

  const inseamCtrl = {
    x: lerp(p.kneeInner.x, p.crotchTip.x, 0.5) + 0.4,
    y: lerp(p.kneeInner.y, p.crotchTip.y, 0.5),
  };
  // Crotch curve: leaves the tip flat, hugs the corner where the center
  // line meets the crotch line, then rises straight into the center seam.
  const crotchCtrl1 = { x: p.crotchTip.x * 0.4, y: p.crotchTip.y };
  const crotchCtrl2 = { x: 0, y: lerp(hipY, crotchY, 0.55) };

  return [
    `M ${f(p.centerTop)}`,
    `L ${f(p.sideWaist)}`,
    ...sideSeamSegments(piece).map(({ c1, c2, p1 }) => `C ${f(c1)} ${f(c2)} ${f(p1)}`),
    `L ${f(p.hemInner)}`,
    `L ${f(p.kneeInner)}`,
    `Q ${f(inseamCtrl)} ${f(p.crotchTip)}`,
    `C ${f(crotchCtrl1)} ${f(crotchCtrl2)} ${f(p.centerAtHip)}`,
    `L ${f(p.centerTop)}`,
    'Z',
  ].join(' ');
}

// Monotone cubic (Fritsch–Carlson) through the side seam points, treating
// x as a function of y. It passes exactly through every point, so the
// drafted widths stay exact, and unlike a plain spline it can't overshoot
// or loop when the points are unevenly spaced (the hip sits much closer
// to the crotch line than to the waist). At a widest point, like the hip
// on a slim fit, the seam runs vertical, as a real hip curve does.
export function seamSegments(pts) {
  const n = pts.length;
  const slope = [];
  for (let i = 0; i < n - 1; i++) {
    slope.push((pts[i + 1].x - pts[i].x) / (pts[i + 1].y - pts[i].y));
  }

  const m = pts.map((_, i) => {
    if (i === 0) return slope[0];
    if (i === n - 1) return slope[n - 2];
    return slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  });

  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const len = a * a + b * b;
    if (len > 9) {
      const t = 3 / Math.sqrt(len);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }

  const segments = [];
  for (let i = 0; i < n - 1; i++) {
    const [p0, p1] = [pts[i], pts[i + 1]];
    const h = p1.y - p0.y;
    const c1 = { x: p0.x + (m[i] * h) / 3, y: p0.y + h / 3 };
    const c2 = { x: p1.x - (m[i + 1] * h) / 3, y: p1.y - h / 3 };
    segments.push({ p0, c1, c2, p1 });
  }
  return segments;
}

function sideSeamSegments(piece) {
  const p = piece.points;
  return seamSegments([p.sideWaist, p.sideHip, p.sideCrotch, p.kneeOuter, p.hemOuter]);
}

// Exact point on the curved side seam at height y. The segments' control
// points sit at thirds of each segment's height, so y is linear in the
// Bézier parameter t and t can be computed directly.
export function sideSeamPointAt(piece, y) {
  const seg =
    sideSeamSegments(piece).find((s) => y <= s.p1.y) ?? sideSeamSegments(piece).at(-1);
  const t = Math.min(1, Math.max(0, (y - seg.p0.y) / (seg.p1.y - seg.p0.y)));
  const u = 1 - t;
  const x = u ** 3 * seg.p0.x + 3 * u * u * t * seg.c1.x + 3 * u * t * t * seg.c2.x + t ** 3 * seg.p1.x;
  return { x, y };
}

export function pieceBounds(piece) {
  const xs = Object.values(piece.points).map((p) => p.x);
  const ys = Object.values(piece.points).map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}
