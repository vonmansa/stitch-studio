import { toCm } from './pantsModel.js';

// One shared body: whichever garment you're testing reads the
// measurements it needs.
export const BODY_FIELDS = [
  { key: 'neck', label: 'Neck', min: 11, max: 24 },
  { key: 'shoulder', label: 'Shoulder width', min: 12, max: 24 },
  { key: 'chest', label: 'Chest', min: 26, max: 64 },
  { key: 'waist', label: 'Waist', min: 20, max: 60 },
  { key: 'hip', label: 'Hip', min: 28, max: 70 },
  { key: 'bicep', label: 'Bicep', min: 8, max: 24 },
  { key: 'armLength', label: 'Arm length', min: 18, max: 32 },
  { key: 'thigh', label: 'Thigh', min: 12, max: 40 },
  { key: 'knee', label: 'Knee', min: 10, max: 30 },
  { key: 'inseam', label: 'Inseam', min: 22, max: 38 },
];

export const BODY_FIELDS_BY_CATEGORY = {
  bottoms: ['waist', 'hip', 'thigh', 'knee', 'inseam'],
  tops: ['neck', 'shoulder', 'chest', 'waist', 'hip', 'bicep', 'armLength'],
};

export const DEFAULT_BODY = {
  neck: 15,
  shoulder: 17.5,
  chest: 38,
  waist: 30,
  hip: 38,
  bicep: 12.5,
  armLength: 24.5,
  thigh: 22,
  knee: 15,
  inseam: 30,
};

export const FABRICS = {
  woven: { label: 'Woven (no stretch)' },
  stretch: { label: 'Stretch (denim, ponte, knit)' },
};

// Ease = finished garment − body. [minimum ease, top of "fitted"] per
// fabric; anything above `loose` is flagged. Stretch fabrics tolerate
// negative ease because the fabric gives instead of the seam.
const PANTS_RULES = [
  {
    key: 'waist',
    label: 'Waist',
    woven: [0.5, 2],
    stretch: [-1, 1.5],
    loose: 3.5,
    tight: 'Waistband won’t close comfortably — let out the side seams or choose a bigger waist.',
    looseTip: 'Waistband will gape — take in the side seams or add a back dart.',
  },
  {
    key: 'hip',
    label: 'Hip',
    woven: [1.5, 4],
    stretch: [-1.5, 2],
    loose: 7,
    tight: 'Seat will pull and show stress lines — add width at the side seams.',
    looseTip: 'Seat will sag — reduce hip width or switch to a slimmer fit.',
  },
  {
    key: 'thigh',
    label: 'Thigh',
    woven: [1, 4],
    stretch: [-1.5, 2],
    loose: Infinity,
    tight: 'Thigh will bind when sitting — widen the leg or use a stretch fabric.',
  },
  {
    key: 'knee',
    label: 'Knee',
    woven: [1.5, 5],
    stretch: [-1, 3],
    loose: Infinity,
    tight: 'Knee will restrict bending — widen the knee or use a stretch fabric.',
  },
];

const TOP_RULES = [
  {
    key: 'neck',
    label: 'Neck',
    types: ['shirt'],
    woven: [0.25, 1],
    stretch: [0, 1],
    loose: 2,
    tight: 'Collar won’t button comfortably — go up a neck size.',
    looseTip: 'Collar will stand away from the neck — go down a neck size.',
  },
  {
    key: 'shoulder',
    label: 'Shoulder',
    woven: [-0.5, 1],
    stretch: [-1, 1],
    loose: 3,
    layer: 0.5,
    tight: 'Shoulder seams sit inside your shoulder and pull when you reach — widen the shoulders.',
    looseTip: 'Shoulder seams drop well past your shoulder (a dropped-shoulder look).',
  },
  {
    key: 'chest',
    label: 'Chest',
    woven: [2, 5],
    stretch: [-1, 3],
    loose: 10,
    layer: 2,
    tight: 'Will pull across the chest and buttons will gape — add width at the side seams.',
    looseTip: 'Will billow around the chest — reduce chest width or try a slimmer fit.',
  },
  {
    key: 'waist',
    label: 'Waist',
    woven: [1, 6],
    stretch: [-1, 4],
    loose: 12,
    layer: 1.5,
    tight: 'Will pull across the stomach — let out the side seams at the waist.',
  },
  {
    key: 'hip',
    garmentKey: 'hem',
    label: 'Hip (hem)',
    woven: [1, 6],
    stretch: [-1, 4],
    loose: 12,
    layer: 1.5,
    tight: 'Hem will ride up over the hips — widen the hem or shorten the body.',
  },
  {
    key: 'bicep',
    label: 'Bicep',
    woven: [1.5, 4],
    stretch: [0, 2.5],
    loose: 8,
    layer: 1,
    tight: 'Sleeve will bind when you bend your arm — widen the bicep.',
  },
];

