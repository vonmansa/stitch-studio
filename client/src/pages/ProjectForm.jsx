import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getProject, createProject, updateProject } from '../api/client.js';

const EMPTY_PROJECT = {
  name: '',
  pattern_name: '',
  fabric_type: '',
  notes: '',
  status: 'planning',
  photo: null,
};

export default function ProjectForm() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_PROJECT);
  const [existingPhoto, setExistingPhoto] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
    getProject(id).then((project) => {
      setForm({
        name: project.name,
        pattern_name: project.pattern_name || '',
        fabric_type: project.fabric_type || '',
        notes: project.notes || '',
        status: project.status,
        photo: null,
      });
      setExistingPhoto(project.photo_filename);
    });
  }, [id, isEditing]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handlePhotoChange(e) {
    setForm((prev) => ({ ...prev, photo: e.target.files[0] || null }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const saved = isEditing ? await updateProject(id, form) : await createProject(form);
      navigate(`/projects/${saved.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="form-page">
      <h1>{isEditing ? 'Edit Project' : 'New Project'}</h1>
      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit} className="project-form">
        <label>
          Project Name *
          <input name="name" value={form.name} onChange={handleChange} required />
        </label>

        <label>
          Pattern Name
          <input name="pattern_name" value={form.pattern_name} onChange={handleChange} />
        </label>

        <label>
          Fabric Type
          <input name="fabric_type" value={form.fabric_type} onChange={handleChange} />
        </label>

        <label>
          Status
          <select name="status" value={form.status} onChange={handleChange}>
            <option value="planning">Planning</option>
            <option value="in-progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </label>

        <label>
          Notes
          <textarea name="notes" value={form.notes} onChange={handleChange} rows={4} />
        </label>

        <label>
          Photo
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} />
        </label>

        {existingPhoto && !form.photo && (
          <p className="muted">Current photo: {existingPhoto} (choose a new file to replace it)</p>
        )}

        <div className="card-actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving...' : 'Save Project'}
          </button>
        </div>
      </form>
    </div>
  );
}
