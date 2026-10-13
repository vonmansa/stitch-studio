import { useRef, useState } from 'react';
import {
  MEASUREMENTS,
  MEASUREMENT_BY_KEY,
  DEFAULT_MEASUREMENTS,
  FIT_PRESETS,
  VIEW_WIDTH,
  VIEW_HEIGHT,
  applyPreset,
  detectPreset,
  clampMeasurement,
  snapQuarter,
  toCm,
  fromCm,
  getGeometry,
  getHandlePosition,
  valueForPointer,
} from '../fit/pantsModel.js';
import PantsDrawing from '../fit/PantsDrawing.jsx';
import { useMeasurements } from '../fit/MeasurementsContext.jsx';
import NumberField from '../components/NumberField.jsx';

const formatIn = (v) => `${Number(v.toFixed(2))}`;
const formatCm = (v) => toCm(v).toFixed(1);

export default function FitStudio() {
  const { garment: measurements, setGarment: setMeasurements } = useMeasurements();
  const [selected, setSelected] = useState('hip');
  const [dragKey, setDragKey] = useState(null);
  const svgRef = useRef(null);

  const geometry = getGeometry(measurements);
  const activePreset = detectPreset(measurements);

  function setMeasurement(key, value) {
    setMeasurements((prev) => ({ ...prev, [key]: clampMeasurement(key, value) }));
  }

  function toSvgPoint(e) {
    const svg = svgRef.current;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const { x, y } = p.matrixTransform(svg.getScreenCTM().inverse());
    return [x, y];
  }

  function handlePointerDown(e, key) {
    e.stopPropagation();
    setSelected(key);
    setDragKey(key);
    svgRef.current.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e) {
    if (!dragKey) return;
    const value = valueForPointer(dragKey, measurements, toSvgPoint(e));
    if (value !== measurements[dragKey]) setMeasurement(dragKey, value);
  }

  function endDrag() {
    setDragKey(null);
  }

  // Clicking the garment body (not a handle) selects whichever
  // circumference line is closest to where you clicked.
  function handleBodyClick(e) {
    const [, y] = toSvgPoint(e);
    const levels = {
      waist: geometry.waistY,
      hip: geometry.hipY,
      thigh: geometry.crotchY,
      knee: geometry.kneeY,
      hem: geometry.hemY,
    };
    const nearest = Object.entries(levels).reduce((best, entry) =>
      Math.abs(entry[1] - y) < Math.abs(best[1] - y) ? entry : best
    );
    setSelected(nearest[0]);
  }

  // Arrow keys nudge the selected measurement: left/right for widths,
  // up/down for lengths. Shift moves a full inch instead of a quarter.
  function handleKeyDown(e) {
    const { axis } = MEASUREMENT_BY_KEY[selected];
    const step = e.shiftKey ? 1 : 0.25;
    const deltas =
      axis === 'x' ? { ArrowRight: step, ArrowLeft: -step } : { ArrowDown: step, ArrowUp: -step };
    if (!(e.key in deltas)) return;
    e.preventDefault();
    setMeasurement(selected, measurements[selected] + deltas[e.key]);
  }

  return (
    <div className="fit-studio">
      <div className="page-header">
        <div>
          <h1>Fit Studio</h1>
          <p className="muted">
            Drag the handles on the pants (or click a part to select it) to change the fit.
            Arrow keys nudge the selected measurement by ¼″, Shift + arrow by 1″.
          </p>
        </div>
      </div>

      <div className="fit-presets" role="group" aria-label="Fit presets">
        {Object.entries(FIT_PRESETS).map(([key, preset]) => (
          <button
            key={key}
            type="button"
            className={`chip ${activePreset === key ? 'chip-active' : ''}`}
            onClick={() => setMeasurements((prev) => applyPreset(prev, key))}
          >
            {preset.label}
          </button>
        ))}
        <span className="muted fit-current">
          Current fit: <strong>{activePreset ? FIT_PRESETS[activePreset].label : 'Custom'}</strong>
        </span>
      </div>

      <div className="fit-layout">
        <div className="fit-canvas">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            tabIndex={0}
            role="application"
            aria-label={`Pants model. Selected: ${MEASUREMENT_BY_KEY[selected].label}`}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={handleKeyDown}
            className={dragKey ? 'dragging' : ''}
          >
            <PantsDrawing geometry={geometry} onBodyPointerDown={handleBodyClick} />
            <DimensionLine
              measurementKey={selected}
              geometry={geometry}
              value={measurements[selected]}
            />
            {MEASUREMENTS.map(({ key, axis, label }) => {
              const [x, y] = getHandlePosition(key, measurements);
              return (
                <g
                  key={key}
                  className={`handle handle-${axis} ${selected === key ? 'handle-selected' : ''}`}
                  onPointerDown={(e) => handlePointerDown(e, key)}
                >
                  <title>{label}</title>
                  <circle cx={x} cy={y} r={14} className="handle-hit" />
                  <circle cx={x} cy={y} r={selected === key ? 7 : 5.5} className="handle-dot" />
                </g>
              );
            })}
          </svg>
        </div>

        <MeasurementPanel
          measurements={measurements}
          selected={selected}
          onSelect={setSelected}
          onChange={setMeasurement}
          onReset={() => setMeasurements(DEFAULT_MEASUREMENTS)}
        />
      </div>
    </div>
  );
}

