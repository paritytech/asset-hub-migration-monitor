import type { TypedApi } from 'polkadot-api';
import type { relayChain, assetHub } from '@polkadot-api/descriptors';
import type { Binary } from '@polkadot-api/substrate-bindings';

// Type aliases for PAPI
type RelayChainApi = TypedApi<typeof relayChain>;
type AssetHubApi = TypedApi<typeof assetHub>;
type RcSystemEvents = Awaited<ReturnType<RelayChainApi['query']['System']['Events']['getValue']>>;
type RcSystemEvent = RcSystemEvents[number];
type AhSystemEvents = Awaited<ReturnType<AssetHubApi['query']['System']['Events']['getValue']>>;
type AhSystemEvent = AhSystemEvents[number];

// Extract specific event types from the event enums
type AhEventEnum = AhSystemEvent['event'];
type AhMigratorEvents = Extract<AhEventEnum, { type: 'AhMigrator' }>['value'];
type BatchProcessedEvent = Extract<AhMigratorEvents, { type: 'BatchProcessed' }>['value'];

import { eq, desc, and } from 'drizzle-orm';

import { sql } from 'drizzle-orm';

import { db } from '../db';
import {
  migrationStages,
  palletMigrationCounters,
  xcmMessageCounters,
  dmpQueueEvents,
  umpQueueEvents,
  balanceVerification,
} from '../db/schema';
import { Log } from '../logging/Log';
import { getCurrentStageForPallet, getPalletFromStage, normalizeEventPalletName } from '../util/stageToPalletMapping';

import { AbstractApi } from './abstractApi';
import { PalletMigrationCache } from './cache/PalletMigrationCache';
import { TimeInStageCache } from './cache/TimeInStageCache';
import { eventService } from './eventService';

// TODO: Ensure we handle migration stages correctly.

enum ProcessingMode {
  DETECTION = 'detection',    // Looking for migration events
  FULL = 'full',              // Full migration monitoring
  COMPLETED = 'completed'     // Migration complete - no processing
}

interface QueueItem {
  blockNumber: number;
  blockHash: string | null;
  chain: 'relay-chain' | 'asset-hub';
  processed: boolean;
  timestamp?: number; // On-chain timestamp in milliseconds
}

export class BlockProcessor {
  private static instance: BlockProcessor;
  private queue: Map<string, QueueItem[]> = new Map();
  private processing: Map<string, boolean> = new Map();
  private lastBlockNumber: Map<string, number> = new Map();
  private previousDmpQueueSize: number = 0;
  private previousRcBalanceMigration: { kept: string; migrated: string } | null = null;
  private currentMode: ProcessingMode = ProcessingMode.DETECTION;
  private migrationStartBlockNumber?: number;
  private rcPriorityConfigQueried: boolean = false;
  private ahPriorityConfigQueried: boolean = false;
  private initialStageCheckDone: boolean = false;

  private constructor() {
    // Initialize queues for both chains
    this.queue.set('relay-chain', []);
    this.queue.set('asset-hub', []);
    this.processing.set('relay-chain', false);
    this.processing.set('asset-hub', false);
    // Initialize last block numbers to 0
    this.lastBlockNumber.set('relay-chain', 0);
    this.lastBlockNumber.set('asset-hub', 0);
    this.currentMode = ProcessingMode.DETECTION;
    this.rcPriorityConfigQueried = false;
    this.ahPriorityConfigQueried = false;
  }

  /**
   * Initialize BlockProcessor and check current migration state from database
   */
  public async initialize(): Promise<void> {
    try {
      // Check current migration state from database
      await this.checkCurrentMigrationStageInDB();
      
      Log.service({
        service: 'Block Processor',
        action: 'BlockProcessor initialized',
        details: {
          migrationStartBlockNumber: this.migrationStartBlockNumber,
          currentMode: this.currentMode
        }
      });
    } catch (error) {
      Log.service({
        service: 'Block Processor',
        action: 'Error during initialization',
        error: error as Error
      });
    }
  }

  /**
   * Check current migration stage in database and update internal state
   */
  private async checkCurrentMigrationStageInDB(): Promise<void> {
    const migrationStage = await db.query.migrationStages.findFirst({
      where: and(eq(migrationStages.chain, 'relay-chain'), eq(migrationStages.stage, 'Scheduled')),
    });

    const latestMigrationStage = await db.query.migrationStages.findFirst({
      where: eq(migrationStages.chain, 'relay-chain'),
      orderBy: desc(migrationStages.timestamp),
    });

    if (latestMigrationStage) {
      // Check if migration is completed
      if (this.isMigrationCompleted(latestMigrationStage.stage)) {
        this.switchToCompletedMode();
        Log.service({
          service: 'Block Processor',
          action: '🎉 Migration already completed (loaded from database)',
          details: { stage: latestMigrationStage.stage }
        });
      }
      // Check if migration is active
      else if (this.isMigrationActive(latestMigrationStage.stage)) {
        // Migration is active, switch to full mode
        this.switchToFullMode();
        Log.service({
          service: 'Block Processor',
          action: 'Active migration detected in database, switching to full mode',
          details: { stage: latestMigrationStage.stage }
        });
      }
    }

    if (migrationStage) {
      this.migrationStartBlockNumber = migrationStage.scheduledBlockNumber ?? undefined;
      Log.service({
        service: 'Block Processor',
        action: 'Migration block number loaded from database',
        details: { blockNumber: this.migrationStartBlockNumber }
      });
    }
  }

  public static getInstance(): BlockProcessor {
    if (!BlockProcessor.instance) {
      BlockProcessor.instance = new BlockProcessor();
    }
    return BlockProcessor.instance;
  }

  public addBlock(
    chain: 'relay-chain' | 'asset-hub',
    blockNumber: number,
    blockHash: string
  ): void {
    const chainQueue = this.queue.get(chain)!;
    const lastBlock = this.lastBlockNumber.get(chain)!;

    // Check if block already exists
    const exists = chainQueue.some(item => item.blockNumber === blockNumber);
    if (exists) {
      Log.service({
        service: 'Block Processor',
        action: 'Block already in queue',
        details: { chain, blockNumber },
      });
      return;
    }

    // Detect gaps and fill them
    if (lastBlock > 0 && blockNumber > lastBlock + 1) {
      Log.service({
        service: 'Block Processor',
        action: 'Gap detected, filling missing blocks',
        details: {
          chain,
          lastBlock,
          newBlock: blockNumber,
          gap: blockNumber - lastBlock - 1,
        },
      });

      // Add all missing blocks to queue
      for (let missingBlock = lastBlock + 1; missingBlock < blockNumber; missingBlock++) {
        chainQueue.push({
          blockNumber: missingBlock,
          blockHash: null,
          chain,
          processed: false,
        });
      }
    }

    // Add the new block to queue
    chainQueue.push({
      blockNumber,
      blockHash,
      chain,
      processed: false,
    });

    // Update last block number
    this.lastBlockNumber.set(chain, Math.max(lastBlock, blockNumber));

    // Sort by block number
    chainQueue.sort((a, b) => a.blockNumber - b.blockNumber);

    Log.service({
      service: 'Block Processor',
      action: 'Block added to queue',
      details: {
        chain,
        blockNumber,
        queueLength: chainQueue.length,
        lastBlock: this.lastBlockNumber.get(chain),
      },
    });

    // Start processing if not already running
    this.startProcessing(chain);
  }

