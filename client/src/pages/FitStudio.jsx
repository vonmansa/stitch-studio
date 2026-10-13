import { useRef, useState } from 'react';
import { snapQuarter, toCm, fromCm } from '../fit/pantsModel.js';
import { applyPreset, detectPreset, clampFor, specFor } from '../fit/garments.js';
import { valueForPointer, handleDirection, cursorFor, increaseKeys } from '../fit/drag.js';
import { useMeasurements } from '../fit/MeasurementsContext.jsx';
import NumberField from '../components/NumberField.jsx';
import GarmentTabs from '../components/GarmentTabs.jsx';

const formatIn = (v) => `${Number(v.toFixed(2))}`;
const formatCm = (v) => toCm(v).toFixed(1);

export default function FitStudio() {
  const {
    garmentModel: model,
    garment: measurements,
    setGarment: setMeasurements,
    options,
  } = useMeasurements();
  const [selectedKey, setSelected] = useState(null);
  const [dragKey, setDragKey] = useState(null);
  const svgRef = useRef(null);

  // Switching garments keeps the selection if the new garment has the
  // same measurement (waist, hem…), otherwise falls back to its main one.
  const selected = specFor(model, selectedKey) ? selectedKey : model.presetBase;
  const geometry = model.getGeometry(measurements);
  const activePreset = detectPreset(model, measurements);
  const Drawing = model.Drawing;

  function setMeasurement(key, value) {
    setMeasurements((prev) => ({ ...prev, [key]: clampFor(model, key, value) }));
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
    const value = valueForPointer(model.getHandle, specFor(model, dragKey), measurements, toSvgPoint(e));
    if (value !== measurements[dragKey]) setMeasurement(dragKey, value);
  }

  function endDrag() {
    setDragKey(null);
  }

  function handleBodyClick(e) {
    setSelected(model.clickTarget(geometry, toSvgPoint(e)));
  }

  // Arrow keys nudge the selected measurement in the direction its handle
  // moves. Shift moves a full inch instead of a quarter.
  function handleKeyDown(e) {
    const keys = increaseKeys(handleDirection(model.getHandle, specFor(model, selected), measurements));
    const step = e.shiftKey ? 1 : 0.25;
    const delta = e.key === keys.up ? step : e.key === keys.down ? -step : 0;
    if (!delta) return;
    e.preventDefault();
    setMeasurement(selected, measurements[selected] + delta);
  }

  return (
    <div className="fit-studio">
      <div className="page-header">
        <div>
          <h1>Fit Studio</h1>
          <p className="muted">
            Drag the handles on the garment (or click a part to select it) to change the fit. Arrow
            keys nudge the selected measurement by ¼″, Shift + arrow by 1″.
          </p>
        </div>
      </div>

      <GarmentTabs />

      <div className="fit-presets" role="group" aria-label="Fit presets">
        {Object.entries(model.presets).map(([key, preset]) => (
          <button
            key={key}
            type="button"
            className={`chip ${activePreset === key ? 'chip-active' : ''}`}
            onClick={() => setMeasurements((prev) => applyPreset(model, prev, key))}
          >
            {preset.label}
          </button>
        ))}
        <span className="muted fit-current">
          Current fit: <strong>{activePreset ? model.presets[activePreset].label : 'Custom'}</strong>
        </span>
      </div>

      <div className="fit-layout">
        <div className="fit-canvas">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${model.view.width} ${model.view.height}`}
            tabIndex={0}
            role="application"
            aria-label={`${model.label} model. Selected: ${specFor(model, selected).label}`}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={handleKeyDown}
            className={dragKey ? 'dragging' : ''}
          >
            <Drawing
              geometry={geometry}
              onBodyPointerDown={handleBodyClick}
              showPockets={options.includePockets}
            />
            <DimensionLine
              line={model.getDimension(selected, geometry)}
              value={measurements[selected]}
              geometry={geometry}
              viewWidth={model.view.width}
            />
            {model.measurements.map((spec) => {
              const [x, y] = model.getHandle(spec.key, measurements);
              const cursor = cursorFor(handleDirection(model.getHandle, spec, measurements));
              return (
                <g
                  key={spec.key}
                  className={`handle ${selected === spec.key ? 'handle-selected' : ''}`}
                  style={{ cursor }}
                  onPointerDown={(e) => handlePointerDown(e, spec.key)}
                >
                  <title>{spec.label}</title>
                  <circle cx={x} cy={y} r={14} className="handle-hit" />
                  <circle cx={x} cy={y} r={selected === spec.key ? 7 : 5.5} className="handle-dot" />
                </g>
              );
            })}
          </svg>
        </div>

        <MeasurementPanel
          model={model}
          measurements={measurements}
          selected={selected}
          onSelect={setSelected}
          onChange={setMeasurement}
          onReset={() => setMeasurements(model.defaults)}
        />
      </div>
    </div>
  );
}

// Shows where the selected measurement is taken, with its value in both
// units. Works for horizontal, vertical and diagonal (sleeve) lines.
function DimensionLine({ line, value, geometry, viewWidth }) {
  if (!line) return null;
  const [x1, y1, x2, y2] = line;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const tick = [(-dy / len) * 5, (dx / len) * 5];
  const label = `${formatIn(value)} in · ${formatCm(value)} cm`;

  let lx = (x1 + x2) / 2;
  let ly = (y1 + y2) / 2;
  let anchor = 'middle';
  if (Math.abs(dx) < Math.abs(dy) * 0.3) {
    // Vertical: label beside the line, on whichever side has room.
    const roomRight = x1 + 150 < viewWidth;
    lx = x1 + (roomRight ? 8 : -8);
    anchor = roomRight ? 'start' : 'end';
  } else if (Math.abs(dy) < Math.abs(dx) * 0.3) {
    ly = Math.min(y1, y2) - 8;
  } else {
    // Diagonal: offset perpendicular to the line, on the upper side.
    const perp = [-dy / len, dx / len];
    const up = perp[1] < 0 ? perp : [-perp[0], -perp[1]];
    lx += up[0] * 14;
    ly += up[1] * 14;
    anchor = lx > geometry.cx ? 'start' : 'end';
  }

  return (
    <g className="dimension" pointerEvents="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <line x1={x1 - tick[0]} y1={y1 - tick[1]} x2={x1 + tick[0]} y2={y1 + tick[1]} />
      <line x1={x2 - tick[0]} y1={y2 - tick[1]} x2={x2 + tick[0]} y2={y2 + tick[1]} />
      <text x={lx} y={ly} textAnchor={anchor} className="dimension-label">
        {label}
      </text>
    </g>
  );
}

function MeasurementPanel({ model, measurements, selected, onSelect, onChange, onReset }) {
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
          {model.measurements.map(({ key, label }) => (
            <tr key={key} className={selected === key ? 'row-selected' : ''} onClick={() => onSelect(key)}>
              <th scope="row">
                <button type="button" className="row-button" onClick={() => onSelect(key)}>
                  {label}
                </button>
              </th>
              <td>{formatIn(measurements[key])}</td>
              <td>{formatCm(measurements[key])}</td>
            </tr>
          ))}
          {model.derived.map(({ label, value }) => (
            <tr key={label} className="row-derived">
              <th scope="row">{label}</th>
              <td>{formatIn(value(measurements))}</td>
              <td>{formatCm(value(measurements))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <SelectedEditor spec={specFor(model, selected)} value={measurements[selected]} onChange={(v) => onChange(selected, v)} />

      <button type="button" className="button button-secondary" onClick={onReset}>
        Reset to default
      </button>
    </aside>
  );
}

function SelectedEditor({ spec, value, onChange }) {
  const { label, hint, min, max } = spec;
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
          <NumberField value={value} display={formatIn} step={0.25} onCommit={(n) => onChange(snapQuarter(n))} />
        </label>
        <label>
          cm
          <NumberField value={value} display={formatCm} step={0.5} onCommit={(n) => onChange(fromCm(n))} />
        </label>
      </div>
      <p className="muted range-note">
        Range {min}–{max} in ({toCm(min).toFixed(0)}–{toCm(max).toFixed(0)} cm)
      </p>
    </div>
  );
}
