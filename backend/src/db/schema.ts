import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Migration Stages
export const migrationStages = sqliteTable('migration_stages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chain: text('chain').notNull(), // 'asset-hub' or 'relay-chain'
  stage: text('stage').notNull(),
  details: text('details'), // JSON stringified details about the stage
  scheduledBlockNumber: integer('scheduled_block_number'), // Only used for scheduled stages.
  timestamp: integer('timestamp', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

export type MigrationStage = typeof migrationStages.$inferSelect;
export type NewMigrationStage = typeof migrationStages.$inferInsert;

// Stage Start Times - tracks when each stage first started
export const stageStartTimes = sqliteTable('stage_start_times', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  stage: text('stage').notNull().unique(), // Each stage can only have one start time
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp' }), // nullable - set when stage completes
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

export type StageStartTime = typeof stageStartTimes.$inferSelect;
export type NewStageStartTime = typeof stageStartTimes.$inferInsert;

// XCM Message Counters
export const xcmMessageCounters = sqliteTable('xcm_message_counters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceChain: text('source_chain').notNull(),
  destinationChain: text('destination_chain').notNull(),
  messagesProcessed: integer('messages_processed').notNull().default(0),
  messagesFailed: integer('messages_failed').notNull().default(0),
  lastUpdated: integer('last_updated', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Teleportation Counters
export const teleportationCounters = sqliteTable('teleportation_counters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  totalMints: integer('total_mints').notNull().default(0),
  totalBurns: integer('total_burns').notNull().default(0),
  totalMintAmount: integer('total_mint_amount').notNull().default(0),
  totalBurnAmount: integer('total_burn_amount').notNull().default(0),
  failedOperations: integer('failed_operations').notNull().default(0),
  lastUpdated: integer('last_updated', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Pallet Migration Counters
export const palletMigrationCounters = sqliteTable('pallet_migration_counters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  palletName: text('pallet_name').notNull(),
  stageId: integer('stage_id')
    .notNull()
    .references(() => migrationStages.id),
  itemsProcessed: integer('items_processed').notNull().default(0),
  totalItems: integer('total_items').notNull().default(0),
  failedItems: integer('failed_items').notNull().default(0),
  lastUpdated: integer('last_updated', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// DMP Queue State Changes
export const dmpQueueEvents = sqliteTable('dmp_queue_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  queueSize: integer('queue_size').notNull(), // Number of messages in queue
  totalSizeBytes: integer('total_size_bytes').notNull().default(0), // Total size in bytes
  eventType: text('event_type').notNull(), // 'fill', 'drain', 'partial_drain'
  timestamp: integer('timestamp', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// UMP Queue State Changes
export const umpQueueEvents = sqliteTable('ump_queue_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  queueSize: integer('queue_size').notNull(), // Number of messages in queue
  totalSizeBytes: integer('total_size_bytes').notNull().default(0), // Total size in bytes
  timestamp: integer('timestamp', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

export type DmpQueueEvent = typeof dmpQueueEvents.$inferSelect;
export type NewDmpQueueEvent = typeof dmpQueueEvents.$inferInsert;

export type UmpQueueEvent = typeof umpQueueEvents.$inferSelect;
export type NewUmpQueueEvent = typeof umpQueueEvents.$inferInsert;

// Balance Verification - stores balance data for persistence
export const balanceVerification = sqliteTable('balance_verification', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chain: text('chain').notNull(), // 'relay-chain' or 'asset-hub'
  balanceType: text('balance_type').notNull(), // 'kept', 'migrated', 'checkingAccount', 'totalIssuance'
  balance: text('balance').notNull(), // Stored as string to preserve precision
  lastUpdated: integer('last_updated', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type BalanceVerification = typeof balanceVerification.$inferSelect;
export type NewBalanceVerification = typeof balanceVerification.$inferInsert;