// Shows where the selected measurement is taken, with its value in both units.
function DimensionLine({ measurementKey, geometry: g, value }) {
  const label = `${formatIn(value)} in · ${formatCm(value)} cm`;
  const L = g.left;
  const R = g.right;

  let x1, y1, x2, y2;
  switch (measurementKey) {
    case 'waist':
      [x1, y1, x2, y2] = [L.waist[0], g.waistY - 14, R.waist[0], g.waistY - 14];
      break;
    case 'hip':
      [x1, y1, x2, y2] = [L.hip[0], g.hipY, R.hip[0], g.hipY];
      break;
    case 'thigh':
      [x1, y1, x2, y2] = [L.thighOuter[0], g.crotchY, R.thighOuter[0], g.crotchY];
      break;
    case 'knee':
      [x1, y1, x2, y2] = [R.kneeInner[0], g.kneeY, R.kneeOuter[0], g.kneeY];
      break;
    case 'hem':
      [x1, y1, x2, y2] = [R.hemInner[0], g.hemY + 14, R.hemOuter[0], g.hemY + 14];
      break;
    case 'rise': {
      const x = Math.min(L.hip[0], L.thighOuter[0]) - 18;
      [x1, y1, x2, y2] = [x, g.waistY, x, g.crotchY];
      break;
    }
    case 'inseam': {
      const x = Math.max(R.thighOuter[0], R.kneeOuter[0], R.hemOuter[0]) + 18;
      [x1, y1, x2, y2] = [x, g.crotchY, x, g.hemY];
      break;
    }
    default:
      return null;
  }

  const vertical = x1 === x2;
  const labelX = vertical ? Math.min(x1 + 6, 330) : (x1 + x2) / 2;
  const labelY = vertical ? (y1 + y2) / 2 : y1 - 8;
  const anchor = vertical ? (x1 > g.cx ? 'end' : 'start') : 'middle';
  const labelOffset = vertical ? (x1 > g.cx ? -12 : 12) : 0;

  return (
    <g className="dimension" pointerEvents="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {vertical ? (
        <>
          <line x1={x1 - 5} y1={y1} x2={x1 + 5} y2={y1} />
          <line x1={x2 - 5} y1={y2} x2={x2 + 5} y2={y2} />
        </>
      ) : (
        <>
          <line x1={x1} y1={y1 - 5} x2={x1} y2={y1 + 5} />
          <line x1={x2} y1={y2 - 5} x2={x2} y2={y2 + 5} />
        </>
      )}
      <text
        x={vertical ? x1 + labelOffset : labelX}
        y={labelY}
        textAnchor={anchor}
        className="dimension-label"
      >
        {label}
      </text>
    </g>
  );
}

function MeasurementPanel({ measurements, selected, onSelect, onChange, onReset }) {
  const outseam = measurements.rise + measurements.inseam;
  return (
    <aside className="fit-panel">
      <table className="measure-table">
        <thead>
          <tr>
            <th scope="col">Measurement</th>
            <th scope="col">in</th>
            <th scope="col">cm</th>
          </tr>
        </thead>
        <tbody>
          {MEASUREMENTS.map(({ key, label }) => (
            <tr
              key={key}
              className={selected === key ? 'row-selected' : ''}
              onClick={() => onSelect(key)}
            >
              <th scope="row">
                <button type="button" className="row-button" onClick={() => onSelect(key)}>
                  {label}
                </button>
              </th>
              <td>{formatIn(measurements[key])}</td>
              <td>{formatCm(measurements[key])}</td>
            </tr>
          ))}
          <tr className="row-derived">
            <th scope="row">Outseam (approx.)</th>
            <td>{formatIn(outseam)}</td>
            <td>{formatCm(outseam)}</td>
          </tr>
        </tbody>
      </table>

      <SelectedEditor
        measurementKey={selected}
        value={measurements[selected]}
        onChange={(v) => onChange(selected, v)}
      />

      <button type="button" className="button button-secondary" onClick={onReset}>
        Reset to default
      </button>
    </aside>
  );
}

function SelectedEditor({ measurementKey, value, onChange }) {
  const { label, hint, min, max } = MEASUREMENT_BY_KEY[measurementKey];
  return (
    <div className="selected-editor">
      <h2>{label}</h2>
      <p className="muted">{hint}</p>
      <input
        type="range"
        min={min}
        max={max}
        step={0.25}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={`${label} in inches`}
      />
      <div className="dual-inputs">
        <label>
          inches
          <NumberField
            value={value}
            display={formatIn}
            step={0.25}
            onCommit={(n) => onChange(snapQuarter(n))}
          />
        </label>
        <label>
          cm
          <NumberField
            value={value}
            display={formatCm}
            step={0.5}
            onCommit={(n) => onChange(fromCm(n))}
          />
        </label>
      </div>
      <p className="muted range-note">
        Range {min}–{max} in ({toCm(min).toFixed(0)}–{toCm(max).toFixed(0)} cm)
      </p>
    </div>
  );
}
