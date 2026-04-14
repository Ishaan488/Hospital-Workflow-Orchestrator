import { db, pool } from './connection';
import { patients, doctors, appointments } from './schema';
import type { PatientDocument, PatientDemographics, DoctorSchedule } from './schema';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  console.log('🌱 Seeding database...\n');

  try {
    // --- Clear existing data (order matters for FK constraints) ---
    console.log('🗑️  Clearing existing data...');
    await db.delete(appointments);
    await db.delete(patients);
    await db.delete(doctors);

    // ─── Doctors ───────────────────────────────────────────
    console.log('👨‍⚕️ Seeding doctors...');

    const weekdaySchedule: DoctorSchedule = {
      monday: { slots: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'], available: true },
      tuesday: { slots: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'], available: true },
      wednesday: { slots: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'], available: true },
      thursday: { slots: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'], available: true },
      friday: { slots: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30'], available: true },
      saturday: { slots: [], available: false },
      sunday: { slots: [], available: false },
    };

    const afternoonSchedule: DoctorSchedule = {
      monday: { slots: ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'], available: true },
      tuesday: { slots: ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'], available: true },
      wednesday: { slots: ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'], available: true },
      thursday: { slots: [], available: false },
      friday: { slots: ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'], available: true },
      saturday: { slots: ['10:00', '10:30', '11:00', '11:30'], available: true },
      sunday: { slots: [], available: false },
    };

    const insertedDoctors = await db.insert(doctors).values([
      {
        name: 'Dr. Ananya Sharma',
        department: 'Cardiology',
        specialization: 'Interventional Cardiology',
        schedule: weekdaySchedule,
      },
      {
        name: 'Dr. Rajesh Patel',
        department: 'Orthopedics',
        specialization: 'Joint Replacement Surgery',
        schedule: weekdaySchedule,
      },
      {
        name: 'Dr. Priya Menon',
        department: 'Neurology',
        specialization: 'Epilepsy & Movement Disorders',
        schedule: afternoonSchedule,
      },
      {
        name: 'Dr. Arjun Kapoor',
        department: 'General Medicine',
        specialization: 'Internal Medicine',
        schedule: weekdaySchedule,
      },
      {
        name: 'Dr. Meera Iyer',
        department: 'Dermatology',
        specialization: 'Clinical Dermatology',
        schedule: afternoonSchedule,
      },
      {
        name: 'Dr. Vikram Singh',
        department: 'Cardiology',
        specialization: 'Electrophysiology',
        schedule: weekdaySchedule,
      },
    ]).returning();

    console.log(`   ✅ ${insertedDoctors.length} doctors created`);

    // ─── Patients ──────────────────────────────────────────
    console.log('🧑 Seeding patients...');

    const insertedPatients = await db.insert(patients).values([
      // Patient 1: Complete — all docs, valid insurance
      {
        name: 'Amit Kumar',
        dob: '1985-03-15',
        phone: '+91-9876543210',
        email: 'amit.kumar@email.com',
        insuranceId: 'INS-2024-001',
        insuranceProvider: 'Star Health Insurance',
        documents: [
          { type: 'insurance_card', name: 'Star Health Card', uploadedAt: '2024-12-01', verified: true },
          { type: 'id_proof', name: 'Aadhaar Card', uploadedAt: '2024-12-01', verified: true },
          { type: 'referral_letter', name: 'GP Referral - Cardiology', uploadedAt: '2025-01-05', verified: true },
        ] as PatientDocument[],
        demographics: {
          address: '42, MG Road, Koramangala',
          city: 'Bangalore',
          state: 'Karnataka',
          zipCode: '560034',
          emergencyContact: 'Sunita Kumar',
          emergencyPhone: '+91-9876543211',
          bloodGroup: 'B+',
          allergies: ['Penicillin'],
        } as PatientDemographics,
      },
      // Patient 2: Missing insurance card
      {
        name: 'Priya Reddy',
        dob: '1992-07-22',
        phone: '+91-9123456789',
        email: 'priya.reddy@email.com',
        insuranceId: 'INS-2024-002',
        insuranceProvider: 'HDFC ERGO Health',
        documents: [
          { type: 'id_proof', name: 'PAN Card', uploadedAt: '2025-01-10', verified: true },
          // Missing: insurance_card
          // Missing: referral_letter
        ] as PatientDocument[],
        demographics: {
          address: '15, Jubilee Hills',
          city: 'Hyderabad',
          state: 'Telangana',
          zipCode: '500033',
          emergencyContact: 'Ravi Reddy',
          emergencyPhone: '+91-9123456790',
          bloodGroup: 'O+',
          allergies: [],
        } as PatientDemographics,
      },
      // Patient 3: No insurance, self-pay
      {
        name: 'Rahul Verma',
        dob: '1978-11-08',
        phone: '+91-9988776655',
        email: 'rahul.verma@email.com',
        insuranceId: null,
        insuranceProvider: null,
        documents: [
          { type: 'id_proof', name: 'Aadhaar Card', uploadedAt: '2025-01-09', verified: true },
        ] as PatientDocument[],
        demographics: {
          address: '88, Civil Lines',
          city: 'Delhi',
          state: 'Delhi',
          zipCode: '110001',
          emergencyContact: 'Neha Verma',
          emergencyPhone: '+91-9988776656',
          bloodGroup: 'A+',
          allergies: ['Sulfa drugs', 'Ibuprofen'],
        } as PatientDemographics,
      },
      // Patient 4: Complete docs but insurance eligibility will fail (simulated)
      {
        name: 'Sneha Gupta',
        dob: '1999-04-30',
        phone: '+91-8877665544',
        email: 'sneha.gupta@email.com',
        insuranceId: 'INS-2024-EXPIRED',
        insuranceProvider: 'Bajaj Allianz Health',
        documents: [
          { type: 'insurance_card', name: 'Bajaj Allianz Card', uploadedAt: '2024-06-15', verified: true },
          { type: 'id_proof', name: 'Voter ID', uploadedAt: '2024-06-15', verified: true },
          { type: 'referral_letter', name: 'GP Referral - Neurology', uploadedAt: '2025-01-12', verified: true },
        ] as PatientDocument[],
        demographics: {
          address: '22, Salt Lake',
          city: 'Kolkata',
          state: 'West Bengal',
          zipCode: '700091',
          emergencyContact: 'Anil Gupta',
          emergencyPhone: '+91-8877665545',
          bloodGroup: 'AB+',
          allergies: [],
        } as PatientDemographics,
      },
      // Patient 5: Incomplete demographics
      {
        name: 'Mohammed Khan',
        dob: '1965-09-12',
        phone: '+91-7766554433',
        email: null,
        insuranceId: 'INS-2024-005',
        insuranceProvider: 'New India Assurance',
        documents: [
          { type: 'insurance_card', name: 'New India Card', uploadedAt: '2025-01-08', verified: true },
          { type: 'id_proof', name: 'Passport', uploadedAt: '2025-01-08', verified: true },
        ] as PatientDocument[],
        demographics: {
          address: '7, Bandra West',
          city: 'Mumbai',
          state: 'Maharashtra',
          zipCode: '400050',
          // Missing: emergencyContact, emergencyPhone
          bloodGroup: 'O-',
          allergies: ['Aspirin'],
        } as PatientDemographics,
      },
      // Patient 6: New patient — no documents at all
      {
        name: 'Lakshmi Nair',
        dob: '2001-12-25',
        phone: '+91-6655443322',
        email: 'lakshmi.nair@email.com',
        insuranceId: 'INS-2024-006',
        insuranceProvider: 'ICICI Lombard',
        documents: [] as PatientDocument[],
        demographics: {} as PatientDemographics,
      },
      // Patient 7: Complete for general medicine visit (no referral needed)
      {
        name: 'Deepak Joshi',
        dob: '1988-06-18',
        phone: '+91-5544332211',
        email: 'deepak.joshi@email.com',
        insuranceId: 'INS-2024-007',
        insuranceProvider: 'Star Health Insurance',
        documents: [
          { type: 'insurance_card', name: 'Star Health Card', uploadedAt: '2025-01-14', verified: true },
          { type: 'id_proof', name: 'Driving License', uploadedAt: '2025-01-14', verified: true },
        ] as PatientDocument[],
        demographics: {
          address: '33, Aundh',
          city: 'Pune',
          state: 'Maharashtra',
          zipCode: '411007',
          emergencyContact: 'Kavita Joshi',
          emergencyPhone: '+91-5544332212',
          bloodGroup: 'B-',
          allergies: [],
        } as PatientDemographics,
      },
    ]).returning();

    console.log(`   ✅ ${insertedPatients.length} patients created`);

    // ─── Appointments ──────────────────────────────────────
    console.log('📅 Seeding appointments...');

    // Create appointments for various scenarios
    const now = new Date();
    const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const inFiveDays = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const inOneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const inTenDays = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

    const insertedAppointments = await db.insert(appointments).values([
      // Appointment 1: Happy path — Amit (complete patient) → Cardiology
      {
        patientId: insertedPatients[0].id,  // Amit Kumar
        doctorId: insertedDoctors[0].id,    // Dr. Ananya Sharma (Cardiology)
        department: 'Cardiology',
        slotTime: inFiveDays,
        status: 'booked',
        appointmentType: 'specialist_consultation',
        notes: 'Follow-up for chest pain evaluation',
        requiredDocuments: ['insurance_card', 'id_proof', 'referral_letter'],
      },
      // Appointment 2: Missing docs — Priya (missing insurance card) → Orthopedics
      {
        patientId: insertedPatients[1].id,  // Priya Reddy
        doctorId: insertedDoctors[1].id,    // Dr. Rajesh Patel (Orthopedics)
        department: 'Orthopedics',
        slotTime: inTwoDays,
        status: 'booked',
        appointmentType: 'specialist_consultation',
        notes: 'Knee pain evaluation — needs pre-auth for MRI',
        requiredDocuments: ['insurance_card', 'id_proof', 'referral_letter'],
      },
      // Appointment 3: Self-pay — Rahul (no insurance) → General Medicine
      {
        patientId: insertedPatients[2].id,  // Rahul Verma
        doctorId: insertedDoctors[3].id,    // Dr. Arjun Kapoor (General Medicine)
        department: 'General Medicine',
        slotTime: inOneWeek,
        status: 'booked',
        appointmentType: 'general',
        notes: 'Annual health checkup',
        requiredDocuments: ['id_proof'],
      },
      // Appointment 4: Expired insurance — Sneha → Neurology
      {
        patientId: insertedPatients[3].id,  // Sneha Gupta
        doctorId: insertedDoctors[2].id,    // Dr. Priya Menon (Neurology)
        department: 'Neurology',
        slotTime: inFiveDays,
        status: 'booked',
        appointmentType: 'specialist_consultation',
        notes: 'Recurring headache evaluation — needs pre-auth',
        requiredDocuments: ['insurance_card', 'id_proof', 'referral_letter'],
      },
      // Appointment 5: Missing referral — Mohammed → Cardiology
      {
        patientId: insertedPatients[4].id,  // Mohammed Khan
        doctorId: insertedDoctors[5].id,    // Dr. Vikram Singh (Cardiology)
        department: 'Cardiology',
        slotTime: inTenDays,
        status: 'booked',
        appointmentType: 'specialist_consultation',
        notes: 'Arrhythmia follow-up',
        requiredDocuments: ['insurance_card', 'id_proof', 'referral_letter'],
      },
      // Appointment 6: New patient, no docs — Lakshmi → Dermatology
      {
        patientId: insertedPatients[5].id,  // Lakshmi Nair
        doctorId: insertedDoctors[4].id,    // Dr. Meera Iyer (Dermatology)
        department: 'Dermatology',
        slotTime: inTwoDays,
        status: 'booked',
        appointmentType: 'general',
        notes: 'Skin allergy consultation',
        requiredDocuments: ['insurance_card', 'id_proof'],
      },
      // Appointment 7: Simple visit — Deepak (complete for general) → General Medicine
      {
        patientId: insertedPatients[6].id,  // Deepak Joshi
        doctorId: insertedDoctors[3].id,    // Dr. Arjun Kapoor (General Medicine)
        department: 'General Medicine',
        slotTime: inOneWeek,
        status: 'booked',
        appointmentType: 'general',
        notes: 'Fever and cold symptoms',
        requiredDocuments: ['id_proof'],
      },
    ]).returning();

    console.log(`   ✅ ${insertedAppointments.length} appointments created`);

    // ─── Summary ───────────────────────────────────────────
    console.log('\n📊 Seed Summary:');
    console.log(`   Doctors:      ${insertedDoctors.length}`);
    console.log(`   Patients:     ${insertedPatients.length}`);
    console.log(`   Appointments: ${insertedAppointments.length}`);
    console.log('\n✅ Seeding completed successfully!\n');

    console.log('📋 Demo Scenarios:');
    console.log('   1. Amit Kumar      → Cardiology   → Happy path (all docs complete)');
    console.log('   2. Priya Reddy     → Orthopedics  → Missing insurance card + referral');
    console.log('   3. Rahul Verma     → Gen Medicine  → Self-pay (no insurance)');
    console.log('   4. Sneha Gupta     → Neurology    → Expired insurance');
    console.log('   5. Mohammed Khan   → Cardiology   → Missing referral + incomplete demographics');
    console.log('   6. Lakshmi Nair    → Dermatology  → New patient (zero documents)');
    console.log('   7. Deepak Joshi    → Gen Medicine  → Simple visit (complete)');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
