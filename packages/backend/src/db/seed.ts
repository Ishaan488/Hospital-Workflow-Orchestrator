import { db, pool } from './connection';
import { users, hospitals, ambulances, trustedContacts, incidents, workflows, workflowTasks, auditLogs } from './schema';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

async function seed() {
  console.log('🌱 Seeding database for Emergency Orchestrator...\n');

  try {
    // --- Clear existing data (order matters for FK constraints) ---
    console.log('🗑️  Clearing existing data...');
    // Delete leaf nodes first
    await db.delete(auditLogs);
    await db.delete(workflowTasks);
    await db.delete(workflows);
    await db.delete(ambulances);
    await db.delete(trustedContacts);
    await db.delete(incidents);
    await db.delete(users);
    await db.delete(hospitals);

    // ─── Hospitals ───────────────────────────────────────────
    console.log('🏥 Seeding hospitals...');

    const insertedHospitals = await db.insert(hospitals).values([
      {
        name: 'City General Trauma Center',
        location: { lat: 40.7128, lon: -74.0060 },
        capabilities: ['Level 1 Trauma', 'Cardiology', 'Neurology'],
        capacityMetrics: { traumaLevel: 1, emergencyBedsAvailable: 5, load: 'medium' }
      },
      {
        name: 'Saint Marys Hospital',
        location: { lat: 40.7300, lon: -73.9900 },
        capabilities: ['Level 2 Trauma', 'Pediatrics'],
        capacityMetrics: { traumaLevel: 2, emergencyBedsAvailable: 12, load: 'low' }
      },
      {
        name: 'Metro North Medical',
        location: { lat: 40.7500, lon: -73.9800 },
        capabilities: ['Level 1 Trauma', 'Burn Unit'],
        capacityMetrics: { traumaLevel: 1, emergencyBedsAvailable: 1, load: 'high' }
      }
    ]).returning();

    console.log(`   ✅ ${insertedHospitals.length} hospitals created`);

    // ─── Users ──────────────────────────────────────────
    console.log('🧑 Seeding users (victims)...');

    const insertedUsers = await db.insert(users).values([
      {
        name: 'Amit Kumar',
        dob: '1985-03-15',
        phone: '+91-9876543210',
        bloodGroup: 'B+',
        allergies: ['Penicillin'],
      },
      {
        name: 'Priya Reddy',
        dob: '1992-07-22',
        phone: '+91-9123456789',
        bloodGroup: 'O+',
        allergies: [],
      },
      {
        name: 'Rahul Verma',
        dob: '1978-11-08',
        phone: '+91-9988776655',
        bloodGroup: 'A+',
        allergies: ['Sulfa drugs', 'Ibuprofen'],
      }
    ]).returning();

    console.log(`   ✅ ${insertedUsers.length} users created`);

    // ─── Trusted Contacts ──────────────────────────────────────
    console.log('📱 Seeding trusted contacts...');

    const insertedContacts = await db.insert(trustedContacts).values([
      {
        userId: insertedUsers[0].id,
        name: 'Sunita Kumar',
        phone: '+91-9876543211',
        relation: 'Wife',
        isRelayCapable: true,
      },
      {
        userId: insertedUsers[1].id,
        name: 'Ravi Reddy',
        phone: '+91-9123456790',
        relation: 'Husband',
        isRelayCapable: true,
      },
      {
        userId: insertedUsers[2].id,
        name: 'Neha Verma',
        phone: '+91-9988776656',
        relation: 'Sister',
        isRelayCapable: false,
      }
    ]).returning();

    console.log(`   ✅ ${insertedContacts.length} trusted contacts created`);

    // ─── Ambulances ────────────────────────────────────────────
    console.log('🚑 Seeding ambulances...');

    const insertedAmbulances = await db.insert(ambulances).values([
      {
        vehicleId: 'AMB-101',
        status: 'available',
        currentLocation: { lat: 40.7150, lon: -74.0040 },
      },
      {
        vehicleId: 'AMB-102',
        status: 'available',
        currentLocation: { lat: 40.7320, lon: -73.9880 },
      },
      {
        vehicleId: 'AMB-103',
        status: 'dispatched',
        currentLocation: { lat: 40.7450, lon: -73.9850 },
      }
    ]).returning();

    console.log(`   ✅ ${insertedAmbulances.length} ambulances created`);

    // ─── Summary ───────────────────────────────────────────
    console.log('\n📊 Seed Summary:');
    console.log(`   Hospitals:        ${insertedHospitals.length}`);
    console.log(`   Users:            ${insertedUsers.length}`);
    console.log(`   Trusted Contacts: ${insertedContacts.length}`);
    console.log(`   Ambulances:       ${insertedAmbulances.length}`);
    console.log('\n✅ Seeding completed successfully!\n');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
