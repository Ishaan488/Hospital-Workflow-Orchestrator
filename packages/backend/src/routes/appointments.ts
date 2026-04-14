import { Router } from 'express';
import { db } from '../db';
import { appointments, patients, doctors } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// GET /api/appointments — list all appointments (with patient & doctor names)
router.get('/', async (_req, res) => {
  try {
    const allAppointments = await db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        patientName: patients.name,
        doctorId: appointments.doctorId,
        doctorName: doctors.name,
        department: appointments.department,
        slotTime: appointments.slotTime,
        status: appointments.status,
        appointmentType: appointments.appointmentType,
        notes: appointments.notes,
        requiredDocuments: appointments.requiredDocuments,
        createdAt: appointments.createdAt,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(doctors, eq(appointments.doctorId, doctors.id));

    res.json({
      count: allAppointments.length,
      data: allAppointments,
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// GET /api/appointments/:id — get a single appointment with full details
router.get('/:id', async (req, res) => {
  try {
    const result = await db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        patientName: patients.name,
        patientPhone: patients.phone,
        patientEmail: patients.email,
        patientDocuments: patients.documents,
        patientInsuranceId: patients.insuranceId,
        patientInsuranceProvider: patients.insuranceProvider,
        doctorId: appointments.doctorId,
        doctorName: doctors.name,
        department: appointments.department,
        slotTime: appointments.slotTime,
        status: appointments.status,
        appointmentType: appointments.appointmentType,
        notes: appointments.notes,
        requiredDocuments: appointments.requiredDocuments,
        createdAt: appointments.createdAt,
        updatedAt: appointments.updatedAt,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(doctors, eq(appointments.doctorId, doctors.id))
      .where(eq(appointments.id, req.params.id));

    if (result.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json({ data: result[0] });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

export default router;
