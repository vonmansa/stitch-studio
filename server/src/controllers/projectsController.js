import path from 'path';
import fs from 'fs';
import { pool } from '../db.js';
import { uploadsDir } from '../middleware/upload.js';

const VALID_STATUSES = ['planning', 'in-progress', 'done'];

function deletePhotoFile(filename) {
  if (!filename) return;
  const filePath = path.join(uploadsDir, filename);
  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error(`Failed to delete photo ${filename}:`, err.message);
    }
  });
}

export async function listProjects(req, res) {
  const result = await pool.query(
    'SELECT * FROM projects ORDER BY updated_at DESC'
  );
  res.json(result.rows);
}

export async function getProject(req, res) {
  const { id } = req.params;
  const result = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }
  res.json(result.rows[0]);
}

export async function createProject(req, res) {
  const { name, pattern_name, fabric_type, notes, status } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required' });
  }
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const photoFilename = req.file ? req.file.filename : null;

  const result = await pool.query(
    `INSERT INTO projects (name, pattern_name, fabric_type, notes, status, photo_filename)
     VALUES ($1, $2, $3, $4, COALESCE($5, 'planning')::project_status, $6)
     RETURNING *`,
    [name.trim(), pattern_name || null, fabric_type || null, notes || null, status || null, photoFilename]
  );

  res.status(201).json(result.rows[0]);
}

export async function updateProject(req, res) {
  const { id } = req.params;
  const { name, pattern_name, fabric_type, notes, status } = req.body;

  const existing = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required' });
  }
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  // A new photo replaces the old one on disk; otherwise keep what's there.
  let photoFilename = existing.rows[0].photo_filename;
  if (req.file) {
    deletePhotoFile(photoFilename);
    photoFilename = req.file.filename;
  }

  const result = await pool.query(
    `UPDATE projects
     SET name = $1, pattern_name = $2, fabric_type = $3, notes = $4, status = $5::project_status, photo_filename = $6
     WHERE id = $7
     RETURNING *`,
    [name.trim(), pattern_name || null, fabric_type || null, notes || null, status || existing.rows[0].status, photoFilename, id]
  );

  res.json(result.rows[0]);
}

export async function deleteProject(req, res) {
  const { id } = req.params;

  const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING *', [id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  deletePhotoFile(result.rows[0].photo_filename);
  res.status(204).send();
}

// Plausible bounds only — the client enforces the real per-measurement
// ranges. This just keeps garbage and absurd values out of the database.
const PATTERN_NUMBER_FIELDS = {
  garment: ['waist', 'hip', 'rise', 'thigh', 'knee', 'hem', 'inseam'],
  body: ['waist', 'hip', 'thigh', 'knee', 'inseam'],
};
const VALID_FABRICS = ['woven', 'stretch'];
const VALID_SEAM_ALLOWANCES = [0.375, 0.5, 0.625, 1];

function validatePattern(input) {
  if (!input || typeof input !== 'object') return { error: 'Pattern must be an object' };

  const clean = {};
  for (const [group, keys] of Object.entries(PATTERN_NUMBER_FIELDS)) {
    clean[group] = {};
    for (const key of keys) {
      const value = input[group]?.[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 100) {
        return { error: `${group}.${key} must be a number between 0 and 100 (inches)` };
      }
      clean[group][key] = value;
    }
  }

  if (!VALID_FABRICS.includes(input.fabric)) {
    return { error: `fabric must be one of: ${VALID_FABRICS.join(', ')}` };
  }
  if (!VALID_SEAM_ALLOWANCES.includes(input.seamAllowance)) {
    return { error: `seamAllowance must be one of: ${VALID_SEAM_ALLOWANCES.join(', ')}` };
  }
  clean.fabric = input.fabric;
  clean.seamAllowance = input.seamAllowance;
  clean.includeDetails = input.includeDetails !== false;
  clean.includePockets = input.includePockets !== false;
  return { pattern: clean };
}

export async function savePattern(req, res) {
  const { id } = req.params;
  const { pattern, error } = validatePattern(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const result = await pool.query(
    'UPDATE projects SET pattern = $1 WHERE id = $2 RETURNING *',
    [pattern, id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }
  res.json(result.rows[0]);
}
