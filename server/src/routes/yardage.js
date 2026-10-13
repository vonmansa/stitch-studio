import { Router } from 'express';
import { GARMENT_TYPES, calculateYardage } from '../data/yardageTable.js';

export const yardageRouter = Router();

// Lets the frontend build the measurement form dynamically instead of
// hardcoding which fields each garment type needs.
yardageRouter.get('/garment-types', (req, res) => {
  res.json(GARMENT_TYPES);
});

yardageRouter.post('/calculate', (req, res) => {
  const { garmentType, measurements } = req.body;

  if (!garmentType || !measurements) {
    return res.status(400).json({ error: 'garmentType and measurements are required' });
  }

  try {
    const result = calculateYardage(garmentType, measurements);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
