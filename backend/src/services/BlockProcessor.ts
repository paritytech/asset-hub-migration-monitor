import type { PalletRcMigratorMigrationStage } from '../types/pjs';
import type { ApiDecoration } from '@polkadot/api/types';
import type { u32, Vec, Bytes } from '@polkadot/types';
import type { Event } from '@polkadot/types/interfaces';
import type {
  FrameSystemEventRecord,
  PolkadotCorePrimitivesInboundDownwardMessage,
} from '@polkadot/types/lookup';
import type { ITuple } from '@polkadot/types/types';

import { eq, desc, and } from 'drizzle-orm';

import { db } from '../db';
import {
  messageProcessingEventsRC,
  migrationStages,
  palletMigrationCounters,
  messageProcessingEventsAH,
  upwardMessageSentEvents,
  xcmMessageCounters,
  dmpQueueEvents,
  umpQueueEvents,
} from '../db/schema';
import { Log } from '../logging/Log';
import { getCurrentStageForPallet, getPalletFromStage } from '../util/stageToPalletMapping';
import { SubscriptionManager } from '../util/SubscriptionManager';

import { AbstractApi } from './abstractApi';
import { DmpLatencyProcessor } from './cache/DmpLatencyProcessor';
import { PalletMigrationCache } from './cache/PalletMigrationCache';
import { TimeInStageCache } from './cache/TimeInStageCache';
import { UmpLatencyProcessor } from './cache/UmpLatencyProcessor';
import { eventService } from './eventService';

