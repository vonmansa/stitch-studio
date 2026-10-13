export const CM_PER_INCH = 2.54;

// All measurements are stored in inches; cm is derived for display.
export const MEASUREMENTS = [
  { key: 'waist', label: 'Waist', min: 22, max: 50, hint: 'Circumference at the waistband' },
  { key: 'hip', label: 'Hip', min: 30, max: 60, hint: 'Circumference at the fullest part of the seat' },
  { key: 'rise', label: 'Front rise', min: 7, max: 15, hint: 'Waistband down to the crotch seam' },
  { key: 'thigh', label: 'Thigh', min: 14, max: 36, hint: 'Leg circumference just below the crotch' },
  { key: 'knee', label: 'Knee', min: 10, max: 30, hint: 'Leg circumference at the knee' },
  { key: 'hem', label: 'Leg opening', min: 8, max: 34, hint: 'Leg circumference at the hem' },
  { key: 'inseam', label: 'Inseam', min: 24, max: 36, hint: 'Crotch seam down to the hem, inner leg' },
];

export const MEASUREMENT_BY_KEY = Object.fromEntries(MEASUREMENTS.map((m) => [m.key, m]));

export const DEFAULT_MEASUREMENTS = {
  waist: 32,
  hip: 40,
  rise: 10.5,
  thigh: 23,
  knee: 17,
  hem: 16,
  inseam: 30,
};

// Leg circumferences as a fraction of hip — the shape of the leg is what
// distinguishes one fit from another, independent of body size.
export const FIT_PRESETS = {
  skinny: { label: 'Skinny', thigh: 0.52, knee: 0.36, hem: 0.3 },
  slim: { label: 'Slim', thigh: 0.56, knee: 0.4, hem: 0.36 },
  straight: { label: 'Straight', thigh: 0.58, knee: 0.44, hem: 0.44 },
  bootcut: { label: 'Bootcut', thigh: 0.57, knee: 0.4, hem: 0.5 },
  relaxed: { label: 'Relaxed', thigh: 0.64, knee: 0.5, hem: 0.48 },
  wide: { label: 'Wide leg', thigh: 0.68, knee: 0.62, hem: 0.66 },
};

export const toCm = (inches) => inches * CM_PER_INCH;
export const fromCm = (cm) => cm / CM_PER_INCH;
export const snapQuarter = (inches) => Math.round(inches * 4) / 4;

// ---- Drawing geometry (front view, flat garment) ----

export const SCALE = 8; // SVG px per inch
export const VIEW_WIDTH = 420;
export const VIEW_HEIGHT = 470;
const CX = VIEW_WIDTH / 2;
const WAIST_Y = 30;
const LEG_GAP = 3; // px kept between the legs so they never cross

// Laid flat, a garment's visible width is half its circumference, so the
// distance from the centerline to an edge is a quarter of it.
const quarter = (circumference) => (circumference / 4) * SCALE;

export function getGeometry(m) {
  const waistHalf = quarter(m.waist);
  const hipHalf = quarter(m.hip);
  const thighHalf = quarter(m.thigh);
  const kneeHalf = quarter(m.knee);
  const hemHalf = quarter(m.hem);

  const hipY = WAIST_Y + m.rise * 0.72 * SCALE;
  const crotchY = WAIST_Y + m.rise * SCALE;
  const kneeY = crotchY + m.inseam * 0.46 * SCALE;
  const hemY = crotchY + m.inseam * SCALE;

  // Each leg hangs from a centerline a quarter-hip out from the middle,
  // splaying outward further down when a wide knee/hem would otherwise
  // make the two legs overlap.
  const legCrotch = hipHalf / 2;
  const legKnee = Math.max(legCrotch, kneeHalf + LEG_GAP);
  const legHem = Math.max(legKnee, hemHalf + LEG_GAP);

  const side = (s) => ({
    waist: [CX + s * waistHalf, WAIST_Y],
    hip: [CX + s * hipHalf, hipY],
    thighOuter: [CX + s * (legCrotch + thighHalf), crotchY],
    kneeOuter: [CX + s * (legKnee + kneeHalf), kneeY],
    kneeInner: [CX + s * (legKnee - kneeHalf), kneeY],
    hemOuter: [CX + s * (legHem + hemHalf), hemY],
    hemInner: [CX + s * (legHem - hemHalf), hemY],
    legCenterCrotch: [CX + s * legCrotch, crotchY],
    legCenterHem: [CX + s * legHem, hemY],
  });

  return {
    cx: CX,
    waistY: WAIST_Y,
    hipY,
    crotchY,
    kneeY,
    hemY,
    waistHalf,
    hipHalf,
    left: side(-1),
    right: side(1),
  };
}

