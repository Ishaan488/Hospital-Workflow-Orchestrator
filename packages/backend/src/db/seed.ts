import { db, pool } from './connection';
import { patients, doctors, appointments } from './schema';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  console.log('🌱 Seeding database...');

  // --- Seed will be populated in Segment 1.3 ---
  // Placeholder to verify DB connection works

  try {
    const result = await db.select().from(patients).limit(1);
    console.log('✅ Database connection verified');
    console.log(`   Patients table accessible (${result.length} rows found)`);
    console.log('🌱 Seed data will be added in Segment 1.3');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
