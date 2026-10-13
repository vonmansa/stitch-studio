// Front-view model for tops (T-shirt, shirt, jacket), laid flat with the
// sleeves angled down. Same interface as pantsModel.js so Fit Studio and
// Pattern Lab can treat every garment the same way.

const FIELDS = [
  { key: 'neck', label: 'Neck', min: 12, max: 24, hint: 'Neckline circumference (collar size for shirts)' },
  { key: 'shoulder', label: 'Shoulder width', min: 14, max: 24, hint: 'Shoulder point to shoulder point, across the back' },
  { key: 'chest', label: 'Chest', min: 28, max: 64, hint: 'Circumference at the underarm' },
  { key: 'waist', label: 'Waist', min: 24, max: 64, hint: 'Circumference at the natural waist' },
  { key: 'hem', label: 'Hem', min: 26, max: 66, hint: 'Circumference at the bottom edge' },
  { key: 'length', label: 'Body length', min: 18, max: 40, hint: 'High point of the shoulder down to the hem' },
  { key: 'sleeve', label: 'Sleeve length', min: 4, max: 30, hint: 'Shoulder point to the sleeve hem, along the top of the sleeve' },
  { key: 'bicep', label: 'Bicep', min: 9, max: 24, hint: 'Sleeve circumference just below the armpit' },
  { key: 'cuff', label: 'Sleeve opening', min: 7, max: 22, hint: 'Circumference at the sleeve hem' },
];

export const TOP_TYPES = {
  tshirt: {
    label: 'T-shirt',
    sleeveAngle: 24,
    neckDepth: 3,
    sleeveRange: [4, 14],
    defaults: { neck: 18, shoulder: 18, chest: 42, waist: 40.25, hem: 40.75, length: 28, sleeve: 8.5, bicep: 15.5, cuff: 14 },
  },
  shirt: {
    label: 'Shirt',
    sleeveAngle: 32,
    neckDepth: 2.75,
    sleeveRange: [16, 30],
    defaults: { neck: 16, shoulder: 18, chest: 42, waist: 40.25, hem: 40.75, length: 30.5, sleeve: 25, bicep: 15.5, cuff: 9.5 },
  },
  jacket: {
    label: 'Jacket',
    sleeveAngle: 30,
    neckDepth: 0,
    sleeveRange: [16, 30],
    defaults: { neck: 17, shoulder: 18.5, chest: 44, waist: 42.25, hem: 42.75, length: 30, sleeve: 25, bicep: 16.25, cuff: 12 },
  },
};

export function topMeasurements(type) {
  const [min, max] = TOP_TYPES[type].sleeveRange;
  return FIELDS.map((f) => (f.key === 'sleeve' ? { ...f, min, max } : f));
}

// Body shape relative to chest — what distinguishes one fit from another
// independent of size. Defaults above match "Regular".
export const TOP_PRESETS = {
  fitted: { label: 'Fitted', waist: 0.88, hem: 0.9, bicep: 0.34 },
  slim: { label: 'Slim', waist: 0.92, hem: 0.93, bicep: 0.355 },
  regular: { label: 'Regular', waist: 0.96, hem: 0.97, bicep: 0.37 },
  relaxed: { label: 'Relaxed', waist: 1.0, hem: 1.0, bicep: 0.39 },
  boxy: { label: 'Boxy', waist: 1.0, hem: 1.0, bicep: 0.42 },
};

export const TOP_SCALE = 6.2; // SVG px per inch
export const TOP_VIEW_WIDTH = 500;
export const TOP_VIEW_HEIGHT = 330;
const CX = TOP_VIEW_WIDTH / 2;
const TOP_Y = 34;
const SHOULDER_DROP = 1.75;

const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const scale = (a, k) => [a[0] * k, a[1] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];