  private async startProcessing(chain: 'relay-chain' | 'asset-hub'): Promise<void> {
    if (this.processing.get(chain)) {
      return; // Already processing
    }

    this.processing.set(chain, true);

    try {
      await this.processQueue(chain);
    } catch (error) {
      Log.service({
        service: 'Block Processor',
        action: 'Processing error',
        error: error as Error,
        details: { chain },
      });
    } finally {
      this.processing.set(chain, false);
    }
  }

  private async processQueue(chain: 'relay-chain' | 'asset-hub'): Promise<void> {
    const chainQueue = this.queue.get(chain)!;

    while (chainQueue.length > 0) {
      const item = chainQueue[0];

      if (item.processed) {
        chainQueue.shift(); // Remove processed item
        continue;
      }

      try {
        await this.processBlock(item);
        item.processed = true;

        Log.service({
          service: 'Block Processor',
          action: 'Block processed successfully',
          details: {
            chain: item.chain,
            blockNumber: item.blockNumber,
            remaining: chainQueue.length - 1,
          },
        });

        chainQueue.shift(); // Remove processed item
      } catch (error) {
        Log.service({
          service: 'Block Processor',
          action: 'Block processing failed',
          error: error as Error,
          details: { chain: item.chain, blockNumber: item.blockNumber },
        });

        // For now, skip failed blocks
        // TODO: Implement retry logic
        chainQueue.shift();
      }
    }
  }

  private async processBlock(item: QueueItem): Promise<void> {
    // Process based on current mode
    if (this.currentMode === ProcessingMode.COMPLETED) {
      // Migration completed - skip all processing
      Log.service({
        service: 'Block Processor',
        action: 'Skipping block - migration completed',
        details: {
          chain: item.chain,
          blockNumber: item.blockNumber,
          timestamp: item.timestamp ? new Date(item.timestamp).toISOString(): null,
          message: 'All processing stopped. Only FinalizedService is tracking blocks.'
        }
      });
      return;
    }

    Log.service({
      service: 'Block Processor',
      action: 'Processing block',
      details: {
        chain: item.chain,
        blockNumber: item.blockNumber,
        blockHash: item.blockHash,
      },
    });

    try {
      // Get the appropriate API and client instances
      const abstractApi = AbstractApi.getInstance();
      const api =
        item.chain === 'asset-hub'
          ? abstractApi.getAssetHubApi()
          : abstractApi.getRelayChainApi();

      const client =
        item.chain === 'asset-hub'
          ? abstractApi.getAssetHubClient()
          : abstractApi.getRelayChainClient();

      let blockHash = item.blockHash;
      if (!blockHash) {
        blockHash = await client._request<string, [number]>('chain_getBlockHash', [item.blockNumber]);
      }

      // Query the on-chain timestamp and events at this block
      const [timestamp, events] = await Promise.all([
        api.query.Timestamp.Now.getValue({ at: blockHash }),
        api.query.System.Events.getValue({ at: blockHash }),
      ]);

      item.timestamp = Number(timestamp);

      Log.service({
        service: 'Block Processor',
        action: 'Block timestamp retrieved',
        details: {
          chain: item.chain,
          blockNumber: item.blockNumber,
          timestamp: item.timestamp,
          timestampDate: new Date(item.timestamp!).toISOString(),
        },
      });

      // Initial stage check - only on Relay Chain, only once, only if no stages in DB
      if (item.chain === 'relay-chain' && !this.initialStageCheckDone) {
        await this.performInitialStageCheck(api as RelayChainApi, blockHash, item);
      }

      if (this.currentMode === ProcessingMode.DETECTION) {
        // Detection mode: only process relay chain for migration events
        if (item.chain === 'relay-chain') {
          await this.processRelayChainDetectionOnly(item, events as RcSystemEvents);
        } else {
          // Skip Asset Hub processing in detection mode
          Log.service({
            service: 'Block Processor',
            action: 'Skipping Asset Hub block in detection mode',
            details: {
              blockNumber: item.blockNumber,
              timestamp: new Date(item.timestamp!).toISOString()
            }
          });
        }
      } else if (this.currentMode === ProcessingMode.FULL) {
        // Full mode: use existing shouldProcessBlock logic for efficiency
        const shouldProcess = this.shouldProcessBlock(item.blockNumber, item.chain);

        if (shouldProcess) {
          // Full processing: events, storage queries, database writes
          if (item.chain === 'asset-hub') {
            await this.processAssetHubBlock(item, api as AssetHubApi, blockHash, events as AhSystemEvents);
          } else {
            await this.processRelayChainBlock(item, api as RelayChainApi, blockHash, events as RcSystemEvents);
          }
        } else {
          // Lightweight processing: just track the block for gap detection
          Log.service({
            service: 'Block Processor',
            action: 'Skipping full processing - not near migration',
            details: {
              blockNumber: item.blockNumber,
              chain: item.chain,
              timestamp: new Date(item.timestamp!).toISOString()
            }
          });
        }
      }
    } catch (error) {
      Log.service({
        service: 'Block Processor',
        action: 'Error querying block timestamp',
        error: error as Error,
        details: {
          chain: item.chain,
          blockNumber: item.blockNumber,
          blockHash: item.blockHash,
        },
      });
      // Continue processing even if timestamp query fails
    }
  }

