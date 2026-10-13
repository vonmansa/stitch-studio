import { GARMENTS } from '../fit/garments.js';
import { useMeasurements } from '../fit/MeasurementsContext.jsx';

export default function GarmentTabs() {
  const { garmentType, setGarmentType } = useMeasurements();
  return (
    <div className="garment-tabs" role="tablist" aria-label="Garment type">
      {Object.values(GARMENTS).map((g) => (
        <button
          key={g.type}
          type="button"
          role="tab"
          aria-selected={garmentType === g.type}
          className={garmentType === g.type ? 'active' : ''}
          onClick={() => setGarmentType(g.type)}
        >
          {g.label}
        </button>
      ))}
    </div>
  );
}
