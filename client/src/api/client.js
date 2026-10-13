const BASE_URL = '/api';

// Every API call funnels through this, so error handling (turning a
// non-2xx response into a thrown Error with the server's message) only
// has to be written once.
async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, options);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export function getProjects() {
  return request('/projects');
}

export function getProject(id) {
  return request(`/projects/${id}`);
}

// Projects are sent as multipart/form-data (not JSON) because they can
// include a photo file.
function toFormData(project) {
  const formData = new FormData();
  formData.append('name', project.name);
  formData.append('pattern_name', project.pattern_name || '');
  formData.append('fabric_type', project.fabric_type || '');
  formData.append('notes', project.notes || '');
  formData.append('status', project.status || 'planning');
  if (project.photo) {
    formData.append('photo', project.photo);
  }
  return formData;
}

export function createProject(project) {
  return request('/projects', { method: 'POST', body: toFormData(project) });
}

export function updateProject(id, project) {
  return request(`/projects/${id}`, { method: 'PUT', body: toFormData(project) });
}

export function deleteProject(id) {
  return request(`/projects/${id}`, { method: 'DELETE' });
}

export function getGarmentTypes() {
  return request('/yardage/garment-types');
}

export function calculateYardage(garmentType, measurements) {
  return request('/yardage/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ garmentType, measurements }),
  });
}

export function savePattern(projectId, pattern) {
  return request(`/projects/${projectId}/pattern`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pattern),
  });
}
