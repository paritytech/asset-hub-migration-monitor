import type {
  PalletRcMigratorMigrationStage,
  PalletRcMigratorAccountsMigratedBalances,
} from '../types/pjs';
import type { u32, Vec } from '@polkadot/types';
import type { PolkadotCorePrimitivesInboundDownwardMessage } from '@polkadot/types/lookup';
import type { ITuple } from '@polkadot/types/types';

import { ApiPromise, WsProvider } from '@polkadot/api';
import { VoidFn } from '@polkadot/api/types';
import { eq, desc } from 'drizzle-orm';

import { getConfig } from '../config';
import { db } from '../db';
import {
  migrationStages,
  dmpQueueEvents,
  xcmMessageCounters,
  messageProcessingEventsRC,
} from '../db/schema';
import { Log } from '../logging/Log';
import { getPalletFromStage } from '../util/stageToPalletMapping';
import { SubscriptionManager } from '../util/SubscriptionManager';

import { AbstractApi } from './abstractApi';
import { DmpLatencyProcessor } from './cache/DmpLatencyProcessor';
import { TimeInStageCache } from './cache/TimeInStageCache';
import { UmpLatencyProcessor } from './cache/UmpLatencyProcessor';
import { eventService } from './eventService';

export async function runRcNewHeadsService() {
  const provider = new WsProvider(getConfig().relayChainUrl);
  const api = await ApiPromise.create({ provider });
  Log.connection({
    service: 'Relay Chain New Heads',
    status: 'connected',
  });

  const unsubscribe = await api.rpc.chain.subscribeNewHeads(header => {
    const blockNumber = header.number.toNumber();
    const blockHash = header.hash.toString();

    const subManager = SubscriptionManager.getInstance();

    if (
      !subManager.allSubsInitialized &&
      subManager.migrationStartBlockNumber &&
      subManager.migrationStartBlockNumber - blockNumber === 3 // Start 3 blocks early to ensure we don't miss any events.
    ) {
      subManager.initAllMigrationSubs();
    } else if (subManager.migrationStarted && !subManager.allSubsInitialized) {
      subManager.initAllMigrationSubs();
    }

    Log.chainEvent({
      chain: 'relay-chain',
      eventType: 'new head',
      blockNumber,
      blockHash,
      details: { timestamp: new Date().toISOString() },
    });

    // Emit the head event through eventService
    eventService.emit('rcHead', {
      blockNumber,
      blockHash,
      timestamp: new Date().toISOString(),
    });
  });

  return unsubscribe;
}

export async function runRcMigrationStageService(): Promise<VoidFn> {
  const api = await AbstractApi.getInstance().getRelayChainApi();
  const timeInStageCache = TimeInStageCache.getInstance();

  const unsubscribeMigrationStage = (await api.query.rcMigrator.rcMigrationStage(
    async (migrationStage: PalletRcMigratorMigrationStage) => {
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

        // Record stage start time if it's a new stage
        const isNewStage = await timeInStageCache.recordStageStart(currentStage);

        // Get pallet name for this stage
        const palletName = getPalletFromStage(currentStage);

        // Get current pallet info for the event
        const palletInfo = palletName ? timeInStageCache.getCurrentPalletInfo(palletName) : null;

        eventService.emit('rcStageUpdate', {
          stage: currentStage,
          chain: 'relay-chain',
          details: migrationStage.toJSON(),
          timestamp: new Date().toISOString(),
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
  )) as unknown as VoidFn;

  return unsubscribeMigrationStage;
}

async function updateXcmMessageCounters(sentToAh: number, processedOnAh: number) {
  try {
    // Update the RC->AH counter with processed messages
    await db
      .update(xcmMessageCounters)
      .set({
        messagesSent: sentToAh,
        lastUpdated: new Date(),
      })
      .where(eq(xcmMessageCounters.sourceChain, 'relay-chain'));

    await db
      .update(xcmMessageCounters)
      .set({
        messagesProcessed: processedOnAh,
        lastUpdated: new Date(),
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
    Log.service({
      service: 'XCM Message Counter',
      action: 'Error updating counters',
      error: error as Error,
    });
  }
}

export async function runRcXcmMessageCounterService() {
  const api = await AbstractApi.getInstance().getRelayChainApi();

  const unsubscribeXcmMessages = (await api.query.rcMigrator.dmpDataMessageCounts(
    async (messages: ITuple<[u32, u32]>) => {
      try {
        const [sentToAh, processedOnAh] = messages;
        await updateXcmMessageCounters(sentToAh.toNumber(), processedOnAh.toNumber());
      } catch (error) {
        Log.chainEvent({
          chain: 'relay-chain',
          eventType: 'XCM message processing error',
          error: error as Error,
        });
      }
    }
  )) as unknown as VoidFn;

  return unsubscribeXcmMessages;
}

export async function runRcDmpDataMessageCountsService() {
  const api = await AbstractApi.getInstance().getRelayChainApi();
  const dmpLatencyProcessor = DmpLatencyProcessor.getInstance();

  let previousQueueSize = 0;

  const unsubscribeDmpDataMessageCounts = (await api.query.dmp.downwardMessageQueues(
    1000,
    async (messages: Vec<PolkadotCorePrimitivesInboundDownwardMessage>) => {
      try {
        const currentQueueSize = messages.length;

        // Calculate exact total size in bytes by summing encoded lengths
        let totalSizeBytes = 0;
        for (const message of messages) {
          totalSizeBytes += message.msg.encodedLength;
        }

        // Determine event type based on size change
        let eventType = 'no_change';
        if (currentQueueSize > previousQueueSize) {
          eventType = 'fill';
        } else if (currentQueueSize < previousQueueSize) {
          eventType = currentQueueSize === 0 ? 'drain' : 'partial_drain';
        }

        // Only record if there's an actual change
        if (eventType !== 'no_change') {
          const timestamp = new Date();

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
              previousSize: previousQueueSize,
              change: currentQueueSize - previousQueueSize,
            },
          });
        }

        previousQueueSize = currentQueueSize;
      } catch (error) {
        Log.chainEvent({
          chain: 'relay-chain',
          eventType: 'DMP queue processing error',
          error: error as Error,
        });
      }
    }
  )) as unknown as VoidFn;

  return unsubscribeDmpDataMessageCounts;
}

export async function runRcMessageQueueProcessedService() {
  const api = await AbstractApi.getInstance().getRelayChainApi();
  const umpLatencyProcessor = UmpLatencyProcessor.getInstance();

  const unsubscribe = await api.query.system.events(async events => {
    for (const record of events) {
      const { event } = record;
      if (event.section === 'messageQueue' && event.method === 'Processed') {
        try {
          const timestamp = new Date();

          // Save to database
          await db.insert(messageProcessingEventsRC).values({
            timestamp,
          });

          // Add to latency processor
          umpLatencyProcessor.addMessageQueueProcessed(timestamp);

          Log.chainEvent({
            chain: 'relay-chain',
            eventType: 'MessageQueue.Processed',
            details: {
              eventData: event.toJSON(),
            },
          });
        } catch (error) {
          Log.chainEvent({
            chain: 'relay-chain',
            eventType: 'MessageQueue.Processed database error',
            error: error as Error,
          });
        }
      }
    }
  });

  return unsubscribe;
}
