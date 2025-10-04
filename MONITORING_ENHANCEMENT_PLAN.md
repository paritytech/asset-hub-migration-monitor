# AH-Monitoring Enhancement Plan

**Created**: 2025-10-03
**Status**: Draft
**Goal**: Replace event-based XCM metrics with storage-based queries and add critical migration monitoring capabilities

---

## Executive Summary

This plan outlines the transition from event-based XCM message tracking to a simpler, storage-based approach while adding critical missing metrics for migration monitoring. The changes will:

1. **Remove broken queries** (`dmpDataMessageCounts` - doesn't exist in runtime)
2. **Replace event-based XCM tracking** with storage queries
3. **Add critical migration metrics** (balance tracking, timing, health indicators)
4. **Simplify the codebase** by removing complex latency correlation logic

---

## Current State Analysis

### ✅ Working Queries
- `rcMigrator.rcMigrationStage()`
- `dmp.downwardMessageQueues(1000)`
- `parachainSystem.pendingUpwardMessages()`
- `timestamp.now()` / `system.events()`

### ❌ Broken Queries (Must Remove)
- `rcMigrator.dmpDataMessageCounts()` - **DOES NOT EXIST**
- `ahMigrator.dmpDataMessageCounts()` - **DOES NOT EXIST**

### 🔍 Missing Critical Data
- Asset Hub migration stage (TODO at line 746)
- Balance migration tracking
- Migration start/end block numbers
- XCM message health indicators
- Queue priority status

---

## Implementation Phases

---

## **PHASE 1: Critical Fixes & Foundation** 🚨
**Timeline**: 1-2 days
**Priority**: CRITICAL
**Goal**: Remove broken queries, add essential missing metrics

### Tasks

#### 1.1 Remove Broken Queries
**Files to modify**:
- `backend/src/services/BlockProcessor.ts`

**Changes**:
```typescript
// DELETE these lines:
- Line 739: apiAt.query.ahMigrator.dmpDataMessageCounts()
- Line 773: apiAt.query.rcMigrator.dmpDataMessageCounts()
- Line 743: await this.handleAhDmpDataMessageCounts(...)
- Line 781: await this.handleRcDmpDataMessageCounts(...)

// DELETE these methods (lines 799-847, 948-1038):
- handleAhDmpDataMessageCounts()
- handleRcDmpDataMessageCounts()
```

**Testing**:
- ✅ Backend starts without errors
- ✅ No "query not found" errors in logs
- ✅ Storage processing completes successfully

---

#### 1.2 Add Asset Hub Migration Stage Query
**Files to modify**:
- `backend/src/services/BlockProcessor.ts`

**Current (line 738-747)**:
```typescript
const [dmpDataMessageCounts, pendingUpwardMessages] = await Promise.all([
  apiAt.query.ahMigrator.dmpDataMessageCounts<ITuple<[u32, u32]>>(),  // ❌ BROKEN
  apiAt.query.parachainSystem.pendingUpwardMessages<Vec<Bytes>>(),
]);

// TODO: Query Asset Hub specific storage:
// - ahMigrator.ahMigrationStage (Do we actually need this?)  // ❌ YES WE DO!
```

**New**:
```typescript
const [ahMigrationStage, pendingUpwardMessages] = await Promise.all([
  apiAt.query.ahMigrator.ahMigrationStage<PalletAhMigratorMigrationStage>(),
  apiAt.query.parachainSystem.pendingUpwardMessages<Vec<Bytes>>(),
]);

await this.handleAhMigrationStage(ahMigrationStage, item);
await this.handleAhPendingUpwardMessages(pendingUpwardMessages, item);
```

**Add new handler**:
```typescript
private async handleAhMigrationStage(
  migrationStage: PalletAhMigratorMigrationStage,
  item: QueueItem
): Promise<void> {
  try {
    const currentStage = migrationStage.type;

    await db.insert(migrationStages).values({
      stage: currentStage,
      chain: 'asset-hub',
      details: JSON.stringify(migrationStage.toJSON()),
    });

    eventService.emit('ahStageUpdate', {
      stage: currentStage,
      chain: 'asset-hub',
      details: migrationStage.toJSON(),
      timestamp: new Date(item.timestamp!).toISOString(),
    });

    Log.chainEvent({
      chain: 'asset-hub',
      eventType: 'migration stage update',
      details: { stage: currentStage },
    });
  } catch (error) {
    Log.chainEvent({
      chain: 'asset-hub',
      eventType: 'migration stage processing error',
      error: error as Error,
    });
  }
}
```

**Testing**:
- ✅ AH stage updates appear in database
- ✅ Frontend receives `ahStageUpdate` events
- ✅ Both RC and AH stages displayed on dashboard

---

#### 1.3 Add Migration Timing Queries
**Files to modify**:
- `backend/src/services/BlockProcessor.ts`
- `backend/src/db/schema.ts`

**Add to Relay Chain storage queries**:
```typescript
const [migrationStage, dmpMessageQueue, migrationStartBlock, migrationEndBlock] = await Promise.all([
  apiAt.query.rcMigrator.rcMigrationStage<PalletRcMigratorMigrationStage>(),
  apiAt.query.dmp.downwardMessageQueues<Vec<PolkadotCorePrimitivesInboundDownwardMessage>>(1000),
  apiAt.query.rcMigrator.migrationStartBlock<Option<u32>>(),
  apiAt.query.rcMigrator.migrationEndBlock<Option<u32>>(),
]);
```

**Add to Asset Hub storage queries**:
```typescript
const [ahMigrationStage, pendingUpwardMessages, ahMigrationStartBlock, ahMigrationEndBlock] = await Promise.all([
  apiAt.query.ahMigrator.ahMigrationStage<PalletAhMigratorMigrationStage>(),
  apiAt.query.parachainSystem.pendingUpwardMessages<Vec<Bytes>>(),
  apiAt.query.ahMigrator.migrationStartBlock<Option<u32>>(),
  apiAt.query.ahMigrator.migrationEndBlock<Option<u32>>(),
]);
```

**Update schema** (`backend/src/db/schema.ts`):
```typescript
export const migrationTiming = sqliteTable('migration_timing', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chain: text('chain').notNull(), // 'relay-chain' | 'asset-hub'
  startBlock: integer('start_block'),
  endBlock: integer('end_block'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

**Add handler**:
```typescript
private async handleMigrationTiming(
  chain: 'relay-chain' | 'asset-hub',
  startBlock: Option<u32>,
  endBlock: Option<u32>,
  item: QueueItem
): Promise<void> {
  const start = startBlock.isSome ? startBlock.unwrap().toNumber() : null;
  const end = endBlock.isSome ? endBlock.unwrap().toNumber() : null;

  if (start || end) {
    await db.insert(migrationTiming).values({
      chain,
      startBlock: start,
      endBlock: end,
      updatedAt: new Date(item.timestamp!),
    });

    eventService.emit('migrationTiming', {
      chain,
      startBlock: start,
      endBlock: end,
      timestamp: new Date(item.timestamp!).toISOString(),
    });
  }
}
```

**Testing**:
- ✅ Start/end blocks stored in database
- ✅ Timeline displayed on frontend
- ✅ Duration calculated correctly

---

**Phase 1 Deliverables**:
- ✅ No more broken query errors
- ✅ Asset Hub migration stage tracked
- ✅ Migration timeline visible
- ✅ System stable and operational

---

## **PHASE 2: Balance Verification** 💰
**Timeline**: 2-3 days
**Priority**: HIGH
**Goal**: Track balance migration to verify financial correctness

### Tasks

#### 2.1 Add Balance Migration Tracking
**Files to modify**:
- `backend/src/services/BlockProcessor.ts`
- `backend/src/db/schema.ts`

**Update schema**:
```typescript
export const migrationBalances = sqliteTable('migration_balances', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chain: text('chain').notNull(),
  kept: text('kept'), // u128 as string (Relay Chain only)
  migrated: text('migrated'), // u128 as string (Relay Chain only)
  checkingAccount: text('checking_account'), // u128 as string (Asset Hub only)
  totalIssuance: text('total_issuance'), // u128 as string (Asset Hub only)
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});
```

**Add to Relay Chain storage queries**:
```typescript
const [
  migrationStage,
  dmpMessageQueue,
  migrationStartBlock,
  migrationEndBlock,
  rcMigratedBalance
] = await Promise.all([
  apiAt.query.rcMigrator.rcMigrationStage<PalletRcMigratorMigrationStage>(),
  apiAt.query.dmp.downwardMessageQueues<Vec<PolkadotCorePrimitivesInboundDownwardMessage>>(1000),
  apiAt.query.rcMigrator.migrationStartBlock<Option<u32>>(),
  apiAt.query.rcMigrator.migrationEndBlock<Option<u32>>(),
  apiAt.query.rcMigrator.rcMigratedBalance<PalletRcMigratorAccountsMigratedBalances>(),
]);
```

**Add to Asset Hub storage queries**:
```typescript
const [
  ahMigrationStage,
  pendingUpwardMessages,
  ahMigrationStartBlock,
  ahMigrationEndBlock,
  ahBalancesBefore
] = await Promise.all([
  apiAt.query.ahMigrator.ahMigrationStage<PalletAhMigratorMigrationStage>(),
  apiAt.query.parachainSystem.pendingUpwardMessages<Vec<Bytes>>(),
  apiAt.query.ahMigrator.migrationStartBlock<Option<u32>>(),
  apiAt.query.ahMigrator.migrationEndBlock<Option<u32>>(),
  apiAt.query.ahMigrator.ahBalancesBefore<PalletAhMigratorBalancesBefore>(),
]);
```

**Add handler**:
```typescript
private async handleRcMigratedBalance(
  balance: PalletRcMigratorAccountsMigratedBalances,
  item: QueueItem
): Promise<void> {
  const kept = balance.kept.toString();
  const migrated = balance.migrated.toString();

  await db.insert(migrationBalances).values({
    chain: 'relay-chain',
    kept,
    migrated,
    timestamp: new Date(item.timestamp!),
  });

  eventService.emit('rcBalanceMigration', {
    kept,
    migrated,
    timestamp: new Date(item.timestamp!).toISOString(),
  });

  Log.chainEvent({
    chain: 'relay-chain',
    eventType: 'balance migration update',
    details: { kept, migrated },
  });
}

