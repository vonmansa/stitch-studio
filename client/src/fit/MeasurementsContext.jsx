import { createContext, useContext, useEffect, useState } from 'react';
import { GARMENTS } from './garments.js';
import { BODY_FIELDS, DEFAULT_BODY, FABRICS } from './fitCheck.js';

const STORAGE_KEY = 'stitch-studio:fit';

export const SEAM_ALLOWANCES = [
  { value: 0.375, label: '⅜ in (1 cm)' },
  { value: 0.5, label: '½ in (1.3 cm)' },
  { value: 0.625, label: '⅝ in (1.5 cm)' },
  { value: 1, label: '1 in (2.5 cm)' },
];

const DEFAULT_OPTIONS = { seamAllowance: 0.625, includeDetails: true, includePockets: true };

const MeasurementsContext = createContext(null);

// localStorage is user-editable and may hold data from an older version
// of the app, and saved projects come from the API — so every value is
// re-validated instead of trusted.
function sanitizeNumbers(saved, fields, defaults) {
  const result = { ...defaults };
  for (const { key, min, max } of fields) {
    const value = Number(saved?.[key]);
    if (Number.isFinite(value)) result[key] = Math.min(max, Math.max(min, value));
  }
  return result;
}

function sanitizeOptions(saved) {
  return {
    seamAllowance: SEAM_ALLOWANCES.some((sa) => sa.value === saved?.seamAllowance)
      ? saved.seamAllowance
      : DEFAULT_OPTIONS.seamAllowance,
    includeDetails: typeof saved?.includeDetails === 'boolean' ? saved.includeDetails : true,
    includePockets: typeof saved?.includePockets === 'boolean' ? saved.includePockets : true,
  };
}

const sanitizeGarment = (type, saved) =>
  sanitizeNumbers(saved, GARMENTS[type].measurements, GARMENTS[type].defaults);

// A saved project pattern: { type, garment, body, fabric, seamAllowance, ... }.
// Patterns saved before tops existed have no type and are pants.
export function sanitizePattern(saved) {
  const type = saved?.type in GARMENTS ? saved.type : 'pants';
  return {
    type,
    garment: sanitizeGarment(type, saved?.garment),
    body: sanitizeNumbers(saved?.body, BODY_FIELDS, DEFAULT_BODY),
    fabric: saved?.fabric in FABRICS ? saved.fabric : 'woven',
    options: sanitizeOptions(saved),
  };
}

function loadState() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    saved = null;
  }
  const garments = Object.fromEntries(
    Object.keys(GARMENTS).map((type) => [
      type,
      // Older versions stored only pants, under `garment`.
      sanitizeGarment(type, saved?.garments?.[type] ?? (type === 'pants' ? saved?.garment : null)),
    ])
  );
  return {
    garmentType: saved?.garmentType in GARMENTS ? saved.garmentType : 'pants',
    garments,
    body: sanitizeNumbers(saved?.body, BODY_FIELDS, DEFAULT_BODY),
    fabric: saved?.fabric in FABRICS ? saved.fabric : 'woven',
    options: sanitizeOptions(saved?.options),
  };
}

export function MeasurementsProvider({ children }) {
  const [state, setState] = useState(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable (private mode, quota); the app still works without it.
    }
  }, [state]);

  const resolve = (next, prev) => (typeof next === 'function' ? next(prev) : next);
  const updater = (field) => (next) =>
    setState((prev) => ({ ...prev, [field]: resolve(next, prev[field]) }));

  const value = {
    garmentType: state.garmentType,
    garmentModel: GARMENTS[state.garmentType],
    setGarmentType: (type) => setState((prev) => ({ ...prev, garmentType: type })),
    garment: state.garments[state.garmentType],
    setGarment: (next) =>
      setState((prev) => ({
        ...prev,
        garments: {
          ...prev.garments,
          [prev.garmentType]: resolve(next, prev.garments[prev.garmentType]),
        },
      })),
    body: state.body,
    setBody: updater('body'),
    fabric: state.fabric,
    setFabric: updater('fabric'),
    options: state.options,
    setOptions: updater('options'),
    loadPattern: (saved) => {
      const p = sanitizePattern(saved);
      setState((prev) => ({
        ...prev,
        garmentType: p.type,
        garments: { ...prev.garments, [p.type]: p.garment },
        body: p.body,
        fabric: p.fabric,
        options: p.options,
      }));
    },
  };

  return <MeasurementsContext.Provider value={value}>{children}</MeasurementsContext.Provider>;
}

export function useMeasurements() {
  return useContext(MeasurementsContext);
}
