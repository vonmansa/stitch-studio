import { useState } from 'react';
import { useMeasurements } from '../fit/MeasurementsContext.jsx';
import { clampFor, detectPreset, specFor } from '../fit/garments.js';
import { BODY_FIELDS, BODY_FIELDS_BY_CATEGORY, FABRICS, checkFit } from '../fit/fitCheck.js';
import { buildSheet, PatternSheet } from '../fit/PatternSheet.jsx';
import GarmentTabs from '../components/GarmentTabs.jsx';
import BodyForm from '../components/BodyForm.jsx';
import { FitCanvas, FitPresets, SelectedEditor } from '../components/FitEditor.jsx';
import Viewer3D from '../three/Viewer3D.jsx';
import { POSES } from '../three/body.js';

// Body measurements the 3D mannequin is built from, whatever the garment.
const MANNEQUIN_FIELDS = ['height', 'neck', 'shoulder', 'chest', 'waist', 'hip', 'bicep', 'armLength', 'thigh', 'knee', 'inseam'];

export default function Studio3D() {
  const {
    garmentType,
    garmentModel: model,
    garment,
    setGarment,
    body,
    setBody,
    fabric,
    setFabric,
    options,
  } = useMeasurements();
  const [selectedKey, setSelected] = useState(null);
  const [pane, setPane] = useState('fit');
  const [mode, setMode] = useState('fit');
  const [simMode, setSimMode] = useState('sewn');
  const [pose, setPose] = useState('apose');

  // Selection is shared: picking a part in 2D highlights it in 3D and vice versa.
  const selected = specFor(model, selectedKey) ? selectedKey : model.presetBase;
  const setMeasurement = (key, value) => setGarment((prev) => ({ ...prev, [key]: clampFor(model, key, value) }));

  const fit = checkFit(garmentType, model.category, garment, body, fabric);
  const areaVerdicts = Object.fromEntries(fit.areas.map((a) => [a.key, a.verdict]));

  return (
    <div className="studio">
      <div className="page-header">
        <div>
          <h1>3D Studio</h1>
          <p className="muted">
            Your drafted pattern pieces, sewn together and draped on a mannequin built from your
            body measurements. Tweak in 2D or directly on the 3D garment — click a part, then drag
            sideways for width or up/down for length. Drag empty space to rotate, scroll to zoom.
          </p>
        </div>
      </div>

      <div className="studio-toolbar">
        <GarmentTabs />
        <div className="toolbar">
          <label>
            Pose
            <select value={pose} onChange={(e) => setPose(e.target.value)}>
              {Object.entries(POSES).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fabric
            <select value={fabric} onChange={(e) => setFabric(e.target.value)}>
              {Object.entries(FABRICS).map(([key, f]) => (
                <option key={key} value={key}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <div
            className="segmented"
            role="group"
            aria-label="Simulation"
            title="Sewn pattern: the drafted pieces are sewn together and draped (re-drapes after each edit). Quick: an approximate garment that updates live while you drag."
          >
            {[
              ['sewn', 'Sewn pattern'],
              ['quick', 'Quick'],
            ].map(([key, label]) => (
              <button key={key} type="button" className={simMode === key ? 'active' : ''} onClick={() => setSimMode(key)}>
                {label}
              </button>
            ))}
          </div>
          <div className="segmented" role="group" aria-label="3D view">
            {[
              ['fit', 'Fit map'],
              ['fabric', 'Fabric'],
            ].map(([key, label]) => (
              <button key={key} type="button" className={mode === key ? 'active' : ''} onClick={() => setMode(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <FitPresets model={model} setMeasurements={setGarment} active={detectPreset(model, garment)} />

      <div className="studio-layout">
        <section className="studio-2d" aria-label="2D editor">
          <div className="segmented" role="tablist" aria-label="2D view">
            {[
              ['fit', 'Fit model'],
              ['pattern', 'Pattern pieces'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={pane === key}
                className={pane === key ? 'active' : ''}
                onClick={() => setPane(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {pane === 'fit' ? (
            <FitCanvas
              model={model}
              measurements={garment}
              setMeasurement={setMeasurement}
              selected={selected}
              onSelect={setSelected}
              showPockets={options.includePockets}
            />
          ) : (
            <div className="pattern-sheet-wrap studio-pattern">
              <PatternSheet sheet={buildSheet(garmentType, garment, options)} gridUnit="in" />
            </div>
          )}
          <div className="fit-panel">
            <SelectedEditor
              spec={specFor(model, selected)}
              value={garment[selected]}
              onChange={(v) => setMeasurement(selected, v)}
            />
          </div>
        </section>

        <section className="studio-3d" aria-label="3D view">
          <Viewer3D
            model={model}
            garment={garment}
            body={body}
            fabric={fabric}
            mode={mode}
            simMode={simMode}
            pose={pose}
            areaVerdicts={areaVerdicts}
            selected={selected}
            onSelect={setSelected}
            onAdjust={setMeasurement}
          />
        </section>
      </div>

      <details className="studio-body">
        <summary>Body measurements (mannequin)</summary>
        <p className="muted small">
          The mannequin is built from these: height and inseam set its proportions. The{' '}
          {model.category === 'tops' ? 'top' : 'pants'} fit check uses:{' '}
          {BODY_FIELDS.filter((f) => BODY_FIELDS_BY_CATEGORY[model.category].includes(f.key))
            .map((f) => f.label.toLowerCase())
            .join(', ')}
          .
        </p>
        <BodyForm fields={MANNEQUIN_FIELDS} body={body} setBody={setBody} />
      </details>
    </div>
  );
}