private async handleAhBalancesBefore(
  balances: PalletAhMigratorBalancesBefore,
  item: QueueItem
): Promise<void> {
  const checkingAccount = balances.checkingAccount.toString();
  const totalIssuance = balances.totalIssuance.toString();

  await db.insert(migrationBalances).values({
    chain: 'asset-hub',
    checkingAccount,
    totalIssuance,
    timestamp: new Date(item.timestamp!),
  });

  eventService.emit('ahBalancesBefore', {
    checkingAccount,
    totalIssuance,
    timestamp: new Date(item.timestamp!).toISOString(),
  });

  Log.chainEvent({
    chain: 'asset-hub',
    eventType: 'balances before recorded',
    details: { checkingAccount, totalIssuance },
  });
}
```

**Testing**:
- ✅ RC balance (kept + migrated) recorded
- ✅ AH balances before migration recorded
- ✅ Can calculate: `ahAfter - ahBefore = rcMigrated`
- ✅ Balance verification displayed on frontend

---

#### 2.2 Frontend Balance Verification Panel
**Files to modify**:
- `frontend/src/components/BalanceVerification.tsx` (NEW)
- `frontend/src/App.tsx`
- `frontend/src/hooks/useEventSource.tsx`

**Create new component** (`frontend/src/components/BalanceVerification.tsx`):
```typescript
import React, { useState, useCallback } from 'react';
import { useEventSource } from '../hooks/useEventSource';
import './BalanceVerification.css';