// TODO: Ensure we handle migration stages correctly.

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

  private constructor() {
    // Initialize queues for both chains
    this.queue.set('relay-chain', []);
    this.queue.set('asset-hub', []);
    this.processing.set('relay-chain', false);
    this.processing.set('asset-hub', false);
    // Initialize last block numbers to 0
    this.lastBlockNumber.set('relay-chain', 0);
    this.lastBlockNumber.set('asset-hub', 0);
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
      // Get the appropriate API instance
      const abstractApi = AbstractApi.getInstance();
      const api =
        item.chain === 'asset-hub'
          ? await abstractApi.getAssetHubApi()
          : await abstractApi.getRelayChainApi();

      let blockHash = item.blockHash;
      if (!blockHash) {
        blockHash = (await api.rpc.chain.getBlockHash(item.blockNumber)).toHex();
      }

      const apiAt = await api.at(blockHash);
      // Query the on-chain timestamp at this block
      const [timestampMoment, events] = await Promise.all([
        apiAt.query.timestamp.now(),
        apiAt.query.system.events(),
      ]);

      const timestamp = timestampMoment.toNumber(); // Convert from Moment to number (milliseconds)
      item.timestamp = timestamp;

      Log.service({
        service: 'Block Processor',
        action: 'Block timestamp retrieved',
        details: {
          chain: item.chain,
          blockNumber: item.blockNumber,
          timestamp,
          timestampDate: new Date(timestamp).toISOString(),
        },
      });

      // Delegate to chain-specific processing
      if (item.chain === 'asset-hub') {
        await this.processAssetHubBlock(item, apiAt, events);
      } else {
        await this.processRelayChainBlock(item, apiAt, events);
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
    apiAt: ApiDecoration<'promise'>,
    events: Vec<FrameSystemEventRecord>
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
      await this.processAssetHubStorage(apiAt, item);

      // Process Asset Hub specific events
      let foundMessageQueueProcessed = false;
      for (const record of events) {
        const { event } = record;

        // Handle ahMigrator.BatchProcessed events
        if (event.section === 'ahMigrator' && event.method === 'BatchProcessed') {
          await this.handleAssetHubBatchProcessed(event, item);
        }

        // Handle messageQueue.Processed events (DMP latency)
        if (event.section === 'messageQueue' && event.method === 'Processed') {
          // We only need to find the first messageQueue::Processed
          if (foundMessageQueueProcessed) {
            continue;
          } else {
            foundMessageQueueProcessed = true;
          }
          await this.handleAssetHubMessageQueueProcessed(event, item);
        }

        // Handle parachainSystem.UpwardMessageSent events (UMP)
        if (event.section === 'parachainSystem' && event.method === 'UpwardMessageSent') {
          await this.handleAssetHubUpwardMessageSent(event, item);
        }
      }
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
    apiAt: ApiDecoration<'promise'>,
    events: Vec<FrameSystemEventRecord>
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
      await this.processRelayChainStorage(apiAt, item);

      // Process Relay Chain specific events
      for (const record of events) {
        const { event } = record;

        // Handle messageQueue.Processed events (UMP latency)
        if (event.section === 'messageQueue' && event.method === 'Processed') {
          await this.handleRelayChainMessageQueueProcessed(event, item);
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
  private async handleAssetHubBatchProcessed(event: Event, item: QueueItem): Promise<void> {
    try {
      const palletName = event.data[0].toString(); // This is the pallet.
      const itemsProcessed = parseInt(event.data[1].toString()); // This is the items processed.
      const itemsFailed = parseInt(event.data[2].toString()); // This is the items failed.
      // Handle the special case where "Balances" pallet refers to "Accounts" stage
      const targetPallet = palletName === 'Balances' ? 'Accounts' : palletName;
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
        details: { eventData: event.toJSON() },
      });
    } catch (error) {
      Log.chainEvent({
        chain: 'asset-hub',
        eventType: 'BatchProcessed processing error',
        error: error as Error,
        details: {
          eventData: event.toJSON(),
        },
      });
    }
  }

  private async handleAssetHubMessageQueueProcessed(event: Event, item: QueueItem): Promise<void> {
    try {
      const dmpLatencyProcessor = DmpLatencyProcessor.getInstance();
      dmpLatencyProcessor.addMessageQueueProcessed(new Date(item.timestamp!));

      await db.insert(messageProcessingEventsAH).values({
        timestamp: new Date(),
      });
      Log.chainEvent({
        chain: 'asset-hub',
        eventType: 'MessageQueue.Processed',
        blockNumber: item.blockNumber,
        details: { eventData: event.toJSON() },
      });
    } catch (error) {
      Log.chainEvent({
        chain: 'asset-hub',
        eventType: 'MessageQueue.Processed database error',
        error: error as Error,
      });
    }
  }

  private async handleAssetHubUpwardMessageSent(event: Event, item: QueueItem): Promise<void> {
    try {
      // Add to latency processor
      const umpLatencyProcessor = UmpLatencyProcessor.getInstance();
      umpLatencyProcessor.addUpwardMessageSent(new Date(item.timestamp!));

      await db.insert(upwardMessageSentEvents).values({
        timestamp: new Date(item.timestamp!),
      });

      eventService.emit('upwardMessageSent', {
        timestamp: new Date(item.timestamp!).toISOString(),
      });
      Log.chainEvent({
        chain: 'asset-hub',
        eventType: 'UpwardMessageSent',
        blockNumber: item.blockNumber,
        details: { eventData: event.toJSON() },
      });
    } catch (error) {
      Log.chainEvent({
        chain: 'asset-hub',
        eventType: 'UpwardMessageSent database error',
        error: error as Error,
      });
    }
  }

  /**
   * Relay Chain event handlers
   */
  private async handleRelayChainMessageQueueProcessed(
    event: Event,
    item: QueueItem
  ): Promise<void> {
    try {
      const umpLatencyProcessor = UmpLatencyProcessor.getInstance();

      await db.insert(messageProcessingEventsRC).values({
        timestamp: new Date(item.timestamp!),
      });

      umpLatencyProcessor.addMessageQueueProcessed(new Date(item.timestamp!));

      Log.chainEvent({
        chain: 'relay-chain',
        eventType: 'MessageQueue.Processed',
        blockNumber: item.blockNumber,
        details: { eventData: event.toJSON() },
      });
    } catch (error) {
      Log.chainEvent({
        chain: 'relay-chain',
        eventType: 'MessageQueue.Processed database error',
        error: error as Error,
      });
    }
  }

  /**
   * Asset Hub storage queries
   */
  private async processAssetHubStorage(
    apiAt: ApiDecoration<'promise'>,
    item: QueueItem
  ): Promise<void> {
    try {
      const [dmpDataMessageCounts, pendingUpwardMessages] = await Promise.all([
        apiAt.query.ahMigrator.dmpDataMessageCounts<ITuple<[u32, u32]>>(),
        apiAt.query.parachainSystem.pendingUpwardMessages<Vec<Bytes>>(),
      ]);

      await this.handleAhDmpDataMessageCounts(dmpDataMessageCounts, item);
      await this.handleAhPendingUpwardMessages(pendingUpwardMessages, item);
      // TODO: Query Asset Hub specific storage:
      // - ahMigrator.ahMigrationStage (Do we actually need this?)

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
    apiAt: ApiDecoration<'promise'>,
    item: QueueItem
  ): Promise<void> {
    try {
      const [migrationStage, dmpMessageCount, dmpMessageQueue] = await Promise.all([
        apiAt.query.rcMigrator.rcMigrationStage<PalletRcMigratorMigrationStage>(),
        apiAt.query.rcMigrator.dmpDataMessageCounts<ITuple<[u32, u32]>>(),
        apiAt.query.dmp.downwardMessageQueues<Vec<PolkadotCorePrimitivesInboundDownwardMessage>>(
          1000
        ),
      ]);

      // TODO: Is there specific ordering to this or can we put it in a Promise.all?
      await this.handleRcMigrationStage(migrationStage, item);
      await this.handleRcDmpDataMessageCounts(dmpMessageCount, item);
      await this.handleRcDownwardMessageQueues(dmpMessageQueue, item);

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

  private async handleAhDmpDataMessageCounts(
    dmpDataMessageCounts: ITuple<[u32, u32]>,
    item: QueueItem
  ) {
    try {
      const [_, erroredOnAh] = dmpDataMessageCounts;
      await db
        .update(xcmMessageCounters)
        .set({
          messagesFailed: erroredOnAh.toNumber(),
          lastUpdated: new Date(item.timestamp!),
        })
        .where(eq(xcmMessageCounters.sourceChain, 'asset-hub'));

      const counterAh = await db.query.xcmMessageCounters.findFirst({
        where: (counters, { eq }) => eq(counters.sourceChain, 'asset-hub'),
      });

      if (counterAh) {
        const eventData = {
          sourceChain: counterAh.sourceChain,
          destinationChain: counterAh.destinationChain,
          messagesSent: counterAh.messagesSent,
          messagesProcessed: counterAh.messagesProcessed,
          messagesFailed: counterAh.messagesFailed,
          lastUpdated: counterAh.lastUpdated,
        };

        Log.service({
          service: 'XCM Message Counter',
          action: 'Emitting ahXcmMessageCounter event via storage',
          details: eventData,
        });
        eventService.emit('ahXcmMessageCounter', eventData);
      } else {
        Log.service({
          service: 'XCM Message Counter',
          action: 'No counter found after storage update',
          details: { sourceChain: 'asset-hub' },
        });
      }
    } catch (error) {
      Log.chainEvent({
        chain: 'asset-hub',
        eventType: 'XCM message processing error',
        error: error as Error,
      });
    }
  }

  private async handleAhPendingUpwardMessages(pendingUpwardMessages: Vec<Bytes>, item: QueueItem) {
    try {
      let totalSizeBytes = 0;
      for (const message of pendingUpwardMessages) {
        const messageSize = message.length;
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
    dmpMessageQueue: Vec<PolkadotCorePrimitivesInboundDownwardMessage>,
    item: QueueItem
  ) {
    const dmpLatencyProcessor = DmpLatencyProcessor.getInstance();
    try {
      const currentQueueSize = dmpMessageQueue.length;
      // Calculate exact total size in bytes by summing encoded lengths
      let totalSizeBytes = 0;
      for (const message of dmpMessageQueue) {
        totalSizeBytes += message.msg.encodedLength;
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

        // Add fill events to latency processor
        if (eventType === 'fill') {
          dmpLatencyProcessor.addFillMessageSent(timestamp);
        }

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

  private async handleRcDmpDataMessageCounts(dmpMessageCount: ITuple<[u32, u32]>, item: QueueItem) {
    try {
      const [sentToAh, processedOnAh] = dmpMessageCount;

      await db
        .update(xcmMessageCounters)
        .set({
          messagesSent: sentToAh.toNumber(),
          lastUpdated: new Date(item.timestamp!),
        })
        .where(eq(xcmMessageCounters.sourceChain, 'relay-chain'));

      await db
        .update(xcmMessageCounters)
        .set({
          messagesProcessed: processedOnAh.toNumber(),
          lastUpdated: new Date(item.timestamp!),
        })
        .where(eq(xcmMessageCounters.sourceChain, 'asset-hub'));

      // Get the updated counter
      const counterRc = await db.query.xcmMessageCounters.findFirst({
        where: (counters, { eq }) => eq(counters.sourceChain, 'relay-chain'),
      });

      // Get the updated counter
      const counterAh = await db.query.xcmMessageCounters.findFirst({
        where: (counters, { eq }) => eq(counters.sourceChain, 'asset-hub'),
      });

      if (counterRc) {
        const eventData = {
          sourceChain: counterRc.sourceChain,
          destinationChain: counterRc.destinationChain,
          messagesSent: counterRc.messagesSent,
          messagesProcessed: counterRc.messagesProcessed,
          messagesFailed: counterRc.messagesFailed,
          lastUpdated: counterRc.lastUpdated,
        };

        Log.service({
          service: 'XCM Message Counter',
          action: 'Emitting rcXcmMessageCounter event',
          details: eventData,
        });
        eventService.emit('rcXcmMessageCounter', eventData);
      } else {
        Log.service({
          service: 'XCM Message Counter',
          action: 'No RC counter found after update',
          details: { sourceChain: 'relay-chain' },
        });
      }

      if (counterAh) {
        const eventData = {
          sourceChain: counterAh.sourceChain,
          destinationChain: counterAh.destinationChain,
          messagesSent: counterAh.messagesSent,
          messagesProcessed: counterAh.messagesProcessed,
          messagesFailed: counterAh.messagesFailed,
          lastUpdated: counterAh.lastUpdated,
        };

        Log.service({
          service: 'XCM Message Counter',
          action: 'Emitting ahXcmMessageCounter event',
          details: eventData,
        });
        eventService.emit('ahXcmMessageCounter', eventData);
      } else {
        Log.service({
          service: 'XCM Message Counter',
          action: 'No AH counter found after update',
          details: { sourceChain: 'asset-hub' },
        });
      }

      Log.service({
        service: 'XCM Message Counter',
        action: 'Updated counters',
        details: { sentToAh, processedOnAh },
      });
    } catch (error) {
      Log.chainEvent({
        chain: 'relay-chain',
        eventType: 'XCM message processing error',
        error: error as Error,
      });
    }
  }

  private async handleRcMigrationStage(
    migrationStage: PalletRcMigratorMigrationStage,
    item: QueueItem
  ) {
    const timeInStageCache = TimeInStageCache.getInstance();

    try {
      const currentStage = migrationStage.type;

      await db.insert(migrationStages).values({
        stage: currentStage,
        chain: 'relay-chain',
        details: JSON.stringify(migrationStage.toJSON()),
        scheduledBlockNumber: migrationStage.isScheduled
          ? migrationStage.asScheduled.blockNumber.toNumber()
          : undefined,
      });

      if (migrationStage.isScheduled) {
        const subManager = SubscriptionManager.getInstance();
        subManager.setMigrationBlockNumber(migrationStage.asScheduled.blockNumber.toNumber());
      }

      const isNewStage = await timeInStageCache.recordStageStart(currentStage);
      const palletName = getPalletFromStage(currentStage);
      const palletInfo = palletName ? timeInStageCache.getCurrentPalletInfo(palletName) : null;

      eventService.emit('rcStageUpdate', {
        stage: currentStage,
        chain: 'relay-chain',
        details: migrationStage.toJSON(),
        timestamp: new Date(item.timestamp!).toISOString(),
        palletName: palletName || null,
        scheduledBlockNumber: migrationStage.isScheduled
          ? migrationStage.asScheduled.blockNumber.toNumber()
          : null,
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
          scheduledBlockNumber: migrationStage.isScheduled
            ? migrationStage.asScheduled.blockNumber.toNumber()
            : null,
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

  public getQueueStatus(): {
    [chain: string]: {
      length: number;
      processing: boolean;
      lastBlock: number;
      latestTimestamp?: number;
    };
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
    };
  }
}
