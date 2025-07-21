import type { Bytes, u32, Vec } from '@polkadot/types';
import type { Block } from '@polkadot/types/interfaces';
import type { ITuple } from '@polkadot/types/types';

import { ApiPromise, WsProvider } from '@polkadot/api';
import { VoidFn } from '@polkadot/api/types';
import { eq, desc, and } from 'drizzle-orm';

import { getConfig } from '../config';
import { db } from '../db';
import {
  xcmMessageCounters,
  migrationStages,
  messageProcessingEventsAH,
  umpQueueEvents,
  upwardMessageSentEvents,
  palletMigrationCounters,
} from '../db/schema';
import { Log } from '../logging/Log';
import { getCurrentStageForPallet } from '../util/stageToPalletMapping';

import { AbstractApi } from './abstractApi';
import { DmpLatencyProcessor } from './cache/DmpLatencyProcessor';
import { PalletMigrationCache } from './cache/PalletMigrationCache';
import { UmpLatencyProcessor } from './cache/UmpLatencyProcessor';
import { eventService } from './eventService';

const dmpLatencyProcessor = DmpLatencyProcessor.getInstance();

export async function runAhMigrationStageService() {
  const api = await AbstractApi.getInstance().getAssetHubApi();

  const unsubscribeMigrationStage = (await api.query.ahMigrator.ahMigrationStage(
    async (migrationStage: any) => {
      try {
        await db.insert(migrationStages).values({
          chain: 'asset-hub',
          stage: migrationStage.type,
          details: JSON.stringify(migrationStage.toJSON()),
        });

        eventService.emit('ahStageUpdate', {
          chain: 'asset-hub',
          stage: migrationStage.type,
          details: migrationStage.toJSON(),
          timestamp: new Date().toISOString(),
        });

        Log.chainEvent({
          chain: 'asset-hub',
          eventType: 'migration stage update',
          details: { stage: migrationStage.type },
        });
      } catch (error) {
        Log.chainEvent({
          chain: 'asset-hub',
          eventType: 'migration stage processing error',
          error: error as Error,
        });
      }
    }
  )) as unknown as VoidFn;

  return unsubscribeMigrationStage;
}

async function updateXcmMessageCountersViaStorage(erroredOnAh: number) {
  try {
    await db
      .update(xcmMessageCounters)
      .set({
        messagesFailed: erroredOnAh,
        lastUpdated: new Date(),
      })
      .where(eq(xcmMessageCounters.sourceChain, 'asset-hub'));

    // Get the updated counter
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
    Log.service({
      service: 'XCM Message Counter',
      action: 'Error updating counters via storage',
      error: error as Error,
    });
  }
}

export async function runAhXcmMessageCounterService() {
  const api = await AbstractApi.getInstance().getAssetHubApi();

  const unsubscribeXcmMessages = (await api.query.ahMigrator.dmpDataMessageCounts(
    async (messages: ITuple<[u32, u32]>) => {
      try {
        const [_, erroredOnAh] = messages;
        await updateXcmMessageCountersViaStorage(erroredOnAh.toNumber());
      } catch (error) {
        Log.chainEvent({
          chain: 'asset-hub',
          eventType: 'XCM message processing error',
          error: error as Error,
        });
      }
    }
  )) as unknown as VoidFn;

  return unsubscribeXcmMessages;
}

export async function runAhNewHeadsService() {
  const provider = new WsProvider(getConfig().assetHubUrl);
  const api = await ApiPromise.create({ provider });
  Log.connection({
    service: 'Asset Hub New Heads',
    status: 'connected',
  });

  const unsubscribe = await api.rpc.chain.subscribeNewHeads(header => {
    const blockNumber = header.number.toNumber();
    const blockHash = header.hash.toString();

    Log.chainEvent({
      chain: 'asset-hub',
      eventType: 'new head',
      blockNumber,
      blockHash,
      details: { timestamp: new Date().toISOString() },
    });

    // Emit the head event through eventService
    eventService.emit('ahHead', {
      blockNumber,
      blockHash,
      timestamp: new Date().toISOString(),
    });
  });

  return unsubscribe;
}

