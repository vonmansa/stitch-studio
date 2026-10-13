import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMeasurements, SEAM_ALLOWANCES } from '../fit/MeasurementsContext.jsx';
import {
  MEASUREMENT_BY_KEY,
  VIEW_WIDTH,
  toCm,
  fromCm,
  getGeometry,
  getOutlinePath,
} from '../fit/pantsModel.js';
import { BODY_FIELDS, FABRICS, VERDICTS, checkFit } from '../fit/fitCheck.js';
import { buildSheet, PatternSheet } from '../fit/PatternSheet.jsx';
import PrintTiles, { PAPERS, tileLayout } from '../fit/PrintTiles.jsx';
import PantsDrawing from '../fit/PantsDrawing.jsx';
import NumberField from '../components/NumberField.jsx';
import { getProjects, savePattern } from '../api/client.js';

const formatIn = (v) => `${Number(v.toFixed(2))}`;
const formatCm = (v) => toCm(v).toFixed(1);
const signed = (v, digits) => {
  const abs = Math.abs(v).toFixed(digits);
  return Number(abs) === 0 ? abs : `${v > 0 ? '+' : '−'}${abs}`;
};

export default function PatternLab() {
  const { garment, body, setBody, fabric, setFabric, options, setOptions } = useMeasurements();
  const [gridUnit, setGridUnit] = useState('in');
  const [paperKey, setPaperKey] = useState('letter');
  const [printing, setPrinting] = useState(false);
  const svgRef = useRef(null);

  const sheet = buildSheet(garment, options);
  const tiles = tileLayout(sheet, paperKey);
  const fit = checkFit(garment, body, fabric);
  const setOption = (key, value) => setOptions((prev) => ({ ...prev, [key]: value }));

  // The print pages are only rendered while printing (they duplicate the
  // whole sheet once per page), then removed once the dialog closes.
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done, { once: true });
    window.print();
    return () => window.removeEventListener('afterprint', done);
  }, [printing]);

  function downloadSvg() {
    const svg = svgRef.current;
    const clone = svg.cloneNode(true);
    // Width/height in real inches make the file print at true scale.
    clone.setAttribute('width', `${sheet.width}in`);
    clone.setAttribute('height', `${sheet.height}in`);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.removeAttribute('class');
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
      type: 'image/svg+xml',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pants-pattern-w${garment.waist}-h${garment.hip}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="pattern-lab">
      <div className="page-header">
        <div>
          <h1>Pattern Lab</h1>
          <p className="muted">
            Pant pattern pieces drafted from your <Link to="/fit">Fit Studio</Link> measurements —
            change the fit there and the pattern updates here.
          </p>
        </div>
      </div>

      <SaveToProject pattern={{ garment, body, fabric, ...options }} />

      <section className="lab-section">
        <div className="section-heading">
          <h2>1. Pattern pieces</h2>
          <div className="toolbar">
            <label>
              Seam allowance
              <select
                value={options.seamAllowance}
                onChange={(e) => setOption('seamAllowance', parseFloat(e.target.value))}
              >
                {SEAM_ALLOWANCES.map((sa) => (
                  <option key={sa.value} value={sa.value}>
                    {sa.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="segmented" role="group" aria-label="Grid units">
              {['in', 'cm'].map((unit) => (
                <button
                  key={unit}
                  type="button"
                  className={gridUnit === unit ? 'active' : ''}
                  onClick={() => setGridUnit(unit)}
                >
                  {unit} grid
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="toolbar piece-toggles">
          <label className="check">
            <input
              type="checkbox"
              checked={options.includeDetails}
              onChange={(e) => setOption('includeDetails', e.target.checked)}
            />
            Waistband &amp; fly
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={options.includePockets}
              onChange={(e) => setOption('includePockets', e.target.checked)}
            />
            Pockets (side pocket bags + back patch pockets)
          </label>
        </div>

        <div className="pattern-sheet-wrap">
          <PatternSheet sheet={sheet} gridUnit={gridUnit} svgRef={svgRef} />
        </div>
        <p className="muted small">
          Solid outer line = cutting line, dashed line = stitching line, dash-dot line = fold.
          Single notch = front, double notch = back; the side pocket opening sits between the
          upper side-seam notches. Hem uses the same allowance as the seams; add extra for a
          deeper hem.
        </p>

        <div className="export-panel">
          <div>
            <h3>Print at home</h3>
            <p className="muted small">
              Prints on {tiles.count} {tiles.paper.label} pages
              {tiles.skipped > 0 && ` (${tiles.skipped} blank pages in the ${tiles.rows} × ${tiles.cols} grid are skipped)`}. Print at <strong>100% / actual size</strong>, check the test square on page
              A1, then trim along the dashed borders and tape pages together, matching the edge
              labels and grid lines.
            </p>
          </div>
          <div className="toolbar">
            <label>
              Paper
              <select value={paperKey} onChange={(e) => setPaperKey(e.target.value)}>
                {Object.entries(PAPERS).map(([key, paper]) => (
                  <option key={key} value={key}>
                    {paper.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="button" onClick={() => setPrinting(true)}>
              Print / save PDF
            </button>
            <button type="button" className="button button-secondary" onClick={downloadSvg}>
              Download SVG
            </button>
          </div>
        </div>

        <PatternCheck sheet={sheet} garment={garment} />
      </section>

      <section className="lab-section">
        <div className="section-heading">
          <h2>2. Test fit</h2>
          <div className="toolbar">
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
          </div>
        </div>

        <div className="tryon-layout">
          <TryOnView garment={garment} body={body} fit={fit} />
          <div className="tryon-side">
            <BodyForm body={body} setBody={setBody} />
            <FitResults fit={fit} />
          </div>
        </div>
      </section>

      {printing && <PrintTiles sheet={sheet} gridUnit={gridUnit} paperKey={paperKey} />}
    </div>
  );
}

function SaveToProject({ pattern }) {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState(null);
  const [projectId, setProjectId] = useState(searchParams.get('project') ?? '');
  const [status, setStatus] = useState(null);

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .catch((err) => setStatus({ error: `Couldn’t load projects: ${err.message}` }));
  }, []);

  async function handleSave() {
    setStatus({ saving: true });
    try {
      const saved = await savePattern(projectId, pattern);
      setStatus({ savedTo: saved });
    } catch (err) {
      setStatus({ error: err.message });
    }
  }

  if (projects && projects.length === 0) {
    return (
      <div className="save-bar">
        <span className="muted">
          <Link to="/projects/new">Create a project</Link> to save this pattern to it.
        </span>
      </div>
    );
  }

  return (
    <div className="save-bar">
      <label>
        Save pattern to project
        <select
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setStatus(null);
          }}
          disabled={!projects}
        >
          <option value="">{projects ? 'Choose a project…' : 'Loading…'}</option>
          {projects?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.pattern ? ' (has a saved pattern)' : ''}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="button"
        onClick={handleSave}
        disabled={!projectId || status?.saving}
      >
        {status?.saving ? 'Saving…' : 'Save'}
      </button>
      <span role="status" className="save-status">
        {status?.savedTo && (
          <>
            Saved to <Link to={`/projects/${status.savedTo.id}`}>{status.savedTo.name}</Link>
          </>
        )}
        {status?.error && <span className="error">{status.error}</span>}
      </span>
    </div>
  );
}

// Confirms the drafted pieces add back up to the finished measurements:
// waist/hip go around the whole body (2 fronts + 2 backs), leg
// measurements go around one leg (1 front + 1 back).
function PatternCheck({ sheet, garment }) {
  const [front, back] = sheet.main.map((m) => m.piece);
  const rows = [
    { key: 'waist', total: 2 * (front.widths.waist + back.widths.waist) },
    { key: 'hip', total: 2 * (front.widths.hip + back.widths.hip) },
    { key: 'thigh', total: front.widths.thigh + back.widths.thigh },
    { key: 'knee', total: front.widths.knee + back.widths.knee },
    { key: 'hem', total: front.widths.hem + back.widths.hem },
  ];

  return (
    <div className="table-scroll">
      <table className="measure-table pattern-check">
        <caption>Pattern check — seam-line totals vs. Fit Studio targets</caption>
        <thead>
          <tr>
            <th scope="col">Measurement</th>
            <th scope="col">Target</th>
            <th scope="col">Front + back</th>
            <th scope="col">Match</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, total }) => {
            const target = garment[key];
            const ok = Math.abs(total - target) < 0.05;
            return (
              <tr key={key}>
                <th scope="row">{MEASUREMENT_BY_KEY[key].label}</th>
                <td>
                  {formatIn(target)} in / {formatCm(target)} cm
                </td>
                <td>
                  {formatIn(total)} in / {formatCm(total)} cm
                </td>
                <td className={ok ? 'ok' : 'bad'}>{ok ? '✓' : '✗'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---- Test fit ----

const ANKLE = 9;

function TryOnView({ garment, body, fit }) {
  const pants = getGeometry(garment);
  const bodyShape = getGeometry({
    waist: body.waist,
    hip: body.hip,
    rise: garment.rise,
    thigh: body.thigh,
    knee: body.knee,
    hem: ANKLE,
    inseam: body.inseam,
  });

  const viewHeight = Math.max(pants.hemY, bodyShape.hemY) + 24;

  const verdictOf = (key) => VERDICTS[fit.areas.find((a) => a.key === key).verdict].color;
  const L = pants.left;
  const R = pants.right;
  const bands = [
    { key: 'waist', segments: [[L.waist, R.waist]] },
    { key: 'hip', segments: [[L.hip, R.hip]] },
    { key: 'thigh', segments: [[L.thighOuter, R.thighOuter]] },
    { key: 'knee', segments: [[L.kneeOuter, L.kneeInner], [R.kneeInner, R.kneeOuter]] },
  ];

  return (
    <div className="fit-canvas">
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${viewHeight}`} role="img" aria-label="Pants drawn over body outline">
        <PantsDrawing geometry={pants} className="tryon-pants" />
        <path d={getOutlinePath(bodyShape)} className="body-outline" />
        {bands.map(({ key, segments }) =>
          segments.map(([a, b], i) => (
            <g key={`${key}${i}`}>
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={verdictOf(key)} strokeWidth={3} strokeLinecap="round" />
              {i === segments.length - 1 && <circle cx={b[0]} cy={b[1]} r={5} fill={verdictOf(key)} stroke="white" strokeWidth={1.5} />}
            </g>
          ))
        )}
      </svg>
      <div className="tryon-legend">
        <span>
          <svg width="22" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="22" y2="4" className="body-outline" />
          </svg>
          Body
        </span>
        {Object.values(VERDICTS).map((v) => (
          <span key={v.label}>
            <i style={{ background: v.color }} />
            {v.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function BodyForm({ body, setBody }) {
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
          {BODY_FIELDS.map(({ key, label }) => (
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

function FitResults({ fit }) {
  const advice = fit.areas.filter((a) => a.advice);
  return (
    <div className="fit-panel">
      <h3>Fit result</h3>
      <div className="table-scroll">
        <table className="measure-table">
          <thead>
            <tr>
              <th scope="col">Area</th>
              <th scope="col">Ease</th>
              <th scope="col">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {fit.areas.map((a) => (
              <tr key={a.key}>
                <th scope="row">{MEASUREMENT_BY_KEY[a.key].label}</th>
                <td>
                  {signed(a.ease, 2).replace(/\.?0+$/, '')} in
                  <span className="muted"> / {signed(toCm(a.ease), 1)} cm</span>
                </td>
                <td>
                  <span className="verdict" style={{ '--verdict': VERDICTS[a.verdict].color }}>
                    {VERDICTS[a.verdict].label}
                  </span>
                </td>
              </tr>
            ))}
            <tr>
              <th scope="row">Length</th>
              <td>
                {signed(fit.length.diff, 2).replace(/\.?0+$/, '')} in
                <span className="muted"> / {signed(toCm(fit.length.diff), 1)} cm</span>
              </td>
              <td>{fit.length.label}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <ul className="fit-advice">
        {advice.map((a) => (
          <li key={a.key}>
            <strong>{MEASUREMENT_BY_KEY[a.key].label}:</strong> {a.advice}
          </li>
        ))}
        <li>
          <strong>Length:</strong> {fit.length.note}
        </li>
        {advice.length === 0 && <li>No fit problems at waist, hip, thigh or knee.</li>}
      </ul>
    </div>
  );
}
