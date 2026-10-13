import NumberField from './NumberField.jsx';
import { BODY_FIELDS } from '../fit/fitCheck.js';
import { toCm, fromCm } from '../fit/pantsModel.js';

const formatIn = (v) => `${Number(v.toFixed(2))}`;
const formatCm = (v) => toCm(v).toFixed(1);

export default function BodyForm({ fields, body, setBody }) {
  const update = (key, inches) => {
    const { min, max } = BODY_FIELDS.find((f) => f.key === key);
    setBody((prev) => ({ ...prev, [key]: Math.min(max, Math.max(min, inches)) }));
  };

  return (
    <div className="fit-panel">
      <h3>Your body measurements</h3>
      <table className="measure-table body-form">
        <thead>
          <tr>
            <th scope="col">Body</th>
            <th scope="col">in</th>
            <th scope="col">cm</th>
          </tr>
        </thead>
        <tbody>
          {BODY_FIELDS.filter((f) => fields.includes(f.key)).map(({ key, label }) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              <td>
                <NumberField
                  value={body[key]}
                  display={formatIn}
                  step={0.25}
                  onCommit={(n) => update(key, n)}
                  aria-label={`Body ${label} in inches`}
                />
              </td>
              <td>
                <NumberField
                  value={body[key]}
                  display={formatCm}
                  step={0.5}
                  onCommit={(n) => update(key, fromCm(n))}
                  aria-label={`Body ${label} in centimeters`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