interface BalanceData {
  rcKept: string | null;
  rcMigrated: string | null;
  ahBefore: string | null;
  ahAfter: string | null;
}

const BalanceVerification: React.FC = () => {
  const [balances, setBalances] = useState<BalanceData>({
    rcKept: null,
    rcMigrated: null,
    ahBefore: null,
    ahAfter: null,
  });

  const handleRcBalance = useCallback((eventType: string, data: any) => {
    if (eventType === 'rcBalanceMigration') {
      setBalances(prev => ({
        ...prev,
        rcKept: data.kept,
        rcMigrated: data.migrated,
      }));
    }
  }, []);

  const handleAhBalance = useCallback((eventType: string, data: any) => {
    if (eventType === 'ahBalancesBefore') {
      setBalances(prev => ({
        ...prev,
        ahBefore: data.totalIssuance,
      }));
    }
  }, []);

  useEventSource(['rcBalanceMigration'], handleRcBalance);
  useEventSource(['ahBalancesBefore'], handleAhBalance);

  const formatBalance = (balance: string | null): string => {
    if (!balance) return '-';
    const num = BigInt(balance);
    return (Number(num) / 1e12).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' KSM';
  };

  const isVerified = balances.rcMigrated && balances.ahBefore && balances.ahAfter
    ? BigInt(balances.ahAfter) - BigInt(balances.ahBefore) === BigInt(balances.rcMigrated)
    : null;

  return (
    <section className="card balance-verification">
      <div className="card-header">
        <h2 className="card-title">Balance Migration Verification</h2>
      </div>

      <div className="balance-content">
        <div className="balance-section">
          <h3>Relay Chain</h3>
          <div className="balance-row">
            <span className="label">Kept on RC:</span>
            <span className="value">{formatBalance(balances.rcKept)}</span>
          </div>
          <div className="balance-row">
            <span className="label">Migrated:</span>
            <span className="value">{formatBalance(balances.rcMigrated)}</span>
          </div>
        </div>

        <div className="balance-section">
          <h3>Asset Hub</h3>
          <div className="balance-row">
            <span className="label">Before Migration:</span>
            <span className="value">{formatBalance(balances.ahBefore)}</span>
          </div>
          <div className="balance-row">
            <span className="label">After Migration:</span>
            <span className="value">{formatBalance(balances.ahAfter)}</span>
          </div>
        </div>

        {isVerified !== null && (
          <div className={`verification-status ${isVerified ? 'verified' : 'error'}`}>
            {isVerified ? '✓ Balances Verified' : '✗ Balance Mismatch Detected'}
          </div>
        )}
      </div>
    </section>
  );
};