  /**
   * Process Asset Hub specific block data
   */
  private async processAssetHubBlock(
    item: QueueItem,
    api: AssetHubApi,
    blockHash: string,
    events: AhSystemEvents
  ): Promise<void> {
    Log.service({
      service: 'Block Processor',
      action: 'Processing Asset Hub block',
      details: {
        blockNumber: item.blockNumber,
        eventsCount: events.length,
      },
    });

    try {
      // Query Asset Hub specific storage
      await this.processAssetHubStorage(api, blockHash, item);

      // Process Asset Hub specific events
      for (const eventRecord of events) {
        const { event } = eventRecord;

        // Handle ahMigrator.BatchProcessed events
        if (event.type === 'AhMigrator') {
          const ahEvent = event.value as any;
          if (ahEvent.type === 'BatchProcessed') {
            await this.handleAssetHubBatchProcessed(eventRecord, item);
          }
          // Handle ahMigrator.DmpQueuePrioritySet event
          if (ahEvent.type === 'DmpQueuePriorityConfigSet') {
            await this.handleDmpQueuePriorityChangedEvent(eventRecord, api, blockHash, item);
          }
        }

        // Handle messageQueue.Processed events (DMP latency)
        if (event.type === 'MessageQueue') {
          const mqEvent = event.value as any;
          if (mqEvent.type === 'Processed') {
            await this.handleAssetHubMessageQueueProcessed(eventRecord, item);
          }
        }

        // Handle parachainSystem.UpwardMessageSent events (UMP)
        if (event.type === 'ParachainSystem') {
          const psEvent = event.value as any;
          if (psEvent.type === 'UpwardMessageSent') {
            await this.handleAssetHubUpwardMessageSent(eventRecord, item);
          }
        }
      }

      // Emit pallet migration events after processing all events in this block
      const palletMigrationCache = PalletMigrationCache.getInstance();
      palletMigrationCache.emitEvents();
    } catch (error) {
      Log.service({
        service: 'Block Processor',
        action: 'Error processing Asset Hub block',
        error: error as Error,
        details: { blockNumber: item.blockNumber },
      });
    }
  }

  /**
   * Process Relay Chain specific block data
   */
  private async processRelayChainBlock(
    item: QueueItem,
    api: RelayChainApi,
    blockHash: string,
    events: RcSystemEvents
  ): Promise<void> {
    Log.service({
      service: 'Block Processor',
      action: 'Processing Relay Chain block',
      details: {
        blockNumber: item.blockNumber,
        eventsCount: events.length,
      },
    });

    try {
      // Query Relay Chain specific storage
      await this.processRelayChainStorage(api, blockHash, item);

      // Process Relay Chain specific events
      for (const eventRecord of events) {
        const { event } = eventRecord;

        // Handle messageQueue.Processed events (UMP latency)
        if (event.type === 'MessageQueue' && event.value.type === 'Processed') {
          await this.handleRelayChainMessageQueueProcessed(eventRecord, item);
        }

        // Handle rcMigrator.AhUmpQueuePriorityConfigSet event
        if (event.type === 'RcMigrator' && event.value.type === 'AhUmpQueuePriorityConfigSet') {
          await this.handleUmpQueuePriorityChangedEvent(eventRecord, api, blockHash, item);
        }
      }
    } catch (error) {
      Log.service({
        service: 'Block Processor',
        action: 'Error processing Relay Chain block',
        error: error as Error,
        details: { blockNumber: item.blockNumber },
      });
    }
  }

  /**
   * Asset Hub event handlers
   */
  private async handleAssetHubBatchProcessed(eventRecord: AhSystemEvent, item: QueueItem): Promise<void> {
    let eventData: BatchProcessedEvent | undefined;
    try {
      eventData = eventRecord.event.value.value as BatchProcessedEvent;
      // In PAPI, pallet is an Enum with a 'type' property
      const palletName = typeof eventData.pallet === 'string' ? eventData.pallet : eventData.pallet.type;

      // PAPI returns count_good and count_bad (not items_processed/items_failed)
      // These are returned as number type from PAPI
      const itemsProcessed = eventData.count_good;
      const itemsFailed = eventData.count_bad;

      // Validate the numbers are finite
      if (!Number.isFinite(itemsProcessed) || !Number.isFinite(itemsFailed)) {
        Log.chainEvent({
          chain: 'asset-hub',
          eventType: 'BatchProcessed - invalid numbers',
          details: {
            palletName,
            itemsProcessed,
            itemsFailed,
            rawEventData: eventData,
          },
        });
        return;
      }

      // Normalize the event pallet name to our internal pallet name
      const targetPallet = normalizeEventPalletName(palletName);

      // Get the current stage for this pallet
      const currentStageName = getCurrentStageForPallet(targetPallet);

      if (!currentStageName) {
        Log.chainEvent({
          chain: 'asset-hub',
          eventType: 'BatchProcessed - unknown pallet',
          details: { palletName, targetPallet },
        });
        return;
      }

      const currentStage = await db.query.migrationStages.findFirst({
        where: eq(migrationStages.stage, currentStageName),
        orderBy: [desc(migrationStages.timestamp)],
      });

      if (!currentStage) {
        Log.chainEvent({
          chain: 'asset-hub',
          eventType: 'BatchProcessed - stage not found',
          details: { palletName, targetPallet, currentStageName },
        });

        return;
      }

      const existingCounter = await db.query.palletMigrationCounters.findFirst({
        where: and(
          eq(palletMigrationCounters.palletName, targetPallet),
          eq(palletMigrationCounters.stageId, currentStage!.id)
        ),
      });

      if (existingCounter) {
        // Update existing counter
        await db
          .update(palletMigrationCounters)
          .set({
            itemsProcessed: existingCounter.itemsProcessed + itemsProcessed,
            failedItems: existingCounter.failedItems + itemsFailed,
            lastUpdated: new Date(),
          })
          .where(eq(palletMigrationCounters.id, existingCounter.id));
      } else {
        // Create new counter
        await db.insert(palletMigrationCounters).values({
          palletName: targetPallet,
          stageId: currentStage.id,
          itemsProcessed,
          totalItems: 0, // We don't know the total yet
          failedItems: itemsFailed,
          lastUpdated: new Date(),
        });
      }

      // Add to pallet migration cache for event emission
      const palletMigrationCache = PalletMigrationCache.getInstance();
      palletMigrationCache.addBatchData(targetPallet, itemsProcessed, itemsFailed);

      // Emit alert if there are failed items
      if (itemsFailed > 0) {
        eventService.emit('migrationAlert', {
          blockNumber: item.blockNumber,
          palletName: targetPallet,
          itemsProcessed,
          itemsFailed,
          stageName: currentStageName,
          stageId: currentStage.id,
        });
      }

      Log.chainEvent({
        chain: 'asset-hub',
        eventType: 'BatchProcessed',
        details: {
          palletName,
          targetPallet,
          currentStageName,
          itemsProcessed,
          itemsFailed,
          stageId: currentStage.id,
        },
      });

      Log.chainEvent({
        chain: 'asset-hub',
        eventType: 'BatchProcessed',
        blockNumber: item.blockNumber,
        details: { eventData },
      });
    } catch (error) {
      Log.chainEvent({
        chain: 'asset-hub',
        eventType: 'BatchProcessed processing error',
        error: error as Error,
        details: {
          eventData,
        },
      });
    }
  }

