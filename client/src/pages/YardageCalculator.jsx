import { useEffect, useState } from 'react';
import { getGarmentTypes, calculateYardage } from '../api/client.js';

export default function YardageCalculator() {
  const [garmentTypes, setGarmentTypes] = useState({});
  const [garmentType, setGarmentType] = useState('');
  const [measurements, setMeasurements] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getGarmentTypes().then((types) => {
      setGarmentTypes(types);
      const firstType = Object.keys(types)[0];
      setGarmentType(firstType);
    });
  }, []);

  // Whenever the garment type changes, reset the measurement inputs to
  // match its config (e.g. switching from t-shirt to dress adds a "waist" field).
  function handleGarmentChange(e) {
    setGarmentType(e.target.value);
    setMeasurements({});
    setResult(null);
  }

  function handleMeasurementChange(key, value) {
    setMeasurements((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      const numericMeasurements = Object.fromEntries(
        Object.entries(measurements).map(([key, value]) => [key, parseFloat(value)])
      );
      const data = await calculateYardage(garmentType, numericMeasurements);
      setResult(data);
    } catch (err) {
      setError(err.message);
      setResult(null);
    }
  }

  const fields = garmentTypes[garmentType]?.measurements || [];

  return (
    <div className="form-page">
      <h1>Yardage Calculator</h1>
      <p className="muted">
        Pick a garment type, enter your measurements, and get a rough fabric estimate.
      </p>

      <form onSubmit={handleSubmit} className="project-form">
        <label>
          Garment Type
          <select value={garmentType} onChange={handleGarmentChange}>
            {Object.entries(garmentTypes).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>
        </label>

        {fields.map((field) => (
          <label key={field.key}>
            {field.label} ({field.unit})
            <input
              type="number"
              step="0.5"
              min="0"
              required
              value={measurements[field.key] || ''}
              onChange={(e) => handleMeasurementChange(field.key, e.target.value)}
            />
          </label>
        ))}

        <div className="card-actions">
          <button type="submit" className="button">
            Calculate
          </button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="result-box">
          <h2>Estimated yardage: {result.estimatedYards} yd</h2>
          <ul>
            {result.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
          <p className="muted">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
