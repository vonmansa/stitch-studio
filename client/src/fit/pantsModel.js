export const CM_PER_INCH = 2.54;

// All measurements are stored in inches; cm is derived for display.
export const MEASUREMENTS = [
  { key: 'waist', label: 'Waist', min: 22, max: 50, axis: 'x', hint: 'Circumference at the waistband' },
  { key: 'hip', label: 'Hip', min: 30, max: 60, axis: 'x', hint: 'Circumference at the fullest part of the seat' },
  { key: 'rise', label: 'Front rise', min: 7, max: 15, axis: 'y', hint: 'Waistband down to the crotch seam' },
  { key: 'thigh', label: 'Thigh', min: 14, max: 36, axis: 'x', hint: 'Leg circumference just below the crotch' },
  { key: 'knee', label: 'Knee', min: 10, max: 30, axis: 'x', hint: 'Leg circumference at the knee' },
  { key: 'hem', label: 'Leg opening', min: 8, max: 34, axis: 'x', hint: 'Leg circumference at the hem' },
  { key: 'inseam', label: 'Inseam', min: 24, max: 36, axis: 'y', hint: 'Crotch seam down to the hem, inner leg' },
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

export function clampMeasurement(key, value) {
  const { min, max } = MEASUREMENT_BY_KEY[key];
  return Math.min(max, Math.max(min, value));
}

export function applyPreset(measurements, presetKey) {
  const preset = FIT_PRESETS[presetKey];
  const next = { ...measurements };
  for (const key of ['thigh', 'knee', 'hem']) {
    next[key] = clampMeasurement(key, snapQuarter(measurements.hip * preset[key]));
  }
  return next;
}

export function detectPreset(measurements) {
  return (
    Object.keys(FIT_PRESETS).find((presetKey) => {
      const expected = applyPreset(measurements, presetKey);
      return ['thigh', 'knee', 'hem'].every((k) => expected[k] === measurements[k]);
    }) || null
  );
}

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

// Inverts getHandlePosition: finds the measurement value that puts the
// handle under the pointer. Every handle moves monotonically with its
// value, so a binary search works for all of them — including knee/hem,
// whose leg centerline itself shifts as they widen.
export function valueForPointer(key, m, pointer) {
  const { min, max, axis } = MEASUREMENT_BY_KEY[key];
  const target = axis === 'x' ? pointer[0] : pointer[1];
  const coord = (v) => getHandlePosition(key, { ...m, [key]: v })[axis === 'x' ? 0 : 1];
  let lo = min;
  let hi = max;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (coord(mid) < target) lo = mid;
    else hi = mid;
  }
  return clampMeasurement(key, snapQuarter((lo + hi) / 2));
}
