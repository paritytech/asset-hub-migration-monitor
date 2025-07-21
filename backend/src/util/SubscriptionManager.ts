import { and, desc, eq } from 'drizzle-orm';

import { db } from '../db';
import { migrationStages } from '../db/schema';
import { Log } from '../logging/Log';
import {
  runAhEventsService,
  runAhNewHeadsService,
  runAhMigrationStageService,
  runAhUmpPendingMessagesService,
  runAhXcmMessageCounterService,
} from '../services/ahService';
import { eventService } from '../services/eventService';
import {
  runRcDmpDataMessageCountsService,
  runRcNewHeadsService,
  runRcMessageQueueProcessedService,
  runRcMigrationStageService,
  runRcXcmMessageCounterService,
} from '../services/rcService';

import { RuntimeManager } from './RuntimeManager';

interface CleanupSub {
  service: string;
  action: string;
  unsub: () => void;
}

export class SubscriptionManager {
  private static instance: SubscriptionManager;
  private cleanUpSubs: CleanupSub[] = [];
  public migrationStartBlockNumber?: number | null = undefined;
  public migrationStarted?: boolean | null = undefined;
  public allSubsInitialized: boolean = false;
  private rcMigrationStageServiceInitialized: boolean = false;
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
  }

  public async initRcPreMigrationService() {
    const runtimeManager = RuntimeManager.getInstance();

    Log.service({
      service: 'Subscription Manager',
      action: 'Initializing pre-migration services',
    });

    // Initialize runtime detection
    await runtimeManager.initializeRuntimeDetection();

    // Define the handler for when rcMigrator becomes available
    this.rcMigratorAvailableHandler = async () => {
      Log.service({
        service: 'Subscription Manager',
        action: 'rcMigrator pallet is now available, initializing migration stage service',
      });

      // Remove the listener to prevent duplicate calls
      if (this.rcMigratorAvailableHandler) {
        eventService.off('rcMigratorAvailable', this.rcMigratorAvailableHandler);
        this.rcMigratorAvailableHandler = undefined;
      }

      // Now safely initialize the migration stage service
      await this.initializeRcMigrationStageService();
    };

    // If already available, initialize immediately
    if (runtimeManager.isRcMigratorAvailable()) {
      await this.initializeRcMigrationStageService();
    } else {
      // Only set up the listener if not already available
      eventService.on('rcMigratorAvailable', this.rcMigratorAvailableHandler);
    }

    // Initialize other services that don't depend on rcMigrator
    runRcNewHeadsService()
      .then(result =>
        this.cleanUpSubs.push({
          service: 'Application',
          action: 'Cleaning up RC new heads subscription',
          unsub: result,
        })
      )
      .catch(err =>
        Log.service({
          service: 'RC New Heads',
          action: 'Service start error',
          error: err as Error,
        })
      );

    runAhNewHeadsService()
      .then(result =>
        this.cleanUpSubs.push({
          service: 'Application',
          action: 'Cleaning up AH new heads subscription',
          unsub: result,
        })
      )
      .catch(err =>
        Log.service({
          service: 'AH new Heads',
          action: 'Service start error',
          error: err as Error,
        })
      );
  }

  public async initAllMigrationSubs() {
    const runtimeManager = RuntimeManager.getInstance();

    Log.service({
      service: 'Subscription Manager',
      action: 'Initializing all migration services',
    });

    // Services that depend on rcMigrator pallet
    if (runtimeManager.isRcMigratorAvailable()) {
      await this.initializeRcMigratorDependentServices();
    } else {
      Log.service({
        service: 'Subscription Manager',
        action: 'rcMigrator pallet not available, skipping dependent services',
      });
    }

    // Services that don't depend on rcMigrator

    runRcDmpDataMessageCountsService()
      .then(result =>
        this.cleanUpSubs.push({
          service: 'Application',
          action: 'Cleaning up RC DMP data message counts subscription',
          unsub: result,
        })
      )
      .catch(err =>
        Log.service({
          service: 'RC DMP Data Message Counts',
          action: 'Service start error',
          error: err as Error,
        })
      );

    runRcMessageQueueProcessedService()
      .then(result =>
        this.cleanUpSubs.push({
          service: 'Application',
          action: 'Cleaning up RC events subscription',
          unsub: result,
        })
      )
      .catch((err: Error) =>
        Log.service({
          service: 'RC Message Queue Processed',
          action: 'Service start error',
          error: err as Error,
        })
      );

    runAhMigrationStageService()
      .then(result =>
        this.cleanUpSubs.push({
          service: 'Application',
          action: 'Cleaning up AH migration stage subscription',
          unsub: result,
        })
      )
      .catch(err =>
        Log.service({
          service: 'AH Migration Stage',
          action: 'Service start error',
          error: err as Error,
        })
      );

    runAhXcmMessageCounterService()
      .then(result =>
        this.cleanUpSubs.push({
          service: 'Application',
          action: 'Cleaning up AH XCM message counter subscription',
          unsub: result,
        })
      )
      .catch(err =>
        Log.service({
          service: 'AH XCM Message Counter',
          action: 'Service start error',
          error: err as Error,
        })
      );

    runAhEventsService()
      .then(result =>
        this.cleanUpSubs.push({
          service: 'Application',
          action: 'Cleaning up AH events subscription',
          unsub: result,
        })
      )
      .catch(err =>
        Log.service({
          service: 'AH Events',
          action: 'Service start error',
          error: err as Error,
        })
      );

    runAhUmpPendingMessagesService()
      .then(result =>
        this.cleanUpSubs.push({
          service: 'Application',
          action: 'Cleaning up AH UMP pending messages subscription',
          unsub: result,
        })
      )
      .catch(err =>
        Log.service({
          service: 'AH UMP Pending Messages',
          action: 'Service start error',
          error: err as Error,
        })
      );

    this.allSubsInitialized = true;
  }

  private async initializeRcMigratorDependentServices(): Promise<void> {
    // runRcXcmMessageCounterService depends on rcMigrator.dmpDataMessageCounts
    try {
      const rcXcmResult = await runRcXcmMessageCounterService();
      this.cleanUpSubs.push({
        service: 'Application',
        action: 'Cleaning up RC XCM message counter subscription',
        unsub: rcXcmResult,
      });
    } catch (err) {
      Log.service({
        service: 'RC XCM Message Counter',
        action: 'Service start error',
        error: err as Error,
      });
    }
  }

  private async initializeRcMigrationStageService(): Promise<void> {
    if (this.rcMigrationStageServiceInitialized) {
      Log.service({
        service: 'Subscription Manager',
        action: 'RC Migration Stage service already initialized, skipping',
      });
      return;
    }

    try {
      Log.service({
        service: 'Subscription Manager',
        action: 'Initializing RC Migration Stage service',
      });

      const unsubscribe = await runRcMigrationStageService();
      this.cleanUpSubs.push({
        service: 'Application',
        action: 'Cleaning up RC migration stage subscription',
        unsub: unsubscribe,
      });

      this.rcMigrationStageServiceInitialized = true;

      Log.service({
        service: 'Subscription Manager',
        action: 'RC Migration Stage service initialized successfully',
      });
    } catch (error) {
      Log.service({
        service: 'RC Migration Stage',
        action: 'Service start error',
        error: error as Error,
      });
    }
  }

  public async cleanupAllSubs() {
    Log.service({
      service: 'Subscription Manager',
      action: 'Starting cleanup of all subscriptions',
    });

    this.cleanUpSubs.forEach(info => {
      Log.service({
        service: info.service,
        action: info.action,
      });

      info.unsub();
    });

    // Clean up the runtime manager
    const runtimeManager = RuntimeManager.getInstance();
    await runtimeManager.cleanupAsync();

    // Remove the event listener if it exists
    if (this.rcMigratorAvailableHandler) {
      eventService.off('rcMigratorAvailable', this.rcMigratorAvailableHandler);
      this.rcMigratorAvailableHandler = undefined;
    }

    Log.service({
      service: 'Subscription Manager',
      action: 'All subscriptions cleaned up',
    });
  }
}
