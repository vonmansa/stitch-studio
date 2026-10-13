// GARMENT_TYPES describes which measurements each garment needs, so the
// frontend form can be built dynamically from this same config instead of
// hardcoding fields per garment in two places.
export const GARMENT_TYPES = {
  't-shirt': {
    label: 'T-Shirt',
    measurements: [
      { key: 'chest', label: 'Chest circumference', unit: 'in' },
      { key: 'length', label: 'Garment length', unit: 'in' },
    ],
  },
  dress: {
    label: 'Dress',
    measurements: [
      { key: 'bust', label: 'Bust circumference', unit: 'in' },
      { key: 'waist', label: 'Waist circumference', unit: 'in' },
      { key: 'length', label: 'Dress length', unit: 'in' },
    ],
  },
  pants: {
    label: 'Pants',
    measurements: [
      { key: 'waist', label: 'Waist circumference', unit: 'in' },
      { key: 'hip', label: 'Hip circumference', unit: 'in' },
      { key: 'inseam', label: 'Inseam length', unit: 'in' },
    ],
  },
  skirt: {
    label: 'Skirt',
    measurements: [
      { key: 'waist', label: 'Waist circumference', unit: 'in' },
      { key: 'length', label: 'Skirt length', unit: 'in' },
    ],
  },
};

const SIZE_LABELS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

// Returns which "bucket" a measurement falls into given a sorted list of
// breakpoints, e.g. bucketIndex(36, [34, 38, 42]) -> 1 (S: 34-37.9").
function bucketIndex(value, breakpoints) {
  let index = 0;
  for (const breakpoint of breakpoints) {
    if (value >= breakpoint) index++;
    else break;
  }
  return index;
}

function calculateTShirt({ chest, length }) {
  const breakpoints = [34, 38, 42, 46, 50];
  const baseYardage = [1.25, 1.5, 1.75, 2.0, 2.25, 2.5];
  const idx = bucketIndex(chest, breakpoints);
  let yards = baseYardage[idx];
  const notes = [`Size bucket ${SIZE_LABELS[idx]} (chest ${chest}")`];

  if (length > 30) {
    yards += 0.25;
    notes.push('Longer than standard 30" length: +0.25 yd');
  }

  return { yards, notes };
}

function calculateDress({ bust, waist, length }) {
  const breakpoints = [34, 38, 42, 46, 50];
  const baseYardage = [1.75, 2.0, 2.25, 2.5, 2.75, 3.0];
  const idx = bucketIndex(bust, breakpoints);
  let yards = baseYardage[idx];
  const notes = [`Size bucket ${SIZE_LABELS[idx]} (bust ${bust}")`];

  if (bust - waist < 8) {
    yards -= 0.1;
    notes.push('Relaxed/straight fit needs less shaping: -0.1 yd');
  }

  if (length <= 35) {
    notes.push('Mini length: no adjustment');
  } else if (length <= 42) {
    yards += 0.75;
    notes.push('Knee length: +0.75 yd');
  } else {
    yards += 1.75;
    notes.push('Maxi length: +1.75 yd');
  }

  return { yards, notes };
}

function calculatePants({ hip, inseam }) {
  const breakpoints = [36, 40, 44, 48, 52];
  const baseYardage = [1.5, 1.75, 2.0, 2.25, 2.5, 2.75];
  const idx = bucketIndex(hip, breakpoints);
  let yards = baseYardage[idx];
  const notes = [`Size bucket ${SIZE_LABELS[idx]} (hip ${hip}")`];

  const standardInseam = 30;
  const adjustment = Math.round((inseam - standardInseam) / 3) * 0.15;
  if (adjustment !== 0) {
    yards += adjustment;
    const direction = adjustment > 0 ? 'longer' : 'shorter';
    notes.push(`Inseam ${direction} than standard 30": ${adjustment > 0 ? '+' : ''}${adjustment.toFixed(2)} yd`);
  }

  return { yards, notes };
}

function calculateSkirt({ waist, length }) {
  const breakpoints = [26, 30, 34, 38, 42];
  const baseYardage = [1.0, 1.25, 1.5, 1.75, 2.0, 2.25];
  const idx = bucketIndex(waist, breakpoints);
  let yards = baseYardage[idx];
  const notes = [`Size bucket ${SIZE_LABELS[idx]} (waist ${waist}")`];

  if (length <= 18) {
    notes.push('Mini length: no adjustment');
  } else if (length <= 24) {
    yards += 0.5;
    notes.push('Knee length: +0.5 yd');
  } else if (length <= 35) {
    yards += 1.0;
    notes.push('Midi length: +1.0 yd');
  } else {
    yards += 1.75;
    notes.push('Maxi length: +1.75 yd');
  }

  return { yards, notes };
}

const CALCULATORS = {
  't-shirt': calculateTShirt,
  dress: calculateDress,
  pants: calculatePants,
  skirt: calculateSkirt,
};

export function calculateYardage(garmentType, measurements) {
  const calculator = CALCULATORS[garmentType];
  const config = GARMENT_TYPES[garmentType];
  if (!calculator || !config) {
    throw new Error(`Unknown garment type: ${garmentType}`);
  }

  for (const field of config.measurements) {
    const value = measurements[field.key];
    if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
      throw new Error(`Missing or invalid measurement: ${field.label}`);
    }
  }

  const { yards, notes } = calculator(measurements);
  // Round to the nearest quarter yard, since that's how fabric is sold.
  const estimatedYards = Math.max(0.5, Math.round(yards * 4) / 4);

  return {
    garmentType,
    estimatedYards,
    notes,
    disclaimer: 'Rough estimate from a simplified lookup table (assumes ~44-60" wide fabric). Buy a bit extra.',
  };
}