export default BalanceVerification;
```

**Testing**:
- ✅ Balance data displayed correctly
- ✅ Verification status shows when data available
- ✅ Alert if balances don't match

---

**Phase 2 Deliverables**:
- ✅ Balance tracking implemented
- ✅ Frontend balance verification panel
- ✅ Can verify migration financial correctness
- ✅ Alerts for balance mismatches

---

## **PHASE 3: XCM Health Monitoring** 📡
**Timeline**: 2-3 days
**Priority**: MEDIUM
**Goal**: Replace event-based XCM metrics with storage-based health indicators

### Tasks

#### 3.1 Remove Event-Based XCM Tracking
**Files to modify**:
- `backend/src/services/BlockProcessor.ts`
- `backend/src/services/cache/DmpLatencyProcessor.ts` (DELETE)
- `backend/src/services/cache/UmpLatencyProcessor.ts` (DELETE)
- `backend/src/services/cache/DmpMetricsCache.ts` (DELETE)
- `backend/src/services/cache/UmpMetricsCache.ts` (DELETE)
- `backend/src/db/schema.ts`

**Delete these event handlers**:
```typescript
// Lines 648-669
- handleAssetHubMessageQueueProcessed()

// Lines 671-697
- handleAssetHubUpwardMessageSent()

// Lines 702-717
- handleRelayChainMessageQueueProcessed()
```

**Delete these DB inserts**:
```typescript
// In handleAssetHubMessageQueueProcessed:
- db.insert(messageProcessingEventsAH)

// In handleAssetHubUpwardMessageSent:
- db.insert(upwardMessageSentEvents)

// In handleRelayChainMessageQueueProcessed:
- db.insert(messageProcessingEventsRC)
```

**Remove from processAssetHubBlock()** (lines 486-491):
```typescript
// DELETE:
if (event.section === 'messageQueue' && event.method === 'Processed') {
  await this.handleAssetHubMessageQueueProcessed(event, item);
}

if (event.section === 'parachainSystem' && event.method === 'UpwardMessageSent') {
  await this.handleAssetHubUpwardMessageSent(event, item);
}
```

**Remove from processRelayChainBlock()** (lines 531-533):
```typescript
// DELETE:
if (event.section === 'messageQueue' && event.method === 'Processed') {
  await this.handleRelayChainMessageQueueProcessed(event, item);
}
```

**Delete cache service files**:
- `backend/src/services/cache/DmpLatencyProcessor.ts`
- `backend/src/services/cache/UmpLatencyProcessor.ts`
- `backend/src/services/cache/DmpMetricsCache.ts`
- `backend/src/services/cache/UmpMetricsCache.ts`

**Update schema - remove tables**:
```typescript
// DELETE these tables:
export const messageProcessingEventsRC = ...
export const messageProcessingEventsAH = ...
export const upwardMessageSentEvents = ...
export const dmpMetricsCache = ...
export const umpMetricsCache = ...
export const queueProcessingCorrelation = ...
```

**Keep these tables** (still useful):
```typescript
// KEEP - simple queue size tracking
export const dmpQueueEvents = ...
export const umpQueueEvents = ...