export const VERDICTS = {
  tight: { label: 'Too tight', color: '#c0392b' },
  fitted: { label: 'Fitted', color: '#2e7d43' },
  relaxed: { label: 'Relaxed', color: '#3a6ea5' },
  loose: { label: 'Too loose', color: '#8e44ad' },
};

export function checkFit(garmentType, category, garment, body, fabric) {
  const rules =
    category === 'tops'
      ? TOP_RULES.filter((r) => !r.types || r.types.includes(garmentType))
      : PANTS_RULES;
  // A jacket is worn over a shirt, so it needs that much more room
  // everywhere before it counts as fitted.
  const layer = garmentType === 'jacket';

  const areas = rules.map((rule) => {
    const garmentValue = garment[rule.garmentKey ?? rule.key];
    const ease = garmentValue - body[rule.key];
    const extra = layer ? rule.layer ?? 0 : 0;
    const [min, fittedMax] = rule[fabric].map((v) => v + extra);
    let verdict;
    if (ease < min) verdict = 'tight';
    else if (ease <= fittedMax) verdict = 'fitted';
    else if (ease <= rule.loose + extra) verdict = 'relaxed';
    else verdict = 'loose';

    const advice = verdict === 'tight' ? rule.tight : verdict === 'loose' ? rule.looseTip ?? null : null;
    return { key: rule.key, label: rule.label, ease, verdict, advice };
  });

  const length =
    category === 'tops'
      ? checkSleeve(garmentType, garment.sleeve, body.armLength)
      : checkInseam(garment.inseam, body.inseam);
  return { areas, length };
}

const amount = (diff) => {
  const abs = Math.abs(diff);
  return `${Number(abs.toFixed(2))} in (${toCm(abs).toFixed(1)} cm)`;
};

function checkInseam(garmentInseam, bodyInseam) {
  const diff = garmentInseam - bodyInseam;
  const base = { diff, rowLabel: 'Length' };
  if (diff < -3) return { ...base, label: 'Cropped', note: `Ends ${amount(diff)} above the ankle.` };
  if (diff < -0.5) return { ...base, label: 'Ankle length', note: `Ends ${amount(diff)} above a full-length hem.` };
  if (diff <= 1) return { ...base, label: 'Full length', note: 'Hem lands at the ankle/shoe.' };
  return { ...base, label: 'Too long', note: `Will pool at the shoe — shorten the hem by about ${amount(diff)}.` };
}

// Long sleeves should end at the wrist bone or just past it; short
// sleeves are a style choice, so they're only described.
function checkSleeve(garmentType, sleeve, armLength) {
  const diff = sleeve - armLength;
  const base = { diff, rowLabel: 'Sleeve' };
  if (garmentType === 'tshirt') {
    return { ...base, label: 'Short sleeve', note: 'Short sleeve — ends on the upper arm.' };
  }
  if (diff < -1) return { ...base, label: 'Too short', note: `Ends ${amount(diff)} above the wrist — lengthen the sleeve.` };
  if (diff <= 1.5) return { ...base, label: 'Good length', note: 'Sleeve ends at the wrist.' };
  return { ...base, label: 'Too long', note: `Covers the hand — shorten the sleeve by about ${amount(diff - 0.75)}.` };
}
