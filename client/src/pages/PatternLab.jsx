import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMeasurements, SEAM_ALLOWANCES } from '../fit/MeasurementsContext.jsx';
import { toCm } from '../fit/pantsModel.js';
import { BODY_FIELDS_BY_CATEGORY, FABRICS, VERDICTS, checkFit } from '../fit/fitCheck.js';
import { buildSheet, PatternSheet } from '../fit/PatternSheet.jsx';
import PrintTiles, { PAPERS, tileLayout } from '../fit/PrintTiles.jsx';
import GarmentTabs from '../components/GarmentTabs.jsx';
import BodyForm from '../components/BodyForm.jsx';
import { getProjects, savePattern } from '../api/client.js';

const formatIn = (v) => `${Number(v.toFixed(2))}`;
const formatCm = (v) => toCm(v).toFixed(1);
const signed = (v, digits) => {
  const abs = Math.abs(v).toFixed(digits);
  return Number(abs) === 0 ? abs : `${v > 0 ? '+' : '−'}${abs}`;
};

export default function PatternLab() {
  const { garmentType, garmentModel: model, garment, body, setBody, fabric, setFabric, options, setOptions } =
    useMeasurements();
  const [gridUnit, setGridUnit] = useState('in');
  const [paperKey, setPaperKey] = useState('letter');
  const [printing, setPrinting] = useState(false);
  const svgRef = useRef(null);

  const sheet = buildSheet(garmentType, garment, options);
  const tiles = tileLayout(sheet, paperKey);
  const fit = checkFit(garmentType, model.category, garment, body, fabric);
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
    a.download = `${garmentType}-pattern.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="pattern-lab">
      <div className="page-header">
        <div>
          <h1>Pattern Lab</h1>
          <p className="muted">
            Pattern pieces drafted from your <Link to="/fit">Fit Studio</Link> measurements —
            change the fit there and the pattern updates here.
          </p>
        </div>
        <Link to="/studio" className="button">
          Open in 3D
        </Link>
      </div>

      <GarmentTabs />

      <SaveToProject pattern={{ type: garmentType, garment, body, fabric, ...options }} />

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
            {model.pieceOptions.details}
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={options.includePockets}
              onChange={(e) => setOption('includePockets', e.target.checked)}
            />
            {model.pieceOptions.pockets}
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

        <PatternCheck checks={sheet.checks} />
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
          <TryOnView model={model} garment={garment} body={body} fit={fit} />
          <div className="tryon-side">
            <BodyForm fields={BODY_FIELDS_BY_CATEGORY[model.category]} body={body} setBody={setBody} />
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

// Confirms the drafted pieces add back up to the Fit Studio targets
// (and, for tops, that the sleeve cap has the intended ease).
function PatternCheck({ checks }) {
  return (
    <div className="table-scroll">
      <table className="measure-table pattern-check">
        <caption>Pattern check — drafted pieces vs. Fit Studio targets</caption>
        <thead>
          <tr>
            <th scope="col">Measurement</th>
            <th scope="col">Target</th>
            <th scope="col">Pattern</th>
            <th scope="col">Match</th>
          </tr>
        </thead>
        <tbody>
          {checks.map(({ label, target, total }) => {
            const ok = Math.abs(total - target) < 0.1;
            return (
              <tr key={label}>
                <th scope="row">{label}</th>
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

function TryOnView({ model, garment, body, fit }) {
  const g = model.getGeometry(garment);
  const bodyGeometry = model.bodyGeometry(model.bodyShape(body, garment));
  const viewHeight = Math.min(model.view.height, Math.max(g.hemY, bodyGeometry.hemY) + 24);
  const Drawing = model.Drawing;
  const colorOf = (key) => VERDICTS[fit.areas.find((a) => a.key === key)?.verdict]?.color;
  const bands = model.fitBands(g).filter((b) => colorOf(b.key));

  return (
    <div className="fit-canvas">
      <svg
        viewBox={`0 0 ${model.view.width} ${viewHeight}`}
        role="img"
        aria-label={`${model.label} drawn over body outline`}
      >
        <Drawing geometry={g} className="tryon-pants" showPockets={false} />
        <path d={model.outlinePath(bodyGeometry)} className="body-outline" />
        {bands.map(({ key, segments }) =>
          segments.map(([a, b], i) => (
            <g key={`${key}${i}`}>
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={colorOf(key)} strokeWidth={3} strokeLinecap="round" />
              {i === segments.length - 1 && (
                <circle cx={b[0]} cy={b[1]} r={5} fill={colorOf(key)} stroke="white" strokeWidth={1.5} />
              )}
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
                <th scope="row">{a.label}</th>
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
              <th scope="row">{fit.length.rowLabel}</th>
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
            <strong>{a.label}:</strong> {a.advice}
          </li>
        ))}
        <li>
          <strong>{fit.length.rowLabel}:</strong> {fit.length.note}
        </li>
        {advice.length === 0 && <li>No fit problems at waist, hip, thigh or knee.</li>}
      </ul>
    </div>
  );
}
