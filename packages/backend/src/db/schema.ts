import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  pgEnum,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ───────────────────────────────────────────────

export const workflowStatusEnum = pgEnum('workflow_status', [
  'created',
  'planning',
  'in_progress',
  'waiting_external',
  'completed',
  'failed',
  'escalated',
]);

export const incidentStatusEnum = pgEnum('incident_status', [
  'active',
  'resolved',
  'false_alarm'
]);

export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'assigned',
  'in_progress',
  'completed',
  'failed',
  'skipped',
]);

// ─── Users (Victims) ─────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  dob: varchar('dob', { length: 10 }).notNull(), // YYYY-MM-DD
  phone: varchar('phone', { length: 20 }).notNull(),
  bloodGroup: varchar('blood_group', { length: 5 }),
  allergies: jsonb('allergies').$type<string[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Emergency Orchestration ─────────────────────────────

export const incidents = pgTable('incidents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id), // victim
  triggerType: varchar('trigger_type', { length: 50 }).notNull(),
  status: incidentStatusEnum('status').default('active').notNull(),
  location: jsonb('location').$type<{ lat: number; lon: number; accuracy_m: number; source: string }>().notNull(),
  connectivity: jsonb('connectivity').$type<{ internet: boolean; sms: boolean; battery: number }>().notNull(),
  voiceText: text('voice_text'),
  imagePresent: boolean('image_present').default(false),
  triageProfile: jsonb('triage_profile').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const hospitals = pgTable('hospitals', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  location: jsonb('location').$type<{ lat: number; lon: number }>().notNull(),
  capabilities: jsonb('capabilities').$type<string[]>().default([]),
  capacityMetrics: jsonb('capacity_metrics').$type<{ traumaLevel: number; emergencyBedsAvailable: number; load: string }>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ambulances = pgTable('ambulances', {
  id: uuid('id').defaultRandom().primaryKey(),
  vehicleId: varchar('vehicle_id', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).default('available').notNull(),
  currentLocation: jsonb('current_location').$type<{ lat: number; lon: number }>(),
  incidentId: uuid('incident_id').references(() => incidents.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const trustedContacts = pgTable('trusted_contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  relation: varchar('relation', { length: 100 }),
  isRelayCapable: boolean('is_relay_capable').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Workflows ───────────────────────────────────────────

export const workflows = pgTable('workflows', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: varchar('type', { length: 100 }).notNull(), // e.g. 'emergency_orchestration'
  status: workflowStatusEnum('status').default('created').notNull(),
  incidentId: uuid('incident_id').references(() => incidents.id),
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

// ─── Relations ───────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  incidents: many(incidents),
  trustedContacts: many(trustedContacts),
}));

export const incidentsRelations = relations(incidents, ({ one, many }) => ({
  user: one(users, { fields: [incidents.userId], references: [users.id] }),
  workflows: many(workflows),
  ambulances: many(ambulances)
}));

export const trustedContactsRelations = relations(trustedContacts, ({ one }) => ({
  user: one(users, { fields: [trustedContacts.userId], references: [users.id] })
}));

export const hospitalsRelations = relations(hospitals, () => ({}));
export const ambulancesRelations = relations(ambulances, ({ one }) => ({
  incident: one(incidents, { fields: [ambulances.incidentId], references: [incidents.id] })
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  incident: one(incidents, {
    fields: [workflows.incidentId],
    references: [incidents.id],
  }),
  tasks: many(workflowTasks),
  auditLogs: many(auditLogs),
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

// ─── TypeScript Types ────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;
export type WorkflowTask = typeof workflowTasks.$inferSelect;
export type NewWorkflowTask = typeof workflowTasks.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
export type Hospital = typeof hospitals.$inferSelect;
export type NewHospital = typeof hospitals.$inferInsert;
export type Ambulance = typeof ambulances.$inferSelect;
export type TrustedContact = typeof trustedContacts.$inferSelect;
