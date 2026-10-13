import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getProject, deleteProject } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';
import PantsDrawing from '../fit/PantsDrawing.jsx';
import { useMeasurements, sanitizePattern } from '../fit/MeasurementsContext.jsx';
import { VIEW_WIDTH, VIEW_HEIGHT, getGeometry, toCm } from '../fit/pantsModel.js';
import { FABRICS } from '../fit/fitCheck.js';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);
  const { loadPattern } = useMeasurements();

  useEffect(() => {
    getProject(id)
      .then(setProject)
      .catch((err) => setError(err.message));
  }, [id]);

  async function handleDelete() {
    if (!window.confirm(`Delete "${project.name}"? This can't be undone.`)) return;
    await deleteProject(id);
    navigate('/');
  }

  function openInPatternLab() {
    loadPattern(project.pattern);
    navigate(`/pattern?project=${project.id}`);
  }

  if (error) return <p className="error">{error}</p>;
  if (!project) return <p>Loading...</p>;

  return (
    <div className="detail-page">
      <Link to="/">&larr; Back to projects</Link>
      <div className="page-header">
        <h1>{project.name}</h1>
        <StatusBadge status={project.status} />
      </div>

      {project.photo_filename && (
        <img
          src={`/uploads/${project.photo_filename}`}
          alt={project.name}
          className="detail-photo"
        />
      )}

      <dl className="detail-fields">
        <dt>Pattern</dt>
        <dd>{project.pattern_name || '—'}</dd>
        <dt>Fabric</dt>
        <dd>{project.fabric_type || '—'}</dd>
        <dt>Notes</dt>
        <dd className="notes">{project.notes || '—'}</dd>
      </dl>

      {project.pattern ? (
        <SavedPattern pattern={project.pattern} onOpen={openInPatternLab} />
      ) : (
        <p className="muted">
          No pattern yet — <Link to={`/pattern?project=${project.id}`}>draft one in Pattern Lab</Link>.
        </p>
      )}

      <div className="card-actions">
        <Link to={`/projects/${project.id}/edit`} className="button">
          Edit
        </Link>
        <button className="button button-danger" onClick={handleDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

function SavedPattern({ pattern, onOpen }) {
  const { garment, fabric, options } = sanitizePattern(pattern);
  const rows = [
    ['Waist', garment.waist],
    ['Hip', garment.hip],
    ['Thigh', garment.thigh],
    ['Leg opening', garment.hem],
    ['Inseam', garment.inseam],
  ];
  return (
    <section className="saved-pattern">
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img" aria-label="Saved pants fit">
        <PantsDrawing geometry={getGeometry(garment)} className="tryon-pants" />
      </svg>
      <div>
        <h2>Saved pattern</h2>
        <ul className="pattern-summary">
          {rows.map(([label, value]) => (
            <li key={label}>
              {label}: <strong>{value} in</strong> <span className="muted">/ {toCm(value).toFixed(1)} cm</span>
            </li>
          ))}
          <li>Fabric: {FABRICS[fabric].label}</li>
          <li>Seam allowance: {options.seamAllowance} in</li>
        </ul>
        <button type="button" className="button" onClick={onOpen}>
          Open in Pattern Lab
        </button>
        <p className="muted small">Replaces the measurements currently loaded in Fit Studio.</p>
      </div>
    </section>
  );
}
