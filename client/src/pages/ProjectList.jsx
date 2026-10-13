import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProjects, deleteProject } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';

export default function ProjectList() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      setLoading(true);
      setProjects(await getProjects());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p>Loading projects...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Your Projects</h1>
        <Link to="/projects/new" className="button">
          + New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <p>No projects yet. Add your first one!</p>
      ) : (
        <div className="project-grid">
          {projects.map((project) => (
            <div key={project.id} className="project-card">
              <Link to={`/projects/${project.id}`}>
                {project.photo_filename ? (
                  <img
                    src={`/uploads/${project.photo_filename}`}
                    alt={project.name}
                    className="project-thumb"
                  />
                ) : (
                  <div className="project-thumb project-thumb-placeholder">No Photo</div>
                )}
                <h3>{project.name}</h3>
              </Link>
              <StatusBadge status={project.status} />
              {project.pattern_name && <p className="muted">Pattern: {project.pattern_name}</p>}
              <div className="card-actions">
                <Link to={`/projects/${project.id}/edit`}>Edit</Link>
                <button className="link-button" onClick={() => handleDelete(project.id, project.name)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
