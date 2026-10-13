import express from 'express';
import cors from 'cors';
import { projectsRouter } from './routes/projects.js';
import { yardageRouter } from './routes/yardage.js';
import { uploadsDir } from './middleware/upload.js';

export const app = express();

app.use(cors());
app.use(express.json());

// Serves uploaded photos as static files, e.g. GET /uploads/167...-photo.jpg
app.use('/uploads', express.static(uploadsDir));

app.use('/api/projects', projectsRouter);
app.use('/api/yardage', yardageRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Centralized error handler — every asyncHandler-wrapped route and multer
// error ends up here instead of leaking a stack trace to the client.
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});
