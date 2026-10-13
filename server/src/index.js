import dotenv from 'dotenv';
import { app } from './app.js';
import { pool } from './db.js';

dotenv.config();

const PORT = process.env.PORT || 4000;

// Fail fast with a clear message if Postgres isn't reachable, rather than
// letting the first API request hang or throw a cryptic connection error.
pool
  .query('SELECT 1')
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Stitch Studio server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Could not connect to PostgreSQL:', err.message);
    console.error('Check that Postgres is running and server/.env has the right credentials.');
    process.exit(1);
  });
