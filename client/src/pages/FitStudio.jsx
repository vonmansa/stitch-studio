import { useState } from 'react';
import { Link } from 'react-router-dom';
import { detectPreset, clampFor, specFor } from '../fit/garments.js';
import { useMeasurements } from '../fit/MeasurementsContext.jsx';
import GarmentTabs from '../components/GarmentTabs.jsx';
import { FitCanvas, FitPresets, MeasurementPanel } from '../components/FitEditor.jsx';

export default function FitStudio() {
  const {
    garmentModel: model,
    garment: measurements,
    setGarment: setMeasurements,
    options,
  } = useMeasurements();
  const [selectedKey, setSelected] = useState(null);

  // Switching garments keeps the selection if the new garment has the
  // same measurement (waist, hem…), otherwise falls back to its main one.
  const selected = specFor(model, selectedKey) ? selectedKey : model.presetBase;
  const activePreset = detectPreset(model, measurements);

  function setMeasurement(key, value) {
    setMeasurements((prev) => ({ ...prev, [key]: clampFor(model, key, value) }));
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
        <Link to="/studio" className="button">
          Open in 3D
        </Link>
      </div>

      <GarmentTabs />

      <FitPresets model={model} setMeasurements={setMeasurements} active={activePreset} />

      <div className="fit-layout">
        <FitCanvas
          model={model}
          measurements={measurements}
          setMeasurement={setMeasurement}
          selected={selected}
          onSelect={setSelected}
          showPockets={options.includePockets}
        />
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