export function getTopGeometry(type, m) {
  const cfg = TOP_TYPES[type];
  const theta = (cfg.sleeveAngle * Math.PI) / 180;
  const u = [Math.cos(theta), Math.sin(theta)]; // along the sleeve, outward/down
  const nrm = [-u[1], u[0]]; // across the sleeve, toward the underarm

  // Inches, right half, origin at center front / high shoulder point level.
  const neckHalf = m.neck / 3.3 / 2;
  const sp = [m.shoulder / 2, SHOULDER_DROP];
  const chestHalf = m.chest / 4;

  // The armpit sits on the side seam where the sleeve's underarm edge
  // (a bicep's flat width below the sleeve top line) meets it, so a
  // wider bicep gives a deeper armhole.
  const bicepFlat = m.bicep / 2;
  const rawArmpitY = sp[1] + (bicepFlat + u[1] * (chestHalf - sp[0])) / u[0];
  const armpitY = Math.min(Math.max(rawArmpitY, sp[1] + 4), m.length - 6);
  const waistY = Math.min(Math.max(m.length * 0.58, armpitY + 3), m.length - 2);

  const armpit = [chestHalf, armpitY];
  const sleeveTop = add(sp, scale(u, m.sleeve));
  const sleeveBottom = add(sleeveTop, scale(nrm, m.cuff / 2));
  const underarmDir = sub(sleeveBottom, armpit);
  const underarmLen = Math.hypot(...underarmDir) || 1;
  const bicepPoint = add(armpit, scale(underarmDir, Math.min(1.5, underarmLen / 3) / underarmLen));
  // Where the bicep is measured across to: the sleeve top line, square to it.
  const bicepFoot = add(sp, scale(u, dot(sub(armpit, sp), u)));

  const half = {
    neck: [neckHalf, 0],
    shoulder: sp,
    sleeveTop,
    sleeveBottom,
    armpit,
    bicepPoint,
    bicepFoot,
    waist: [m.waist / 4, waistY],
    hem: [m.hem / 4, m.length],
  };

  const px = ([x, y], s = 1) => [CX + s * x * TOP_SCALE, TOP_Y + y * TOP_SCALE];
  const side = (s) => Object.fromEntries(Object.entries(half).map(([k, p]) => [k, px(p, s)]));

  return {
    type,
    cx: CX,
    topY: TOP_Y,
    scale: TOP_SCALE,
    u,
    nrm,
    neckDepth: cfg.neckDepth,
    armpitY: TOP_Y + armpitY * TOP_SCALE,
    waistY: TOP_Y + waistY * TOP_SCALE,
    hemY: TOP_Y + m.length * TOP_SCALE,
    breakY: TOP_Y + (armpitY + 2.5) * TOP_SCALE,
    neckHalf,
    px,
    right: side(1),
    left: side(-1),
  };
}