// KEEP - message counters (we'll populate differently)
export const xcmMessageCounters = ...
```

**Testing**:
- ✅ No errors from deleted handlers
- ✅ Database migration runs cleanly
- ✅ No references to deleted files

---

#### 3.2 Add Storage-Based XCM Health Queries
**Files to modify**:
- `backend/src/services/BlockProcessor.ts`
- `backend/src/db/schema.ts`

**Add new schema**:
```typescript
export const xcmHealth = sqliteTable('xcm_health', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chain: text('chain').notNull(), // 'relay-chain' | 'asset-hub'
  pendingMessageCount: integer('pending_message_count'),
  pendingQueryCount: integer('pending_query_count'),
  queuePriority: text('queue_priority'), // JSON
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});
```

**Add to Relay Chain storage queries**:
```typescript
const [
  migrationStage,
  dmpMessageQueue,
  migrationStartBlock,
  migrationEndBlock,
  rcMigratedBalance,
  pendingXcmCount,
  umpQueuePriority
] = await Promise.all([
  apiAt.query.rcMigrator.rcMigrationStage<PalletRcMigratorMigrationStage>(),
  apiAt.query.dmp.downwardMessageQueues<Vec<PolkadotCorePrimitivesInboundDownwardMessage>>(1000),
  apiAt.query.rcMigrator.migrationStartBlock<Option<u32>>(),
  apiAt.query.rcMigrator.migrationEndBlock<Option<u32>>(),
  apiAt.query.rcMigrator.rcMigratedBalance<PalletRcMigratorAccountsMigratedBalances>(),
  apiAt.query.rcMigrator.counterForPendingXcmMessages<u32>(),
  apiAt.query.rcMigrator.ahUmpQueuePriorityConfig<PalletRcMigratorQueuePriority>(),
]);
```

**Add to Asset Hub storage queries**:
```typescript
const [
  ahMigrationStage,
  pendingUpwardMessages,
  ahMigrationStartBlock,
  ahMigrationEndBlock,
  ahBalancesBefore,
  dmpQueuePriority
] = await Promise.all([
  apiAt.query.ahMigrator.ahMigrationStage<PalletAhMigratorMigrationStage>(),
  apiAt.query.parachainSystem.pendingUpwardMessages<Vec<Bytes>>(),
  apiAt.query.ahMigrator.migrationStartBlock<Option<u32>>(),
  apiAt.query.ahMigrator.migrationEndBlock<Option<u32>>(),
  apiAt.query.ahMigrator.ahBalancesBefore<PalletAhMigratorBalancesBefore>(),
  apiAt.query.ahMigrator.dmpQueuePriorityConfig<PalletRcMigratorQueuePriority>(),
]);
```

**Add handlers**:
```typescript
private async handleXcmHealth(
  chain: 'relay-chain' | 'asset-hub',
  pendingCount: u32 | null,
  queuePriority: PalletRcMigratorQueuePriority,
  item: QueueItem
): Promise<void> {
  const count = pendingCount ? pendingCount.toNumber() : 0;

  await db.insert(xcmHealth).values({
    chain,
    pendingMessageCount: count,
    queuePriority: JSON.stringify(queuePriority.toJSON()),
    timestamp: new Date(item.timestamp!),
  });

  eventService.emit('xcmHealth', {
    chain,
    pendingMessageCount: count,
    queuePriority: queuePriority.toJSON(),
    timestamp: new Date(item.timestamp!).toISOString(),
  });

  // Alert if too many pending messages
  if (count > 50) {
    Log.service({
      service: 'XCM Health Monitor',
      action: 'High pending message count detected',
      details: { chain, count },
    });
  }

  // Alert if priority disabled
  if (queuePriority.isDisabled) {
    Log.service({
      service: 'XCM Health Monitor',
      action: 'Queue priority disabled',
      details: { chain },
    });
  }
}
```

**Testing**:
- ✅ XCM health data stored
- ✅ Alerts for high pending counts
- ✅ Alerts for disabled priority
- ✅ Frontend displays health status

---

#### 3.3 Update XCM Message Counters (Storage-Based)
**Files to modify**:
- `backend/src/services/BlockProcessor.ts`

**Update handleRcDownwardMessageQueues()**:
```typescript
private async handleRcDownwardMessageQueues(
  dmpMessageQueue: Vec<PolkadotCorePrimitivesInboundDownwardMessage>,
  item: QueueItem
) {
  try {
    const currentQueueSize = dmpMessageQueue.length;
    let totalSizeBytes = 0;
    for (const message of dmpMessageQueue) {
      totalSizeBytes += message.msg.encodedLength;
    }

    // Determine event type based on size change
    let eventType = 'no_change';
    if (currentQueueSize > this.previousDmpQueueSize) {
      eventType = 'fill';

      // INCREMENT message sent counter
      const messagesAdded = currentQueueSize - this.previousDmpQueueSize;
      await db.update(xcmMessageCounters)
        .set({
          messagesSent: sql`messagesSent + ${messagesAdded}`,
          lastUpdated: new Date(item.timestamp!)
        })
        .where(eq(xcmMessageCounters.sourceChain, 'relay-chain'));

      // Emit updated counter
      const counterRc = await db.query.xcmMessageCounters.findFirst({
        where: eq(xcmMessageCounters.sourceChain, 'relay-chain'),
      });

      if (counterRc) {
        eventService.emit('rcXcmMessageCounter', {
          sourceChain: counterRc.sourceChain,
          destinationChain: counterRc.destinationChain,
          messagesSent: counterRc.messagesSent,
          messagesProcessed: counterRc.messagesProcessed,
          messagesFailed: counterRc.messagesFailed,
          lastUpdated: counterRc.lastUpdated,
        });
      }
    } else if (currentQueueSize < this.previousDmpQueueSize) {
      eventType = currentQueueSize === 0 ? 'drain' : 'partial_drain';
    }

    // Store queue event (for historical graph)
    if (eventType !== 'no_change') {
      await db.insert(dmpQueueEvents).values({
        queueSize: currentQueueSize,
        totalSizeBytes,
        eventType,
        timestamp: new Date(item.timestamp!),
      });

      eventService.emit('dmpQueueEvent', {
        queueSize: currentQueueSize,
        totalSizeBytes,
        eventType,
        timestamp: new Date(item.timestamp!).toISOString(),
      });
    }

    this.previousDmpQueueSize = currentQueueSize;
  } catch (error) {
    Log.chainEvent({
      chain: 'relay-chain',
      eventType: 'DMP queue processing error',
      error: error as Error,
    });
  }
}
```

**Similar updates for UMP tracking in handleAhPendingUpwardMessages()**

**Testing**:
- ✅ Message counters increment correctly
- ✅ Queue size graphs still work
- ✅ No event-based processing needed

---

#### 3.4 Frontend XCM Health Panel
**Files to modify**:
- `frontend/src/components/XcmHealth.tsx` (NEW)
- `frontend/src/components/XcmMessageMetrics.tsx` (MODIFY/SIMPLIFY)
- `frontend/src/App.tsx`

**Simplify XcmMessageMetrics.tsx** - remove latency/throughput charts, keep only:
- Current queue sizes
- Pending message counts
- Queue priority status

**Testing**:
- ✅ XCM health panel displays correctly
- ✅ Real-time queue size updates
- ✅ Priority status visible
- ✅ Alerts for unhealthy state

---

**Phase 3 Deliverables**:
- ✅ Event-based XCM tracking removed
- ✅ Storage-based XCM health monitoring
- ✅ Simplified codebase
- ✅ Faster, more reliable metrics

---

## **PHASE 4: Additional Enhancements** ✨
**Timeline**: 2-3 days
**Priority**: LOW
**Goal**: Add nice-to-have features

### Tasks

#### 4.1 Preserved Accounts Tracking
**Files to modify**:
- `backend/src/services/BlockProcessor.ts`
- `backend/src/db/schema.ts`

**Add schema**:
```typescript
export const preservedAccounts = sqliteTable('preserved_accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  account: text('account').notNull().unique(),
  state: text('state').notNull(), // Migrate | Preserve | Part
  free: text('free'), // u128 as string
  reserved: text('reserved'), // u128 as string
  consumers: integer('consumers'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

export const preservedAccountsSummary = sqliteTable('preserved_accounts_summary', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  totalCount: integer('total_count').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});
```

**Add query** (optional - only if needed):
```typescript
// In processRelayChainStorage - OPTIONAL, could be expensive:
const counterForRcAccounts = await apiAt.query.rcMigrator.counterForRcAccounts<u32>();

await db.insert(preservedAccountsSummary).values({
  totalCount: counterForRcAccounts.toNumber(),
  timestamp: new Date(item.timestamp!),
});
```

**Testing**:
- ✅ Account count tracked
- ✅ Displayed on frontend

---

#### 4.2 Failed Migration Detection (Asset Hub)
**Files to modify**:
- `backend/src/services/BlockProcessor.ts`

**Add query**:
```typescript
// In processAssetHubStorage - check for failed migrations:
const failedMigrations = await apiAt.query.ahMigrator.rcAccounts.entries();

if (failedMigrations.length > 0) {
  Log.service({
    service: 'Failed Migration Detector',
    action: 'CRITICAL - Accounts failed to migrate',
    details: {
      count: failedMigrations.length,
      accounts: failedMigrations.map(([key, _]) => key.toHuman())
    },
  });

  eventService.emit('failedMigrations', {
    count: failedMigrations.length,
    timestamp: new Date(item.timestamp!).toISOString(),
  });
}
```

**Testing**:
- ✅ Alert fires if any failed migrations
- ✅ Frontend displays critical alert

---

#### 4.3 Manager & Governance Tracking
**Files to modify**:
- `backend/src/services/BlockProcessor.ts`
- `backend/src/db/schema.ts`

**Add schema**:
```typescript
export const migrationGovernance = sqliteTable('migration_governance', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chain: text('chain').notNull(),
  manager: text('manager'),
  canceller: text('canceller'), // RC only
  coolOffPeriod: text('cool_off_period'), // RC only - JSON
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});
```

**Add queries** (optional):
```typescript
const [manager, canceller, coolOffPeriod] = await Promise.all([
  apiAt.query.rcMigrator.manager<Option<AccountId32>>(),
  apiAt.query.rcMigrator.canceller<Option<AccountId32>>(),
  apiAt.query.rcMigrator.coolOffPeriod<Option<FrameSupportScheduleDispatchTime>>(),
]);
```

**Testing**:
- ✅ Governance data tracked
- ✅ Displayed on frontend admin panel

---

**Phase 4 Deliverables**:
- ✅ Preserved accounts tracking
- ✅ Failed migration alerts
- ✅ Governance tracking
- ✅ Complete monitoring coverage

---

## **PHASE 5: Testing & Documentation** 📚
**Timeline**: 2-3 days
**Priority**: CRITICAL
**Goal**: Ensure system stability and document changes

### Tasks

#### 5.1 Integration Testing
**Test scenarios**:
1. ✅ Fresh start with no migration
2. ✅ Migration scheduled event
3. ✅ Migration in progress
4. ✅ Migration completed
5. ✅ Both chains in sync
6. ✅ Balance verification success
7. ✅ Balance verification failure (simulated)
8. ✅ High pending XCM messages
9. ✅ Queue priority changes
10. ✅ Failed migrations detected

**Testing checklist**:
- ✅ Backend starts cleanly
- ✅ No errors in logs
- ✅ All storage queries execute
- ✅ Database writes successful
- ✅ Frontend receives all events
- ✅ Dashboard displays correctly
- ✅ Alerts fire appropriately

---

#### 5.2 Update Documentation
**Files to update**:
- `README.md` - Update features list
- `ah-monitoring.md` - Update architecture section
- `backend/README.md` (if exists) - Update queries list
- `frontend/README.md` (if exists) - Update components list

**New documentation**:
- `MONITORING_METRICS.md` - Complete list of tracked metrics
- `STORAGE_QUERIES.md` - All runtime storage queries used
- `ALERTING.md` - Alert conditions and thresholds

---

#### 5.3 Performance Testing
**Metrics to track**:
- ✅ Block processing time (should decrease without event processing)
- ✅ Database size growth
- ✅ Memory usage
- ✅ Frontend render performance
- ✅ SSE event frequency

**Optimization targets**:
- Block processing: < 100ms/block
- Database writes: < 50ms
- Frontend updates: < 16ms (60 FPS)

---

**Phase 5 Deliverables**:
- ✅ All tests passing
- ✅ Documentation complete
- ✅ Performance benchmarks met
- ✅ Production ready

---

## Rollback Plan

If any phase encounters critical issues:

### Phase 1-2 Rollback
- Revert commits
- Re-enable broken queries (they fail gracefully)
- Frontend still functional with existing data

### Phase 3 Rollback
- Keep event handlers
- Disable storage queries
- Falls back to event-based metrics

### Emergency Rollback
```bash
git revert <commit-range>
yarn build
pm2 restart ah-monitoring-backend
```

---

## Success Metrics

### Technical
- ✅ Zero runtime errors
- ✅ All storage queries execute successfully
- ✅ Database migrations complete
- ✅ Frontend renders all new components

### Functional
- ✅ Asset Hub migration stage tracked
- ✅ Balance verification operational
- ✅ XCM health monitoring functional
- ✅ Migration timeline accurate

### Performance
- ✅ Block processing faster (no event correlation)
- ✅ Database smaller (fewer tables/rows)
- ✅ Codebase simpler (less complexity)

---

## Dependencies

### External
- Polkadot.js API v16.2.2+ (already satisfied)
- Kusama runtime with rcMigrator pallet
- Asset Hub Kusama runtime with ahMigrator pallet

### Internal
- Database migration tooling (Drizzle)
- TypeScript compilation
- React build system

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Broken queries cause crashes | HIGH | LOW | Already have try/catch, graceful degradation |
| Missing storage items | MEDIUM | LOW | Runtime verification before deployment |
| Database migration fails | HIGH | LOW | Backup before migration, test on staging |
| Frontend breaks | MEDIUM | LOW | Progressive enhancement, fallbacks |
| Performance degrades | LOW | LOW | Benchmark before/after, optimize queries |

---

## Timeline Summary

| Phase | Duration | Dependencies | Deliverable |
|-------|----------|--------------|-------------|
| Phase 1 | 1-2 days | None | Critical fixes, AH stage tracking |
| Phase 2 | 2-3 days | Phase 1 | Balance verification |
| Phase 3 | 2-3 days | Phase 1 | Storage-based XCM metrics |
| Phase 4 | 2-3 days | Phase 1-3 | Enhanced features |
| Phase 5 | 2-3 days | Phase 1-4 | Testing & docs |

**Total**: 10-15 days for complete implementation

---

## Frontend Changes Required (Separate PR)

**Status**: Backend changes merged, frontend updates pending
**Goal**: Update frontend to reflect simplified XCM message tracking (processing-only counters)

### Changes Needed

#### 1. Remove `messagesSent` from XCM Counter Events
**Files to modify**:
- `frontend/src/hooks/useEventSource.tsx`
- `frontend/src/components/XcmMessageMetrics.tsx` (or equivalent XCM component)

**Event structure changes**:
```typescript
// OLD EVENT STRUCTURE (before backend changes):
{
  sourceChain: string;
  destinationChain: string;
  messagesSent: number;        // ❌ REMOVED
  messagesProcessed: number;
  messagesFailed: number;
  lastUpdated: Date;
}

