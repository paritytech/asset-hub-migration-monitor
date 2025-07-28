import { and, desc, eq } from 'drizzle-orm';

import { db } from '../db';
import { migrationStages } from '../db/schema';
import { Log } from '../logging/Log';
import { eventService } from '../services/eventService';

import { RuntimeManager } from './RuntimeManager';

export class SubscriptionManager {
  private static instance: SubscriptionManager;
  public migrationStartBlockNumber?: number | null = undefined;
  public migrationStarted?: boolean | null = undefined;
  public allSubsInitialized: boolean = false;
  private rcMigratorAvailableHandler?: () => Promise<void>;

  constructor() {}

  public static getInstance(): SubscriptionManager {
    if (!SubscriptionManager.instance) {
      SubscriptionManager.instance = new SubscriptionManager();
    }

    return SubscriptionManager.instance;
  }

  public async checkCurrentMigrationStageInDB() {
    const migrationStage = await db.query.migrationStages.findFirst({
      where: and(eq(migrationStages.chain, 'relay-chain'), eq(migrationStages.stage, 'Scheduled')),
    });

    const latestMigrationStage = await db.query.migrationStages.findFirst({
      where: eq(migrationStages.chain, 'relay-chain'),
      orderBy: desc(migrationStages.timestamp),
    });

    if (latestMigrationStage) {
      this.migrationStarted =
        latestMigrationStage.stage === 'Scheduled' || latestMigrationStage.stage === 'Pending'
          ? false
          : true;
    }

    if (migrationStage) {
      this.migrationStartBlockNumber = migrationStage.scheduledBlockNumber;
    }
  }

  public setMigrationBlockNumber(blockNumber: number) {
    this.migrationStartBlockNumber = blockNumber;
    
    Log.service({
      service: 'Subscription Manager',
      action: 'Migration block number set',
      details: { blockNumber }
    });
  }

  /**
   * Check if a migration stage indicates active migration
   */
  public isMigrationActive(stage: string): boolean {
    const inactiveStages = ['NotStarted', 'Scheduled', 'Complete', 'Pending'];
    return !inactiveStages.includes(stage);
  }

  /**
   * Get current migration status
   */
  public getMigrationStatus() {
    return {
      migrationStarted: this.migrationStarted,
      migrationStartBlockNumber: this.migrationStartBlockNumber,
      allSubsInitialized: this.allSubsInitialized
    };
  }

  public async initRuntimeDetection() {
    const runtimeManager = RuntimeManager.getInstance();

    Log.service({
      service: 'Subscription Manager',
      action: 'Initializing runtime detection',
    });

    // Initialize runtime detection
    await runtimeManager.initializeRuntimeDetection();

    Log.service({
      service: 'Subscription Manager',
      action: 'Runtime detection initialized',
      details: {
        rcMigratorAvailable: runtimeManager.isRcMigratorAvailable()
      }
    });
  }

  public async initAllMigrationSubs() {
    if (this.allSubsInitialized) {
      Log.service({
        service: 'Subscription Manager',
        action: 'Migration services already initialized, skipping',
      });
      return;
    }

    Log.service({
      service: 'Subscription Manager',
      action: 'Migration services initialized - all processing now handled by BlockProcessor',
      details: {
        migrationStarted: this.migrationStarted,
        migrationStartBlockNumber: this.migrationStartBlockNumber
      }
    });

    this.allSubsInitialized = true;
  }

  public async cleanup() {
    Log.service({
      service: 'Subscription Manager',
      action: 'Starting cleanup',
    });

    // Clean up the runtime manager
    const runtimeManager = RuntimeManager.getInstance();
    await runtimeManager.cleanupAsync();

    // Remove the event listener if it exists
    if (this.rcMigratorAvailableHandler) {
      eventService.off('rcMigratorAvailable', this.rcMigratorAvailableHandler);
      this.rcMigratorAvailableHandler = undefined;
    }

    // Reset state
    this.allSubsInitialized = false;
    this.migrationStarted = undefined;
    this.migrationStartBlockNumber = undefined;

    Log.service({
      service: 'Subscription Manager',
      action: 'Cleanup completed',
    });
  }
}
