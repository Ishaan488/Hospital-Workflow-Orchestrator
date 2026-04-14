import { Router } from 'express';
import { db } from '../db';
import { patients } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// GET /api/patients — list all patients
router.get('/', async (_req, res) => {
  try {
    const allPatients = await db.select().from(patients);
    res.json({
      count: allPatients.length,
      data: allPatients,
    });
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// GET /api/patients/:id — get a single patient
router.get('/:id', async (req, res) => {
  try {
    const result = await db
      .select()
      .from(patients)
      .where(eq(patients.id, req.params.id));

    if (result.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({ data: result[0] });
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

export default router;