  private async handleAssetHubMessageQueueProcessed(eventRecord: AhSystemEvent, item: QueueItem): Promise<void> {
    try {
      // Simple increment - DMP messages processed on Asset Hub
      const updatedDb = await db.update(xcmMessageCounters)
        .set({
          messagesProcessed: sql`messages_processed + 1`,
          lastUpdated: new Date(item.timestamp!)
        })
        .where(eq(xcmMessageCounters.destinationChain, 'asset-hub')).returning();

      if (updatedDb[0]) {
        const eventData = {
          sourceChain: updatedDb[0].sourceChain,
          destinationChain: updatedDb[0].destinationChain,
          messagesProcessed: updatedDb[0].messagesProcessed,
          messagesFailed: updatedDb[0].messagesFailed,
          lastUpdated: updatedDb[0].lastUpdated,
        };
        eventService.emit('dmpMessageCounter', eventData);
      }

      Log.chainEvent({
        chain: 'asset-hub',
        eventType: 'MessageQueue.Processed',
        blockNumber: item.blockNumber,
        details: { totalProcessed: updatedDb[0]?.messagesProcessed },
      });
    } catch (error) {
      Log.chainEvent({
        chain: 'asset-hub',
        eventType: 'MessageQueue.Processed error',
        error: error as Error,
      });
    }
  }

  private async handleAssetHubUpwardMessageSent(eventRecord: AhSystemEvent, item: QueueItem): Promise<void> {
    try {
      Log.chainEvent({
        chain: 'asset-hub',
        eventType: 'UpwardMessageSent',
        blockNumber: item.blockNumber,
      });
    } catch (error) {
      Log.chainEvent({
        chain: 'asset-hub',
        eventType: 'UpwardMessageSent error',
        error: error as Error,
      });
    }
  }

  /**
   * Relay Chain event handlers
   */
  private async handleRelayChainMessageQueueProcessed(
    _: RcSystemEvent,
    item: QueueItem
  ): Promise<void> {
    try {
      // Simple increment - UMP messages processed on Relay Chain
      const updatedDb = await db.update(xcmMessageCounters)
        .set({
          messagesProcessed: sql`messages_processed + 1`,
          lastUpdated: new Date(item.timestamp!)
        })
        .where(eq(xcmMessageCounters.destinationChain, 'relay-chain')).returning();

      if (updatedDb[0]) {
        const eventData = {
          sourceChain: updatedDb[0].sourceChain,
          destinationChain: updatedDb[0].destinationChain,
          messagesProcessed: updatedDb[0].messagesProcessed,
          messagesFailed: updatedDb[0].messagesFailed,
          lastUpdated: updatedDb[0].lastUpdated,
        };
        eventService.emit('umpMessageCounter', eventData);
      }

      Log.chainEvent({
        chain: 'relay-chain',
        eventType: 'MessageQueue.Processed',
        blockNumber: item.blockNumber,
        details: { totalProcessed: updatedDb[0]?.messagesProcessed },
      });
    } catch (error) {
      Log.chainEvent({
        chain: 'relay-chain',
        eventType: 'MessageQueue.Processed error',
        error: error as Error,
      });
    }
  }

  /**
   * Asset Hub storage queries
   */
  private async processAssetHubStorage(
    api: AssetHubApi,
    blockHash: string,
    item: QueueItem
  ): Promise<void> {
    try {
      // Query priority config only once on first full mode block
      if (!this.ahPriorityConfigQueried) {
        const [pendingUpwardMessages, dmpQueuePriority, ahBalancesBefore] = await Promise.all([
          api.query.ParachainSystem.PendingUpwardMessages.getValue({ at: blockHash }),
          api.query.AhMigrator.DmpQueuePriorityConfig.getValue({ at: blockHash }),
          api.query.AhMigrator.AhBalancesBefore.getValue({ at: blockHash })
        ]);

        await this.handleAhPendingUpwardMessages(pendingUpwardMessages, item);
        await this.handleDmpQueuePriority(dmpQueuePriority, item);
        await this.handleAhBalancesBefore(ahBalancesBefore, item);
      } else {
        const pendingUpwardMessages = await api.query.ParachainSystem.PendingUpwardMessages.getValue({ at: blockHash });

        await this.handleAhPendingUpwardMessages(pendingUpwardMessages, item);
      }

      Log.service({
        service: 'Block Processor',
        action: 'Asset Hub storage queries completed',
        details: { blockNumber: item.blockNumber },
      });
    } catch (error) {
      Log.service({
        service: 'Block Processor',
        action: 'Error querying Asset Hub storage',
        error: error as Error,
        details: { blockNumber: item.blockNumber },
      });
    }
  }

  /**
   * Relay Chain storage queries
   */
  private async processRelayChainStorage(
    api: RelayChainApi,
    blockHash: string,
    item: QueueItem
  ): Promise<void> {
    try {
      // Query priority config only once on first full mode block
      if (!this.rcPriorityConfigQueried) {
        const [migrationStage, dmpMessageQueue, umpQueuePriority, rcBalanceMigration] = await Promise.all([
          api.query.RcMigrator.RcMigrationStage.getValue({ at: blockHash }),
          api.query.Dmp.DownwardMessageQueues.getValue(1000, { at: blockHash }),
          api.query.RcMigrator.AhUmpQueuePriorityConfig.getValue({ at: blockHash }),
          api.query.RcMigrator.RcMigratedBalance.getValue({ at: blockHash }),
        ]);

        await this.handleRcMigrationStage(migrationStage, item);
        await this.handleRcDownwardMessageQueues(dmpMessageQueue, item);
        await this.handleUmpQueuePriority(umpQueuePriority, item);
        await this.handleRcBalanceMigration(rcBalanceMigration, item);

        this.rcPriorityConfigQueried = true;
      } else {
        const [migrationStage, dmpMessageQueue, rcBalanceMigration] = await Promise.all([
          api.query.RcMigrator.RcMigrationStage.getValue({ at: blockHash }),
          api.query.Dmp.DownwardMessageQueues.getValue(1000, { at: blockHash }),
          api.query.RcMigrator.RcMigratedBalance.getValue({ at: blockHash }),
        ]);

        await this.handleRcMigrationStage(migrationStage, item);
        await this.handleRcDownwardMessageQueues(dmpMessageQueue, item);
        await this.handleRcBalanceMigration(rcBalanceMigration, item);
      }

      Log.service({
        service: 'Block Processor',
        action: 'Relay Chain storage queries completed',
        details: { blockNumber: item.blockNumber },
      });
    } catch (error) {
      Log.service({
        service: 'Block Processor',
        action: 'Error querying Relay Chain storage',
        error: error as Error,
        details: { blockNumber: item.blockNumber },
      });
    }
  }