const fmtPt = ([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`;

// Control point that makes a quadratic pass through `mid` at t = 0.5.
const through = (a, mid, b) => [2 * mid[0] - (a[0] + b[0]) / 2, 2 * mid[1] - (a[1] + b[1]) / 2];

export function getTopOutlinePath(g) {
  const { left: L, right: R } = g;
  const neckline =
    g.type === 'jacket'
      ? `L ${fmtPt([g.cx, g.breakY])} L ${fmtPt(R.neck)}`
      : `Q ${fmtPt([g.cx, g.topY + 2 * g.neckDepth * g.scale])} ${fmtPt(R.neck)}`;
  return [
    `M ${fmtPt(R.neck)}`,
    `L ${fmtPt(R.shoulder)}`,
    `L ${fmtPt(R.sleeveTop)}`,
    `L ${fmtPt(R.sleeveBottom)}`,
    `L ${fmtPt(R.armpit)}`,
    `Q ${fmtPt(through(R.armpit, R.waist, R.hem))} ${fmtPt(R.hem)}`,
    `L ${fmtPt(L.hem)}`,
    `Q ${fmtPt(through(L.hem, L.waist, L.armpit))} ${fmtPt(L.armpit)}`,
    `L ${fmtPt(L.sleeveBottom)}`,
    `L ${fmtPt(L.sleeveTop)}`,
    `L ${fmtPt(L.shoulder)}`,
    `L ${fmtPt(L.neck)}`,
    neckline,
    'Z',
  ].join(' ');
}

export function getTopHandle(type, key, m) {
  const g = getTopGeometry(type, m);
  switch (key) {
    case 'neck':
      return g.right.neck;
    case 'shoulder':
      return g.right.shoulder;
    case 'chest':
      return g.right.armpit;
    case 'waist':
      return g.right.waist;
    case 'hem':
      return g.right.hem;
    case 'length':
      return [g.cx, g.hemY];
    case 'sleeve':
      return g.right.sleeveTop;
    case 'bicep':
      return g.right.bicepPoint;
    case 'cuff':
      return g.right.sleeveBottom;
    default:
      throw new Error(`Unknown measurement: ${key}`);
  }
}

export function getTopDimension(key, g) {
  const { left: L, right: R } = g;
  const up = -0.9 * g.scale;
  switch (key) {
    case 'neck':
      return [L.neck[0], g.topY + up, R.neck[0], g.topY + up];
    case 'shoulder':
      return [L.shoulder[0], L.shoulder[1] + up, R.shoulder[0], R.shoulder[1] + up];
    case 'chest':
      return [L.armpit[0], g.armpitY, R.armpit[0], g.armpitY];
    case 'waist':
      return [L.waist[0], g.waistY, R.waist[0], g.waistY];
    case 'hem':
      return [L.hem[0], g.hemY + 12, R.hem[0], g.hemY + 12];
    case 'length':
      return [g.cx + 14, g.topY, g.cx + 14, g.hemY];
    case 'sleeve': {
      const off = scale(g.nrm, -10);
      return [...add(R.shoulder, off), ...add(R.sleeveTop, off)];
    }
    case 'bicep':
      return [...R.armpit, ...R.bicepFoot];
    case 'cuff':
      return [...R.sleeveTop, ...R.sleeveBottom];
    default:
      return null;
  }
}

export function topClickTarget(g, [x, y]) {
  const R = g.right;
  // Mirror left-side clicks onto the right sleeve, then measure the click
  // along and across the sleeve's own direction.
  const rel = sub([g.cx + Math.abs(x - g.cx), y], R.shoulder);
  const sleeveLen = Math.hypot(...sub(R.sleeveTop, R.shoulder)) || 1;
  const along = dot(rel, g.u) / sleeveLen;
  const across = dot(rel, g.nrm);
  const sleeveWidth = dot(sub(R.armpit, R.shoulder), g.nrm);
  if (along > 0.12 && along < 1.05 && across > -4 && across < sleeveWidth + 4) {
    if (along < 0.3) return 'bicep';
    if (along > 0.8) return 'cuff';
    return 'sleeve';
  }
  const levels = {
    neck: g.topY,
    shoulder: R.shoulder[1] + 2,
    chest: g.armpitY,
    waist: g.waistY,
    hem: g.hemY,
  };
  return Object.entries(levels).reduce((best, entry) =>
    Math.abs(entry[1] - y) < Math.abs(best[1] - y) ? entry : best
  )[0];
}

export function topFitBands(g) {
  const { left: L, right: R } = g;
  return [
    { key: 'shoulder', segments: [[L.shoulder, R.shoulder]] },
    { key: 'chest', segments: [[L.armpit, R.armpit]] },
    { key: 'waist', segments: [[L.waist, R.waist]] },
    { key: 'hip', segments: [[L.hem, R.hem]] },
    { key: 'bicep', segments: [[R.armpit, R.bicepFoot]] },
  ];
}

const WRIST = 7;

// The body drawn with the garment's own geometry: hip at the hem line and
// the arm at full length, so a short sleeve shows the arm continuing past it.
export function topBodyShape(body, garment) {
  return {
    neck: body.neck,
    shoulder: body.shoulder,
    chest: body.chest,
    waist: body.waist,
    hem: body.hip,
    length: garment.length,
    sleeve: body.armLength,
    bicep: body.bicep,
    cuff: WRIST,
  };
}