const pt = ([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`;

export function getOutlinePath(g) {
  const { left: L, right: R, cx, crotchY, waistY, hipY } = g;
  const hipCurveY = waistY + (hipY - waistY) * 0.35;
  return [
    `M ${pt(L.waist)}`,
    `Q ${pt([L.hip[0], hipCurveY])} ${pt(L.hip)}`,
    `L ${pt(L.thighOuter)}`,
    `L ${pt(L.kneeOuter)}`,
    `L ${pt(L.hemOuter)}`,
    `L ${pt(L.hemInner)}`,
    `L ${pt(L.kneeInner)}`,
    `Q ${pt([cx - 4, crotchY + 6])} ${pt([cx, crotchY])}`,
    `Q ${pt([cx + 4, crotchY + 6])} ${pt(R.kneeInner)}`,
    `L ${pt(R.hemInner)}`,
    `L ${pt(R.hemOuter)}`,
    `L ${pt(R.kneeOuter)}`,
    `L ${pt(R.thighOuter)}`,
    `L ${pt(R.hip)}`,
    `Q ${pt([R.hip[0], hipCurveY])} ${pt(R.waist)}`,
    'Z',
  ].join(' ');
}

// Where each measurement's drag handle sits on the drawing.
export function getHandlePosition(key, m) {
  const g = getGeometry(m);
  switch (key) {
    case 'waist':
      return g.right.waist;
    case 'hip':
      return g.right.hip;
    case 'rise':
      return [g.cx, g.crotchY];
    case 'thigh':
      return g.right.thighOuter;
    case 'knee':
      return g.right.kneeOuter;
    case 'hem':
      return g.right.hemOuter;
    case 'inseam':
      return g.right.legCenterHem;
    default:
      throw new Error(`Unknown measurement: ${key}`);
  }
}

// Where the dimension line for each measurement is drawn: [x1, y1, x2, y2].
export function getDimension(key, g) {
  const L = g.left;
  const R = g.right;
  switch (key) {
    case 'waist':
      return [L.waist[0], g.waistY - 14, R.waist[0], g.waistY - 14];
    case 'hip':
      return [L.hip[0], g.hipY, R.hip[0], g.hipY];
    case 'thigh':
      return [L.thighOuter[0], g.crotchY, R.thighOuter[0], g.crotchY];
    case 'knee':
      return [R.kneeInner[0], g.kneeY, R.kneeOuter[0], g.kneeY];
    case 'hem':
      return [R.hemInner[0], g.hemY + 14, R.hemOuter[0], g.hemY + 14];
    case 'rise': {
      const x = Math.min(L.hip[0], L.thighOuter[0]) - 18;
      return [x, g.waistY, x, g.crotchY];
    }
    case 'inseam': {
      const x = Math.max(R.thighOuter[0], R.kneeOuter[0], R.hemOuter[0]) + 18;
      return [x, g.crotchY, x, g.hemY];
    }
    default:
      return null;
  }
}

// Clicking the garment body selects whichever circumference line is
// closest to the click.
export function clickTarget(g, [, y]) {
  const levels = { waist: g.waistY, hip: g.hipY, thigh: g.crotchY, knee: g.kneeY, hem: g.hemY };
  return Object.entries(levels).reduce((best, entry) =>
    Math.abs(entry[1] - y) < Math.abs(best[1] - y) ? entry : best
  )[0];
}

// Lines drawn across the garment in the try-on view, keyed by fit area.
export function fitBands(g) {
  const L = g.left;
  const R = g.right;
  return [
    { key: 'waist', segments: [[L.waist, R.waist]] },
    { key: 'hip', segments: [[L.hip, R.hip]] },
    { key: 'thigh', segments: [[L.thighOuter, R.thighOuter]] },
    { key: 'knee', segments: [[L.kneeOuter, L.kneeInner], [R.kneeInner, R.kneeOuter]] },
  ];
}

const ANKLE = 9;

// Body measurements expressed as a "garment" so the same geometry draws
// the body outline. Rise comes from the garment so both line up at the crotch.
export function bodyShape(body, garment) {
  return {
    waist: body.waist,
    hip: body.hip,
    rise: garment.rise,
    thigh: body.thigh,
    knee: body.knee,
    hem: ANKLE,
    inseam: body.inseam,
  };
}