  private async handleAhPendingUpwardMessages(pendingUpwardMessages: Binary[], item: QueueItem) {
    try {
      let totalSizeBytes = 0;
      for (const message of pendingUpwardMessages) {
        // PAPI returns Binary objects, convert to hex and calculate byte size
        const hexString = message.asHex();
        const messageSize = (hexString.length - 2) / 2; // Remove '0x' prefix and divide by 2
        totalSizeBytes += messageSize;
      }

      await db.insert(umpQueueEvents).values({
        queueSize: pendingUpwardMessages.length,
        totalSizeBytes,
        timestamp: new Date(item.timestamp!),
      });

      eventService.emit('umpQueueEvent', {
        queueSize: pendingUpwardMessages.length,
        totalSizeBytes,
        timestamp: new Date(item.timestamp!).toISOString(),
      });

      Log.service({
        service: 'Asset Hub UMP',
        action: 'UMP queue event recorded',
        details: { queueSize: pendingUpwardMessages.length, totalSizeBytes },
      });
    } catch (error) {
      Log.service({
        service: 'Asset Hub UMP',
        action: 'Error processing UMP pending messages',
        error: error as Error,
      });
    }
  }

  private async handleRcDownwardMessageQueues(
    dmpMessageQueue: Array<{ sent_at: number; msg: Binary }>,
    item: QueueItem
  ) {
    try {
      const currentQueueSize = dmpMessageQueue.length;
      // Calculate exact total size in bytes by summing encoded lengths
      let totalSizeBytes = 0;
      for (const message of dmpMessageQueue) {
        // PAPI returns Binary objects, convert to hex and calculate byte size
        const hexString = message.msg.asHex();
        totalSizeBytes += (hexString.length - 2) / 2;
      }

      // Determine event type based on size change
      let eventType = 'no_change';
      if (currentQueueSize > this.previousDmpQueueSize) {
        eventType = 'fill';
      } else if (currentQueueSize < this.previousDmpQueueSize) {
        eventType = currentQueueSize === 0 ? 'drain' : 'partial_drain';
      }

      if (eventType !== 'no_change') {
        const timestamp = new Date(item.timestamp!);

        await db.insert(dmpQueueEvents).values({
          queueSize: currentQueueSize,
          totalSizeBytes,
          eventType,
          timestamp,
        });

        // Emit event for frontend
        eventService.emit('dmpQueueEvent', {
          queueSize: currentQueueSize,
          totalSizeBytes,
          eventType,
          timestamp: timestamp.toISOString(),
        });

        Log.chainEvent({
          chain: 'relay-chain',
          eventType: `DMP queue ${eventType}`,
          details: {
            queueSize: currentQueueSize,
            totalSizeBytes,
            previousSize: this.previousDmpQueueSize,
            change: currentQueueSize - this.previousDmpQueueSize,
          },
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

  private async handleRcMigrationStage(
    migrationStage: any,
    item: QueueItem
  ) {
    const timeInStageCache = TimeInStageCache.getInstance();

    try {
      const currentStage = migrationStage.type;
      const isScheduled = currentStage === 'Scheduled';
      const scheduledBlockNumber = isScheduled ? (migrationStage.value as { start: number }).start : undefined;

      // Check if this is a new stage before inserting
      const isNewStage = await timeInStageCache.recordStageStart(currentStage);

      // Only insert to database if this is a new stage
      if (isNewStage) {
        await db.insert(migrationStages).values({
          stage: currentStage,
          chain: 'relay-chain',
          details: JSON.stringify(migrationStage),
          scheduledBlockNumber,
        });
      }

      if (isScheduled && scheduledBlockNumber) {
        await this.setMigrationBlockNumber(scheduledBlockNumber);
      }

      // Check if migration is completed
      if (this.isMigrationCompleted(currentStage)) {
        Log.service({
          service: 'Block Processor',
          action: '🎉 MigrationDone stage detected - switching to completed mode',
          details: { stage: currentStage, blockNumber: item.blockNumber }
        });
        this.switchToCompletedMode();
      }
      // Check if we need to switch to full processing based on current stage
      else if (this.isMigrationActive(currentStage)) {
        Log.service({
          service: 'Block Processor',
          action: 'Active migration detected in finalized block, switching to full mode',
          details: { stage: currentStage, blockNumber: item.blockNumber }
        });
        this.switchToFullMode();
      }

      const palletName = getPalletFromStage(currentStage);
      const palletInfo = palletName ? timeInStageCache.getCurrentPalletInfo(palletName) : null;

      // Emit event on every block to update timeInPallet
      eventService.emit('rcStageUpdate', {
        stage: currentStage,
        chain: 'relay-chain',
        details: migrationStage,
        timestamp: new Date(item.timestamp!).toISOString(),
        palletName: palletName || null,
        scheduledBlockNumber,
        palletInitStartedAt: palletInfo?.initStartedAt || null,
        timeInPallet: palletInfo?.timeInPallet || null,
        isNewStage,
        isPalletCompleted: palletInfo?.isCompleted || false,
        palletTotalDuration: palletInfo?.totalDuration || null,
        currentPalletStage: palletInfo?.currentStage || null,
      });

      Log.chainEvent({
        chain: 'relay-chain',
        eventType: 'migration stage update',
        details: {
          stage: currentStage,
          palletName,
          isNewStage,
          timeInPallet: palletInfo?.timeInPallet || null,
          isPalletCompleted: palletInfo?.isCompleted || false,
          scheduledBlockNumber,
        },
      });
    } catch (error) {
      Log.chainEvent({
        chain: 'relay-chain',
        eventType: 'migration stage processing error',
        error: error as Error,
      });
    }
  }

  private async handleUmpQueuePriority(
    queuePriority: any,
    item: QueueItem
  ): Promise<void> {
    try {
      const priorityType = queuePriority.type;

      eventService.emit('umpQueuePriority', {
        type: priorityType,
        timestamp: new Date(item.timestamp!).toISOString(),
      });

      Log.service({
        service: 'UMP Queue Priority',
        action: 'UMP queue priority config retrieved',
        details: { type: priorityType },
      });
    } catch (error) {
      Log.service({
        service: 'UMP Queue Priority',
        action: 'Error processing UMP queue priority',
        error: error as Error,
      });
    }
  }

  private async handleDmpQueuePriority(
    queuePriority: any,
    item: QueueItem
  ): Promise<void> {
    try {
      const priorityType = queuePriority.type;

      eventService.emit('dmpQueuePriority', {
        type: priorityType,
        timestamp: new Date(item.timestamp!).toISOString(),
      });

      Log.service({
        service: 'DMP Queue Priority',
        action: 'DMP queue priority config retrieved',
        details: { type: priorityType },
      });
    } catch (error) {
      Log.service({
        service: 'DMP Queue Priority',
        action: 'Error processing DMP queue priority',
        error: error as Error,
      });
    }
  }

  private async handleUmpQueuePriorityChangedEvent(
    _: RcSystemEvent,
    api: RelayChainApi,
    blockHash: string,
    item: QueueItem
  ): Promise<void> {
    try {
      Log.service({
        service: 'UMP Queue Priority',
        action: 'AhUmpQueuePrioritySet event detected - re-querying config',
        details: { blockNumber: item.blockNumber },
      });

      const umpQueuePriority = await api.query.RcMigrator.AhUmpQueuePriorityConfig.getValue({ at: blockHash });
      await this.handleUmpQueuePriority(umpQueuePriority, item);
    } catch (error) {
      Log.service({
        service: 'UMP Queue Priority',
        action: 'Error handling UMP priority change event',
        error: error as Error,
      });
    }
  }

  private async handleDmpQueuePriorityChangedEvent(
    _: AhSystemEvent,
    api: AssetHubApi,
    blockHash: string,
    item: QueueItem
  ): Promise<void> {
    try {
      Log.service({
        service: 'DMP Queue Priority',
        action: 'DmpQueuePrioritySet event detected - re-querying config',
        details: { blockNumber: item.blockNumber },
      });

      const dmpQueuePriority = await api.query.AhMigrator.DmpQueuePriorityConfig.getValue({ at: blockHash });
      await this.handleDmpQueuePriority(dmpQueuePriority, item);
    } catch (error) {
      Log.service({
        service: 'DMP Queue Priority',
        action: 'Error handling DMP priority change event',
        error: error as Error,
      });
    }
  }

  private async handleRcBalanceMigration(
    balanceMigration: { kept: bigint; migrated: bigint },
    item: QueueItem
  ): Promise<void> {
    try {
      const kept = balanceMigration.kept.toString();
      const migrated = balanceMigration.migrated.toString();

      // Don't emit if migrated goes to 0 after previously being above 0 (migration completion reset)
      if (
        this.previousRcBalanceMigration &&
        this.previousRcBalanceMigration.migrated !== '0' &&
        migrated === '0'
      ) {
        Log.service({
          service: 'RC Balance Migration',
          action: 'Ignoring reset to zero (migration completed)',
          details: {
            previousMigrated: this.previousRcBalanceMigration.migrated,
          },
        });
        return;
      }

      // Only emit if values have changed
      if (
        !this.previousRcBalanceMigration ||
        this.previousRcBalanceMigration.kept !== kept ||
        this.previousRcBalanceMigration.migrated !== migrated
      ) {
        // Save to database - upsert both kept and migrated values
        const timestamp = new Date(item.timestamp!);

        // Delete existing entries for this chain and insert new ones
        await db.delete(balanceVerification)
          .where(eq(balanceVerification.chain, 'relay-chain'));

        await db.insert(balanceVerification)
          .values([
            {
              chain: 'relay-chain',
              balanceType: 'kept',
              balance: kept,
              lastUpdated: timestamp,
            },
            {
              chain: 'relay-chain',
              balanceType: 'migrated',
              balance: migrated,
              lastUpdated: timestamp,
            }
          ]);

        eventService.emit('rcBalanceMigration', {
          kept: kept.toString(),
          migrated: migrated.toString(),
          timestamp: timestamp.toISOString(),
        });

        Log.service({
          service: 'RC Balance Migration',
          action: 'Balance migration values updated',
          details: {
            kept: kept.toString(),
            migrated: migrated.toString(),
          },
        });

        // Update tracking variable
        this.previousRcBalanceMigration = { kept, migrated };
      }
    } catch (error) {
      Log.service({
        service: 'RC Balance Migration',
        action: 'Error processing RC balance migration',
        error: error as Error,
      });
    }
  }

  private async handleAhBalancesBefore(
    balancesBefore: { checking_account: bigint; total_issuance: bigint },
    item: QueueItem
  ): Promise<void> {
    try {
      const checkingAccountBalance = balancesBefore.checking_account.toString();
      const totalIssuanceBalance = balancesBefore.total_issuance.toString();

      if (balancesBefore.total_issuance > 0n) {
        this.ahPriorityConfigQueried = true;
      }

      // Save to database
      const timestamp = new Date(item.timestamp!);

      // Delete existing entries for this chain and insert new ones
      await db.delete(balanceVerification)
        .where(eq(balanceVerification.chain, 'asset-hub'));

      await db.insert(balanceVerification)
        .values([
          {
            chain: 'asset-hub',
            balanceType: 'checkingAccount',
            balance: checkingAccountBalance,
            lastUpdated: timestamp,
          },
          {
            chain: 'asset-hub',
            balanceType: 'totalIssuance',
            balance: totalIssuanceBalance,
            lastUpdated: timestamp,
          }
        ]);

      eventService.emit('ahBalancesBefore', {
        checkingAccount: checkingAccountBalance,
        totalIssuance: totalIssuanceBalance,
        timestamp: timestamp.toISOString(),
      });

      Log.service({
        service: 'AH Balances Before',
        action: 'Asset Hub balances before migration retrieved',
        details: {
          checkingAccount: checkingAccountBalance,
          totalIssuance: totalIssuanceBalance,
        },
      });
    } catch (error) {
      Log.service({
        service: 'AH Balances Before',
        action: 'Error processing AH balances before migration',
        error: error as Error,
      });
    }
  }

  /**
   * Perform an initial stage check on startup to see if migration is already scheduled/ongoing
   * This runs only once when processing the first Relay Chain block
   */
  private async performInitialStageCheck(
    api: RelayChainApi,
    blockHash: string,
    item: QueueItem
  ): Promise<void> {
    try {
      // Check if we already have stage data in the database
      const existingStage = await db.query.migrationStages.findFirst({
        where: eq(migrationStages.chain, 'relay-chain'),
      });

      // If we already have stage data, skip this check
      if (existingStage) {
        Log.service({
          service: 'Block Processor',
          action: 'Skipping initial stage check - stages already in DB',
          details: { existingStage: existingStage.stage },
        });
        this.initialStageCheckDone = true;
        return;
      }

      // Query the current migration stage
      const rcMigrationStage = await api.query.RcMigrator.RcMigrationStage.getValue({ at: blockHash });

      const stageType = rcMigrationStage.type;
      const isOngoing = stageType !== 'Pending' && stageType !== 'Scheduled';

      Log.service({
        service: 'Block Processor',
        action: 'Initial stage check performed',
        details: {
          stageType,
          isScheduled: stageType === 'Scheduled',
          isOngoing,
        },
      });

      // Store the stage in the database
      await this.handleRcMigrationStage(rcMigrationStage, item);

      // If migration is scheduled or ongoing, switch to FULL mode immediately
      if (stageType === 'Scheduled' || isOngoing) {

        this.currentMode = ProcessingMode.FULL;

        Log.service({
          service: 'Block Processor',
          action: 'Switching to FULL mode from initial check',
          details: {
            reason: stageType === 'Scheduled' ? 'Migration is scheduled' : 'Migration is ongoing',
            migrationBlockNumber: this.migrationStartBlockNumber,
            currentBlock: item.blockNumber,
          },
        });
      }

      this.initialStageCheckDone = true;
    } catch (error) {
      Log.service({
        service: 'Block Processor',
        action: 'Error in initial stage check',
        error: error as Error,
      });
      // Mark as done even on error to avoid retrying every block
      this.initialStageCheckDone = true;
    }
  }

  /**
   * Lightweight detection mode - only looks for migration scheduling events on Relay Chain
   */
  private async processRelayChainDetectionOnly(
    item: QueueItem,
    events: RcSystemEvents
  ): Promise<void> {
    Log.service({
      service: 'Block Processor',
      action: 'Processing Relay Chain block in detection mode',
      details: {
        blockNumber: item.blockNumber,
        eventsCount: events.length,
      },
    });

    try {
      // Look for migration scheduling events
      for (const record of events) {
        const { event } = record;

        // Look for rcMigrator.StageTransition events
        if (event.type === 'RcMigrator' && event.value.type === 'StageTransition') {
          const { old: fromState, new: toState } = event.value.value;

          // Extract stage name from toState
          const stageName = this.getStageNameFromState(toState);

          // Type guard for scheduled state
          const isScheduledState = (state: unknown): state is { scheduled: { start: string } } => {
            return !!state && typeof state === 'object' && !!(state as { scheduled?: { start?: unknown } }).scheduled?.start
          };

          // Extract scheduled block number if this is a scheduled state
          const scheduledBlockNumber = isScheduledState(toState)
            ? parseInt(toState.scheduled.start)
            : null;

          // Emit stage update event
          eventService.emit('rcStageUpdate', {
            stage: stageName,
            chain: 'relay-chain',
            details: toState,
            timestamp: new Date(item.timestamp!).toISOString(),
            palletName: getPalletFromStage(stageName),
            scheduledBlockNumber,
            palletInitStartedAt: null,
            timeInPallet: null,
            isNewStage: true,
            isPalletCompleted: false,
            palletTotalDuration: null,
            currentPalletStage: null,
          });

          Log.service({
            service: 'Block Processor',
            action: 'Stage transition detected - emitting rcStageUpdate',
            details: {
              stage: stageName,
              fromState,
              toState
            }
          });

          // Track in time cache and save to database if new stage
          const timeInStageCache = TimeInStageCache.getInstance();
          const isNewStage = await timeInStageCache.recordStageStart(stageName);

          if (isNewStage) {
            await db.insert(migrationStages).values({
              stage: stageName,
              chain: 'relay-chain',
              details: JSON.stringify(toState),
              scheduledBlockNumber: scheduledBlockNumber,
            });
          }

          // Check if transitioning TO scheduled state
          if (isScheduledState(toState)) {
            const scheduledBlock = parseInt(toState.scheduled.start);
            
            Log.service({
              service: 'Block Processor',
              action: 'Migration scheduled detected! Switching to full processing mode',
              details: { 
                scheduledBlock,
                currentBlock: item.blockNumber,
                blocksUntilMigration: scheduledBlock - item.blockNumber,
                fromState,
                toState
              }
            });
            
            // Set migration block number internally and persist to DB
            await this.setMigrationBlockNumber(scheduledBlock);
            
            return; // Found what we're looking for!
          }

          // Also check if transitioning from scheduled to an active migration stage
          if (isScheduledState(fromState) && !isScheduledState(toState)) {
            Log.service({
              service: 'Block Processor',
              action: 'Migration started detected! Ensuring full processing mode',
              details: { 
                currentBlock: item.blockNumber,
                fromState,
                toState
              }
            });
            
            // Ensure we're in full processing mode
            this.switchToFullMode();
            
            return;
          }
        }
      }
    } catch (error) {
      Log.service({
        service: 'Block Processor',
        action: 'Error in detection mode processing',
        error: error as Error,
        details: { blockNumber: item.blockNumber },
      });
    }
  }

  /**
   * Extract stage name from state object
   */
  private getStageNameFromState(state: unknown): string {
    if (!state || typeof state !== 'object') {
      return 'Unknown';
    }

    // State is an object with a single key representing the stage type
    const keys = Object.keys(state);
    if (keys.length === 0) {
      return 'Unknown';
    }

    // Convert first key to proper case format
    const key = keys[0];
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  /**
   * Switch to full processing mode
   */
  private switchToFullMode(): void {
    if (this.currentMode === ProcessingMode.FULL) {
      return; // Already in full mode
    }

    this.currentMode = ProcessingMode.FULL;

    Log.service({
      service: 'Block Processor',
      action: 'Switched to full processing mode',
      details: { previousMode: ProcessingMode.DETECTION }
    });
  }

  /**
   * Switch to detection mode (used after migration completes)
   * TODO: Implement migration completion detection to call this method
   * Look for rcMigrator.StageTransition events indicating migration is complete
   */
  private switchToDetectionMode(): void {
    if (this.currentMode === ProcessingMode.DETECTION) {
      return; // Already in detection mode
    }

    this.currentMode = ProcessingMode.DETECTION;

    Log.service({
      service: 'Block Processor',
      action: 'Switched to detection mode',
      details: { previousMode: ProcessingMode.FULL }
    });
  }

  /**
   * Switch to completed mode (migration is done - stop all processing)
   */
  private switchToCompletedMode(): void {
    if (this.currentMode === ProcessingMode.COMPLETED) {
      return; // Already in completed mode
    }

    const previousMode = this.currentMode;
    this.currentMode = ProcessingMode.COMPLETED;

    Log.service({
      service: 'Block Processor',
      action: '🎉 Migration COMPLETED - All processing stopped',
      details: {
        previousMode,
        message: 'Only FinalizedService will continue tracking block numbers'
      }
    });

    // Emit a special event for the frontend
    eventService.emit('migrationCompleted', {
      timestamp: new Date().toISOString(),
      message: 'Migration has completed successfully. Monitoring has stopped.',
    });
  }

  /**
   * Get current processing mode
   */
  public getCurrentMode(): ProcessingMode {
    return this.currentMode;
  }

  /**
   * Check if a migration stage indicates active migration
   */
  private isMigrationActive(stage: string): boolean {
    const inactiveStages = ['NotStarted', 'Scheduled', 'Complete', 'Pending', 'MigrationDone'];
    return !inactiveStages.includes(stage);
  }

  /**
   * Check if migration is completed
   */
  private isMigrationCompleted(stage: string): boolean {
    return stage === 'MigrationDone';
  }

  /**
   * Set migration start block number and persist scheduled stage to database
   */
  private async setMigrationBlockNumber(blockNumber: number): Promise<void> {
    this.migrationStartBlockNumber = blockNumber;
    
    try {
      // Check if a scheduled stage with this block number already exists
      const existingScheduled = await db.query.migrationStages.findFirst({
        where: and(
          eq(migrationStages.chain, 'relay-chain'),
          eq(migrationStages.stage, 'Scheduled'),
          eq(migrationStages.scheduledBlockNumber, blockNumber)
        ),
      });
      
      if (existingScheduled) {
        Log.service({
          service: 'Block Processor',
          action: 'Migration block number already exists in database, skipping insert',
          details: { blockNumber, existingId: existingScheduled.id }
        });
        return;
      }
      
      // Persist the scheduled migration stage to database
      await db.insert(migrationStages).values({
        stage: 'Scheduled',
        chain: 'relay-chain',
        details: JSON.stringify({ scheduled: { blockNumber } }),
        scheduledBlockNumber: blockNumber,
      });
      
      Log.service({
        service: 'Block Processor',
        action: 'Migration block number set and persisted to database',
        details: { blockNumber }
      });
    } catch (error) {
      Log.service({
        service: 'Block Processor',
        action: 'Error persisting migration block number to database',
        error: error as Error,
        details: { blockNumber }
      });
      
      // Still update internal state even if DB write fails
      Log.service({
        service: 'Block Processor',
        action: 'Migration block number set (DB write failed but internal state updated)',
        details: { blockNumber }
      });
    }
  }

  /**
   * Get migration status for monitoring
   */
  public getMigrationStatus() {
    return {
      migrationStartBlockNumber: this.migrationStartBlockNumber,
      currentMode: this.currentMode
    };
  }

  /**
   * Cleanup method for graceful shutdown
   */
  public async cleanup(): Promise<void> {
    Log.service({
      service: 'Block Processor',
      action: 'Starting cleanup',
    });

    // Clear all queues and reset state
    this.queue.get('relay-chain')!.length = 0;
    this.queue.get('asset-hub')!.length = 0;
    this.processing.set('relay-chain', false);
    this.processing.set('asset-hub', false);
    this.lastBlockNumber.set('relay-chain', 0);
    this.lastBlockNumber.set('asset-hub', 0);
    this.currentMode = ProcessingMode.DETECTION;
    this.migrationStartBlockNumber = undefined;

    Log.service({
      service: 'Block Processor',
      action: 'Cleanup completed',
    });
  }

  /**
   * Determine if we should do full processing for this block
   * Only process if:
   * 1. Migration has actually started, OR
   * 2. We're within 2 blocks of the scheduled time (relay chain only)
   */
  private shouldProcessBlock(blockNumber: number, chain: 'relay-chain' | 'asset-hub'): boolean {
    // 1. If we're within 2 blocks of scheduled time on relay chain, start processing
    const migrationBlock = this.migrationStartBlockNumber;
    if (migrationBlock && chain === 'relay-chain' && blockNumber >= (migrationBlock - 2)) {
      Log.service({
        service: 'Block Processor',
        action: 'Processing block - within 2 blocks of scheduled migration',
        details: { blockNumber, migrationBlock, blocksUntilMigration: migrationBlock - blockNumber }
      });
      return true;
    }
    
    // 2. For asset hub, follow relay chain's lead - process if RC is processing
    if (chain === 'asset-hub' && this.currentMode === ProcessingMode.FULL) {
      Log.service({
        service: 'Block Processor', 
        action: 'Processing Asset Hub block - following relay chain timing',
        details: { blockNumber, migrationBlock }
      });
      return true;
    }
    
    // Otherwise, skip heavy processing
    return false;
  }

  public getQueueStatus(): {
    'relay-chain': {
      length: number;
      processing: boolean;
      lastBlock: number;
      latestTimestamp?: number;
    };
    'asset-hub': {
      length: number;
      processing: boolean;
      lastBlock: number;
      latestTimestamp?: number;
    };
    processingMode: ProcessingMode;
  } {
    const getLatestTimestamp = (chain: string) => {
      const chainQueue = this.queue.get(chain)!;
      if (chainQueue.length === 0) return undefined;

      // Find the latest processed block with a timestamp
      const processedWithTimestamp = chainQueue
        .filter(item => item.processed && item.timestamp)
        .sort((a, b) => b.blockNumber - a.blockNumber);

      return processedWithTimestamp.length > 0 ? processedWithTimestamp[0].timestamp : undefined;
    };

    return {
      'relay-chain': {
        length: this.queue.get('relay-chain')!.length,
        processing: this.processing.get('relay-chain')!,
        lastBlock: this.lastBlockNumber.get('relay-chain')!,
        latestTimestamp: getLatestTimestamp('relay-chain'),
      },
      'asset-hub': {
        length: this.queue.get('asset-hub')!.length,
        processing: this.processing.get('asset-hub')!,
        lastBlock: this.lastBlockNumber.get('asset-hub')!,
        latestTimestamp: getLatestTimestamp('asset-hub'),
      },
      processingMode: this.currentMode,
    };
  }
}
