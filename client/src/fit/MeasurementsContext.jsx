import { createContext, useContext, useEffect, useState } from 'react';
import { MEASUREMENTS, DEFAULT_MEASUREMENTS, clampMeasurement } from './pantsModel.js';
import { BODY_FIELDS, DEFAULT_BODY, FABRICS } from './fitCheck.js';

const STORAGE_KEY = 'stitch-studio:fit';

export const SEAM_ALLOWANCES = [
  { value: 0.375, label: '⅜ in (1 cm)' },
  { value: 0.5, label: '½ in (1.3 cm)' },
  { value: 0.625, label: '⅝ in (1.5 cm)' },
  { value: 1, label: '1 in (2.5 cm)' },
];

const DEFAULT_OPTIONS = { seamAllowance: 0.625, includeDetails: true, includePockets: true };

function sanitizeOptions(saved) {
  return {
    seamAllowance: SEAM_ALLOWANCES.some((sa) => sa.value === saved?.seamAllowance)
      ? saved.seamAllowance
      : DEFAULT_OPTIONS.seamAllowance,
    includeDetails: typeof saved?.includeDetails === 'boolean' ? saved.includeDetails : true,
    includePockets: typeof saved?.includePockets === 'boolean' ? saved.includePockets : true,
  };
}
const MeasurementsContext = createContext(null);

// localStorage is user-editable and may hold data from an older version
// of the app, so every value is re-validated instead of trusted.
function sanitize(saved, fields, defaults, clamp) {
  const result = { ...defaults };
  for (const { key, min, max } of fields) {
    const value = Number(saved?.[key]);
    if (Number.isFinite(value)) result[key] = clamp ? clamp(key, value) : Math.min(max, Math.max(min, value));
  }
  return result;
}

// Shared by localStorage restore and loading a pattern saved on a
// project, since both are untrusted input in the same shape.
export function sanitizePattern(saved) {
  return {
    garment: sanitize(saved?.garment, MEASUREMENTS, DEFAULT_MEASUREMENTS, clampMeasurement),
    body: sanitize(saved?.body, BODY_FIELDS, DEFAULT_BODY),
    fabric: saved?.fabric in FABRICS ? saved.fabric : 'woven',
    options: sanitizeOptions(saved?.options ?? saved),
  };
}

function loadState() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    saved = null;
  }
  return sanitizePattern(saved);
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

  const updater = (field) => (next) =>
    setState((prev) => ({
      ...prev,
      [field]: typeof next === 'function' ? next(prev[field]) : next,
    }));

  const value = {
    garment: state.garment,
    setGarment: updater('garment'),
    body: state.body,
    setBody: updater('body'),
    fabric: state.fabric,
    setFabric: updater('fabric'),
    options: state.options,
    setOptions: updater('options'),
    loadPattern: (saved) => setState(sanitizePattern(saved)),
  };

  return <MeasurementsContext.Provider value={value}>{children}</MeasurementsContext.Provider>;
}

export function useMeasurements() {
  return useContext(MeasurementsContext);
}
