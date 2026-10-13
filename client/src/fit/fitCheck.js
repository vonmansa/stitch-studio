import { toCm } from './pantsModel.js';

export const BODY_FIELDS = [
  { key: 'waist', label: 'Waist', min: 20, max: 60 },
  { key: 'hip', label: 'Hip', min: 28, max: 70 },
  { key: 'thigh', label: 'Thigh', min: 12, max: 40 },
  { key: 'knee', label: 'Knee', min: 10, max: 30 },
  { key: 'inseam', label: 'Inseam', min: 22, max: 38 },
];

export const DEFAULT_BODY = { waist: 30, hip: 38, thigh: 22, knee: 15, inseam: 30 };

export const FABRICS = {
  woven: { label: 'Woven (no stretch)' },
  stretch: { label: 'Stretch (denim, ponte, knit)' },
};

// Ease = finished garment − body. [minimum ease, top of "fitted"] per
// fabric; anything above `loose` is flagged. Stretch fabrics tolerate
// negative ease because the fabric gives instead of the seam.
const EASE_RULES = {
  waist: {
    woven: [0.5, 2],
    stretch: [-1, 1.5],
    loose: 3.5,
    tight: 'Waistband won’t close comfortably — let out the side seams or choose a bigger waist.',
    looseTip: 'Waistband will gape — take in the side seams or add a back dart.',
  },
  hip: {
    woven: [1.5, 4],
    stretch: [-1.5, 2],
    loose: 7,
    tight: 'Seat will pull and show stress lines — add width at the side seams.',
    looseTip: 'Seat will sag — reduce hip width or switch to a slimmer fit.',
  },
  thigh: {
    woven: [1, 4],
    stretch: [-1.5, 2],
    loose: Infinity,
    tight: 'Thigh will bind when sitting — widen the leg or use a stretch fabric.',
  },
  knee: {
    woven: [1.5, 5],
    stretch: [-1, 3],
    loose: Infinity,
    tight: 'Knee will restrict bending — widen the knee or use a stretch fabric.',
  },
};

export const VERDICTS = {
  tight: { label: 'Too tight', color: '#c0392b' },
  fitted: { label: 'Fitted', color: '#2e7d43' },
  relaxed: { label: 'Relaxed', color: '#3a6ea5' },
  loose: { label: 'Too loose', color: '#8e44ad' },
};

export function checkFit(garment, body, fabric) {
  const areas = Object.entries(EASE_RULES).map(([key, rule]) => {
    const ease = garment[key] - body[key];
    const [min, fittedMax] = rule[fabric];
    let verdict;
    if (ease < min) verdict = 'tight';
    else if (ease <= fittedMax) verdict = 'fitted';
    else if (ease <= rule.loose) verdict = 'relaxed';
    else verdict = 'loose';

    const advice =
      verdict === 'tight' ? rule.tight : verdict === 'loose' ? rule.looseTip : null;
    return { key, garment: garment[key], body: body[key], ease, verdict, advice };
  });

  return { areas, length: checkLength(garment.inseam, body.inseam) };
}

function checkLength(garmentInseam, bodyInseam) {
  const diff = garmentInseam - bodyInseam;
  const abs = Math.abs(diff);
  const amount = `${Number(abs.toFixed(2))} in (${toCm(abs).toFixed(1)} cm)`;
  if (diff < -3) return { diff, label: 'Cropped', note: `Ends ${amount} above the ankle.` };
  if (diff < -0.5) return { diff, label: 'Ankle length', note: `Ends ${amount} above a full-length hem.` };
  if (diff <= 1) return { diff, label: 'Full length', note: 'Hem lands at the ankle/shoe.' };
  return { diff, label: 'Too long', note: `Will pool at the shoe — shorten the hem by about ${amount}.` };
}