// NEW EVENT STRUCTURE (after backend changes):
{
  sourceChain: string;
  destinationChain: string;
  messagesProcessed: number;   // ✅ ONLY FIELD TRACKED
  messagesFailed: number;
  lastUpdated: Date;
}
```

#### 2. Update Component State Management
**Remove tracking of `messagesSent`**:
```typescript
// In XcmMessageMetrics.tsx or similar component:

// OLD STATE:
const [dmpMetrics, setDmpMetrics] = useState({
  messagesSent: 0,      // ❌ REMOVE
  messagesProcessed: 0,
  messagesFailed: 0,
});

// NEW STATE:
const [dmpMetrics, setDmpMetrics] = useState({
  messagesProcessed: 0,  // ✅ ONLY TRACK PROCESSING
  messagesFailed: 0,
});
```

#### 3. Update UI Display
**Remove "Messages Sent" metrics from dashboard**:
- Remove any charts/graphs showing `messagesSent`
- Remove any counters displaying `messagesSent`
- Keep only `messagesProcessed` and `messagesFailed`

**Example UI changes**:
```typescript
// REMOVE:
<div className="metric">
  <span className="label">Messages Sent (DMP):</span>
  <span className="value">{dmpMetrics.messagesSent}</span>
</div>

// KEEP:
<div className="metric">
  <span className="label">Messages Processed (DMP):</span>
  <span className="value">{dmpMetrics.messagesProcessed}</span>
