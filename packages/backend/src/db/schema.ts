import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  pgEnum,
  integer,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ───────────────────────────────────────────────

export const workflowStatusEnum = pgEnum('workflow_status', [
  'created',
  'planning',
  'in_progress',
  'waiting_approval',
  'waiting_patient',
  'waiting_external',
  'completed',
  'failed',
  'escalated',
]);

export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'assigned',
  'in_progress',
  'waiting_approval',
  'completed',
  'failed',
  'skipped',
]);

export const approvalStatusEnum = pgEnum('approval_status', [
  'pending',
  'approved',
  'rejected',
]);

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'booked',
  'provisional',
  'confirmed',
  'rescheduled',
  'cancelled',
  'completed',
  'no_show',
]);

// ─── Patients ────────────────────────────────────────────

export const patients = pgTable('patients', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  dob: varchar('dob', { length: 10 }).notNull(), // YYYY-MM-DD
  phone: varchar('phone', { length: 20 }).notNull(),
  email: varchar('email', { length: 255 }),
  insuranceId: varchar('insurance_id', { length: 100 }),
  insuranceProvider: varchar('insurance_provider', { length: 255 }),
  documents: jsonb('documents').$type<PatientDocument[]>().default([]),
  demographics: jsonb('demographics').$type<PatientDemographics>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Doctors ─────────────────────────────────────────────

export const doctors = pgTable('doctors', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  department: varchar('department', { length: 100 }).notNull(),
  specialization: varchar('specialization', { length: 255 }),
  schedule: jsonb('schedule').$type<DoctorSchedule>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Appointments ────────────────────────────────────────

export const appointments = pgTable('appointments', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id),
  doctorId: uuid('doctor_id')
    .notNull()
    .references(() => doctors.id),
  department: varchar('department', { length: 100 }).notNull(),
  slotTime: timestamp('slot_time').notNull(),
  status: appointmentStatusEnum('status').default('booked').notNull(),
  appointmentType: varchar('appointment_type', { length: 100 }).default('general'),
  notes: text('notes'),
  requiredDocuments: jsonb('required_documents').$type<string[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Workflows ───────────────────────────────────────────

export const workflows = pgTable('workflows', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: varchar('type', { length: 100 }).notNull(), // e.g. 'pre_visit_intake'
  status: workflowStatusEnum('status').default('created').notNull(),
  patientId: uuid('patient_id').references(() => patients.id),
  appointmentId: uuid('appointment_id').references(() => appointments.id),
  context: jsonb('context').$type<Record<string, unknown>>().default({}),
  result: jsonb('result').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// ─── Workflow Tasks ──────────────────────────────────────

export const workflowTasks = pgTable('workflow_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  workflowId: uuid('workflow_id')
    .notNull()
    .references(() => workflows.id),
  agent: varchar('agent', { length: 100 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  status: taskStatusEnum('status').default('pending').notNull(),
  input: jsonb('input').$type<Record<string, unknown>>().default({}),
  output: jsonb('output').$type<Record<string, unknown>>(),
  dependsOn: jsonb('depends_on').$type<string[]>().default([]), // task IDs
  priority: integer('priority').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// ─── Audit Logs ──────────────────────────────────────────

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  workflowId: uuid('workflow_id').references(() => workflows.id),
  taskId: uuid('task_id').references(() => workflowTasks.id),
  agent: varchar('agent', { length: 100 }).notNull(),
  action: varchar('action', { length: 255 }).notNull(),
  details: jsonb('details').$type<Record<string, unknown>>().default({}),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// ─── Approval Requests ───────────────────────────────────

export const approvalRequests = pgTable('approval_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  workflowId: uuid('workflow_id')
    .notNull()
    .references(() => workflows.id),
  taskId: uuid('task_id').references(() => workflowTasks.id),
  action: varchar('action', { length: 255 }).notNull(),
  reason: text('reason').notNull(),
  details: jsonb('details').$type<Record<string, unknown>>().default({}),
  status: approvalStatusEnum('status').default('pending').notNull(),
  decidedBy: varchar('decided_by', { length: 255 }),
  decidedAt: timestamp('decided_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Relations ───────────────────────────────────────────

export const patientsRelations = relations(patients, ({ many }) => ({
  appointments: many(appointments),
  workflows: many(workflows),
}));

export const doctorsRelations = relations(doctors, ({ many }) => ({
  appointments: many(appointments),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  patient: one(patients, {
    fields: [appointments.patientId],
    references: [patients.id],
  }),
  doctor: one(doctors, {
    fields: [appointments.doctorId],
    references: [doctors.id],
  }),
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  patient: one(patients, {
    fields: [workflows.patientId],
    references: [patients.id],
  }),
  appointment: one(appointments, {
    fields: [workflows.appointmentId],
    references: [appointments.id],
  }),
  tasks: many(workflowTasks),
  auditLogs: many(auditLogs),
  approvalRequests: many(approvalRequests),
}));

export const workflowTasksRelations = relations(workflowTasks, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowTasks.workflowId],
    references: [workflows.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  workflow: one(workflows, {
    fields: [auditLogs.workflowId],
    references: [workflows.id],
  }),
}));

export const approvalRequestsRelations = relations(approvalRequests, ({ one }) => ({
  workflow: one(workflows, {
    fields: [approvalRequests.workflowId],
    references: [workflows.id],
  }),
}));

// ─── TypeScript Types ────────────────────────────────────

export interface PatientDocument {
  type: string;       // e.g. 'insurance_card', 'id_proof', 'referral_letter'
  name: string;
  uploadedAt?: string;
  verified: boolean;
}

export interface PatientDemographics {
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  bloodGroup?: string;
  allergies?: string[];
}

export interface DoctorSchedule {
  [day: string]: {    // e.g. 'monday', 'tuesday'
    slots: string[];  // e.g. ['09:00', '09:30', '10:00']
    available: boolean;
  };
}

// Inferred types for queries
export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
export type Doctor = typeof doctors.$inferSelect;
export type NewDoctor = typeof doctors.$inferInsert;
export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;
export type WorkflowTask = typeof workflowTasks.$inferSelect;
export type NewWorkflowTask = typeof workflowTasks.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type ApprovalRequest = typeof approvalRequests.$inferSelect;
