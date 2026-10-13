import * as pants from './pantsModel.js';
import * as tops from './topModel.js';
import PantsDrawing from './PantsDrawing.jsx';
import TopDrawing from './TopDrawing.jsx';

// One entry per garment type, all with the same shape, so Fit Studio,
// Pattern Lab and the project page never branch on the garment type
// except where the drafting itself differs.

const pantsGarment = {
  type: 'pants',
  label: 'Pants',
  category: 'bottoms',
  measurements: pants.MEASUREMENTS,
  defaults: pants.DEFAULT_MEASUREMENTS,
  presets: pants.FIT_PRESETS,
  presetBase: 'hip',
  presetKeys: ['thigh', 'knee', 'hem'],
  view: { width: pants.VIEW_WIDTH, height: pants.VIEW_HEIGHT },
  getGeometry: pants.getGeometry,
  getHandle: pants.getHandlePosition,
  getDimension: pants.getDimension,
  clickTarget: pants.clickTarget,
  fitBands: pants.fitBands,
  bodyShape: pants.bodyShape,
  bodyGeometry: pants.getGeometry,
  Drawing: PantsDrawing,
  outlinePath: pants.getOutlinePath,
  pieceOptions: { details: 'Waistband & fly', pockets: 'Pockets (side pocket bags + back patch pockets)' },
  summaryKeys: ['waist', 'hip', 'thigh', 'hem', 'inseam'],
  derived: [{ label: 'Outseam (approx.)', value: (m) => m.rise + m.inseam }],
};

const TOP_PIECE_OPTIONS = {
  tshirt: { details: 'Neckband', pockets: 'Chest pocket' },
  shirt: { details: 'Collar, collar stand & cuffs', pockets: 'Chest pocket' },
  jacket: { details: 'Front facings & collar', pockets: 'Flap pockets' },
};

function topGarment(type) {
  return {
    type,
    label: tops.TOP_TYPES[type].label,
    category: 'tops',
    measurements: tops.topMeasurements(type),
    defaults: tops.TOP_TYPES[type].defaults,
    presets: tops.TOP_PRESETS,
    presetBase: 'chest',
    presetKeys: ['waist', 'hem', 'bicep'],
    view: { width: tops.TOP_VIEW_WIDTH, height: tops.TOP_VIEW_HEIGHT },
    getGeometry: (m) => tops.getTopGeometry(type, m),
    getHandle: (key, m) => tops.getTopHandle(type, key, m),
    getDimension: tops.getTopDimension,
    clickTarget: tops.topClickTarget,
    fitBands: tops.topFitBands,
    bodyShape: tops.topBodyShape,
    // Same sleeve angle as the garment so arm and sleeve line up, but a
    // plain round neckline — the body shouldn't copy a jacket's V-neck.
    bodyGeometry: (shape) => ({ ...tops.getTopGeometry(type, shape), type: 'body', neckDepth: 1.5 }),
    Drawing: TopDrawing,
    outlinePath: tops.getTopOutlinePath,
    pieceOptions: TOP_PIECE_OPTIONS[type],
    summaryKeys: ['chest', 'waist', 'shoulder', 'length', 'sleeve'],
    // How shirt makers usually quote sleeve length.
    derived: [{ label: 'Sleeve from center back', value: (m) => m.shoulder / 2 + m.sleeve }],
  };
}

export const GARMENTS = {
  pants: pantsGarment,
  tshirt: topGarment('tshirt'),
  shirt: topGarment('shirt'),
  jacket: topGarment('jacket'),
};

export const specFor = (garment, key) => garment.measurements.find((m) => m.key === key);

export function clampFor(garment, key, value) {
  const { min, max } = specFor(garment, key);
  return Math.min(max, Math.max(min, value));
}

export function applyPreset(garment, m, presetKey) {
  const preset = garment.presets[presetKey];
  const next = { ...m };
  for (const key of garment.presetKeys) {
    next[key] = clampFor(garment, key, pants.snapQuarter(m[garment.presetBase] * preset[key]));
  }
  return next;
}

export function detectPreset(garment, m) {
  return (
    Object.keys(garment.presets).find((presetKey) => {
      const expected = applyPreset(garment, m, presetKey);
      return garment.presetKeys.every((k) => expected[k] === m[k]);
    }) || null
  );
}