</div>
```

#### 4. Update Event Listeners
**Verify event names match backend emissions**:
```typescript
// Backend emits these events:
// - 'dmpMessageCounter' (DMP messages processed on Asset Hub)
// - 'umpMessageCounter' (UMP messages processed on Relay Chain)

// Frontend should listen to:
useEventSource(['dmpMessageCounter', 'umpMessageCounter'], handleXcmCounters);
```

#### 5. Simplify XCM Health Display
**Focus on what matters**:
- Show **only processing counts** (not sending counts)
- Show **queue sizes** from `dmpQueueEvents` / `umpQueueEvents`
- Show **failed message counts** (if any)

**Recommended layout**:
```
┌─────────────────────────────────────┐
│ XCM Message Processing              │
├─────────────────────────────────────┤
│ DMP (Relay → Asset Hub):            │
│   • Processed: 1,234                │
│   • Failed: 0                       │
│   • Current Queue Size: 5 messages  │
├─────────────────────────────────────┤
│ UMP (Asset Hub → Relay):            │
│   • Processed: 567                  │
│   • Failed: 0                       │
│   • Current Queue Size: 2 messages  │
└─────────────────────────────────────┘
```

### Testing Checklist
- [ ] Frontend builds without TypeScript errors
- [ ] No console errors related to missing `messagesSent` field
- [ ] XCM counters update in real-time via SSE
- [ ] UI displays only `messagesProcessed` and `messagesFailed`
- [ ] Charts/graphs render correctly with updated data structure

### Files to Review
1. `frontend/src/hooks/useEventSource.tsx` - Event listener setup
2. `frontend/src/components/XcmMessageMetrics.tsx` - Main XCM display component
3. `frontend/src/App.tsx` - Component integration
4. `frontend/src/types/*.ts` - Type definitions for events

### Migration Notes
- **Backward compatibility**: None needed (backend already updated)
- **Data loss**: Historical `messagesSent` data no longer tracked (intentional simplification)
- **User impact**: Cleaner, simpler metrics focusing on what matters (processing success/failure)

---

## Next Steps

1. **Review this plan** with team
2. **Create GitHub issues** for each phase
3. **Set up staging environment** for testing
4. **Begin Phase 1** implementation
5. **Daily standup** to track progress

---

## Questions & Decisions Needed

- [ ] Approval to proceed with Phase 1?
- [ ] Should we keep any event-based metrics? (Current plan: minimal queue tracking)
- [ ] Database backup strategy before migrations?
- [ ] Staging environment setup timeline?
- [ ] Frontend design review needed?

---

**Last Updated**: 2025-10-03
**Author**: Claude
**Version**: 1.0