export async function runAhEventsService() {
  const api = await AbstractApi.getInstance().getAssetHubApi();
  const lastProcessedBlock = 0; // Track the last block we processed

  const unsubscribe = await api.query.system.events(async events => {
    let foundMessageQueueProcessed = false;
    for (const record of events) {
      const { event } = record;
      if (event.section === 'messageQueue' && event.method === 'Processed') {
        try {
          if (foundMessageQueueProcessed) {
            continue;
          } else {
            foundMessageQueueProcessed = true;
          }

          // Add to DMP latency processor
          const timestamp = new Date();
          dmpLatencyProcessor.addMessageQueueProcessed(timestamp);

          await db.insert(messageProcessingEventsAH).values({
            timestamp: new Date(),
          });

          Log.chainEvent({
            chain: 'asset-hub',
            eventType: 'MessageQueue.Processed',
            details: {
              eventData: event.toJSON(),
            },
          });
        } catch (error) {
          Log.chainEvent({
            chain: 'asset-hub',
            eventType: 'MessageQueue.Processed database error',
            error: error as Error,
          });
        }
      }

      if (event.section === 'parachainSystem' && event.method === 'UpwardMessageSent') {
        try {
          const timestamp = new Date();

          await db.insert(upwardMessageSentEvents).values({
            timestamp,
          });

          // Add to latency processor
          const umpLatencyProcessor = UmpLatencyProcessor.getInstance();
          umpLatencyProcessor.addUpwardMessageSent(timestamp);

          eventService.emit('upwardMessageSent', {
            timestamp: timestamp.toISOString(),
          });

          Log.chainEvent({
            chain: 'asset-hub',
            eventType: 'UpwardMessageSent',
            details: {
              eventData: event.toJSON(),
            },
          });
        } catch (error) {
          Log.chainEvent({
            chain: 'asset-hub',
            eventType: 'UpwardMessageSent database error',
            error: error as Error,
          });
        }
      }

      if (event.section === 'ahMigrator' && event.method === 'BatchProcessed') {
        // Batch processed data goes like this:
        // [Pallet, items processed, items failed]
        try {
          const palletName = event.data[0].toString(); // This is the pallet.
          const itemsProcessed = parseInt(event.data[1].toString()); // This is the items processed.
          const itemsFailed = parseInt(event.data[2].toString()); // This is the items failed.

          // Handle the special case where "Balances" pallet refers to "Accounts" stage
          const targetPallet = palletName === 'Balances' ? 'Accounts' : palletName;

          // Get the current stage for this pallet

          const currentStageName = getCurrentStageForPallet(targetPallet);

          if (!currentStageName) {
            Log.chainEvent({
              chain: 'asset-hub',
              eventType: 'BatchProcessed - unknown pallet',
              details: { palletName, targetPallet },
            });
            continue;
          }

          // Get the current stage record from the database
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
            continue;
          }

          // Check if we already have a counter for this pallet and stage
          const existingCounter = await db.query.palletMigrationCounters.findFirst({
            where: and(
              eq(palletMigrationCounters.palletName, targetPallet),
              eq(palletMigrationCounters.stageId, currentStage.id)
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
    }

    // Emit pallet migration events after processing all events in this block
    const palletMigrationCache = PalletMigrationCache.getInstance();
    palletMigrationCache.emitEvents();
  });

  return unsubscribe;
}

export async function runAhUmpPendingMessagesService() {
  const api = await AbstractApi.getInstance().getAssetHubApi();

  const unsubscribe = (await api.query.parachainSystem.pendingUpwardMessages(
    async (messages: Vec<Bytes>) => {
      try {
        let totalSizeBytes = 0;
        for (const message of messages) {
          const messageSize = message.length;
          totalSizeBytes += messageSize;
        }

        await db.insert(umpQueueEvents).values({
          queueSize: messages.length,
          totalSizeBytes,
          timestamp: new Date(),
        });

        eventService.emit('umpQueueEvent', {
          queueSize: messages.length,
          totalSizeBytes,
          timestamp: new Date().toISOString(),
        });

        Log.service({
          service: 'Asset Hub UMP',
          action: 'UMP queue event recorded',
          details: { queueSize: messages.length, totalSizeBytes },
        });
      } catch (error) {
        Log.service({
          service: 'Asset Hub UMP',
          action: 'Error processing UMP pending messages',
          error: error as Error,
        });
      }
    }
  )) as unknown as VoidFn;

  return unsubscribe;
}
