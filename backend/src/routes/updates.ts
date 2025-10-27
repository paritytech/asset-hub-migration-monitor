import { desc, eq, and } from 'drizzle-orm';
import { Request, Response, RequestHandler } from 'express';

import { db } from '../db';
import { migrationStages, xcmMessageCounters, balanceVerification, queuePriorityConfigs } from '../db/schema';
import { Log } from '../logging/Log';
import { PalletMigrationCache } from '../services/cache/PalletMigrationCache';
import { TimeInStageCache } from '../services/cache/TimeInStageCache';
import { eventService } from '../services/eventService';
import { getPalletFromStage } from '../util/stageToPalletMapping';

const { logger } = Log;

type EventType =
  | 'rcHead'
  | 'ahHead'
  | 'rcBalances'
  | 'rcXcmMessageCounter'
  | 'ahXcmMessageCounter'
  | 'rcStageUpdate'
  | 'ahStageUpdate'
  | 'dmpMetrics'
  | 'umpMetrics'
  | 'palletMigrationUpdate'
  | 'palletMigrationSummary'
  | 'dmpMessageCounter'
  | 'umpMessageCounter'
  | 'dmpQueueEvent'
  | 'umpQueueEvent'
  | 'dmpQueuePriority'
  | 'umpQueuePriority'
  | 'rcBalanceMigration'
  | 'ahBalancesBefore';

export const updatesHandler: RequestHandler = async (req: Request, res: Response) => {
  const requestedEvents = ((req.query.events as string) || '')
    .split(',')
    .filter(Boolean) as EventType[];

  if (requestedEvents.length === 0) {
    res.status(400).json({ error: 'No events specified. Please provide events query parameter.' });
    return;
  }

  logger.info('New SSE connection established for events:', requestedEvents);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // Send initial connection established event
  res.write(`event: connected\ndata: ${JSON.stringify({ connected: true })}\n\n`);

  // Map to store event handlers for cleanup
  const eventHandlers = new Map<EventType, (data: any) => void>();

  // Function to send SSE event
  const sendEvent = (eventType: EventType, data: any) => {
    try {
      res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      logger.error(`Error sending ${eventType} event:`, error);
    }
  };

  // Set up event handlers for each requested event type
  for (const eventType of requestedEvents) {
    const handler = (data: any) => sendEvent(eventType, data);
    eventHandlers.set(eventType, handler);
    eventService.on(eventType, handler);
  }

  // Send initial state for events that need it
  try {
    // Handle XCM counters initial state
    if (requestedEvents.includes('rcXcmMessageCounter')) {
      const rcCounter = await db.query.xcmMessageCounters.findFirst({
        where: eq(xcmMessageCounters.sourceChain, 'relay-chain'),
      });
      if (rcCounter) {
        sendEvent('rcXcmMessageCounter', {
          sourceChain: rcCounter.sourceChain,
          destinationChain: rcCounter.destinationChain,
          messagesProcessed: rcCounter.messagesProcessed,
          messagesFailed: rcCounter.messagesFailed,
          lastUpdated: rcCounter.lastUpdated,
        });
      }
    }

    if (requestedEvents.includes('ahXcmMessageCounter')) {
      const ahCounter = await db.query.xcmMessageCounters.findFirst({
        where: eq(xcmMessageCounters.sourceChain, 'asset-hub'),
      });
      if (ahCounter) {
        sendEvent('ahXcmMessageCounter', {
          sourceChain: ahCounter.sourceChain,
          destinationChain: ahCounter.destinationChain,
          messagesProcessed: ahCounter.messagesProcessed,
          messagesFailed: ahCounter.messagesFailed,
          lastUpdated: ahCounter.lastUpdated,
        });
      }
    }

    // Handle DMP message counter initial state
    if (requestedEvents.includes('dmpMessageCounter')) {
      const dmpCounter = await db.query.xcmMessageCounters.findFirst({
        where: eq(xcmMessageCounters.destinationChain, 'asset-hub'),
      });
      if (dmpCounter) {
        sendEvent('dmpMessageCounter', {
          sourceChain: dmpCounter.sourceChain,
          destinationChain: dmpCounter.destinationChain,
          messagesProcessed: dmpCounter.messagesProcessed,
          messagesFailed: dmpCounter.messagesFailed,
          lastUpdated: dmpCounter.lastUpdated,
        });
      }
    }

    // Handle UMP message counter initial state
    if (requestedEvents.includes('umpMessageCounter')) {
      const umpCounter = await db.query.xcmMessageCounters.findFirst({
        where: eq(xcmMessageCounters.destinationChain, 'relay-chain'),
      });
      if (umpCounter) {
        sendEvent('umpMessageCounter', {
          sourceChain: umpCounter.sourceChain,
          destinationChain: umpCounter.destinationChain,
          messagesProcessed: umpCounter.messagesProcessed,
          messagesFailed: umpCounter.messagesFailed,
          lastUpdated: umpCounter.lastUpdated,
        });
      }
    }

    // Handle migration stages initial state
    if (requestedEvents.includes('rcStageUpdate')) {
      const rcStage = await db.query.migrationStages.findFirst({
        where: eq(migrationStages.chain, 'relay-chain'),
        orderBy: [desc(migrationStages.timestamp)],
      });
      if (rcStage) {
        // Get pallet name for this stage
        const palletName = getPalletFromStage(rcStage.stage);

        // Get pallet timing information
        const timeInStageCache = TimeInStageCache.getInstance();
        const palletInfo = palletName ? timeInStageCache.getCurrentPalletInfo(palletName) : null;

        // Extract end_at from details if stage is WarmUp or CoolOff
        let warmUpEndBlock: number | null = null;
        let coolOffEndBlock: number | null = null;

        if (rcStage.details) {
          const details = JSON.parse(rcStage.details);
          // In PAPI, the migration stage is an Enum with .type and .value, and uses snake_case
          if (details.type === 'WarmUp' && details.value?.end_at) {
            warmUpEndBlock = details.value.end_at;
          }
          if (details.type === 'CoolOff' && details.value?.end_at) {
            coolOffEndBlock = details.value.end_at;
          }
        }

        sendEvent('rcStageUpdate', {
          stage: rcStage.stage,
          details: rcStage.details ? JSON.parse(rcStage.details) : null,
          timestamp: rcStage.timestamp,
          palletName: palletName || null,
          palletInitStartedAt: palletInfo?.initStartedAt || null,
          timeInPallet: palletInfo?.timeInPallet || null,
          scheduledBlockNumber: rcStage.scheduledBlockNumber || null,
          warmUpEndBlock,
          coolOffEndBlock,
          isNewStage: false, // This is initial state, so not a new stage
          isPalletCompleted: palletInfo?.isCompleted || false,
          palletTotalDuration: palletInfo?.totalDuration || null,
          currentPalletStage: palletInfo?.currentStage || null,
        });
      }
    }

    if (requestedEvents.includes('ahStageUpdate')) {
      const ahStage = await db.query.migrationStages.findFirst({
        where: eq(migrationStages.chain, 'asset-hub'),
        orderBy: [desc(migrationStages.timestamp)],
      });
      if (ahStage) {
        sendEvent('ahStageUpdate', {
          stage: ahStage.stage,
          details: ahStage.details ? JSON.parse(ahStage.details) : null,
          timestamp: ahStage.timestamp,
        });
      }
    }

    // Handle pallet migration summary initial state
    if (requestedEvents.includes('palletMigrationSummary')) {
      const palletMigrationCacheInstance = PalletMigrationCache.getInstance();
      const summary = palletMigrationCacheInstance.getSummary();
      sendEvent('palletMigrationSummary', {
        ...summary,
        timestamp: new Date().toISOString(),
      });
    }

    // Handle RC balance migration initial state
    if (requestedEvents.includes('rcBalanceMigration')) {
      const rcBalances = await db.query.balanceVerification.findMany({
        where: eq(balanceVerification.chain, 'relay-chain'),
      });

      if (rcBalances.length > 0) {
        const keptBalance = rcBalances.find(b => b.balanceType === 'kept');
        const migratedBalance = rcBalances.find(b => b.balanceType === 'migrated');

        if (keptBalance && migratedBalance) {
          sendEvent('rcBalanceMigration', {
            kept: keptBalance.balance,
            migrated: migratedBalance.balance,
            timestamp: keptBalance.lastUpdated.toISOString(),
          });
        }
      }
    }

    // Handle AH balances before initial state
    if (requestedEvents.includes('ahBalancesBefore')) {
      const ahBalances = await db.query.balanceVerification.findMany({
        where: eq(balanceVerification.chain, 'asset-hub'),
      });

      if (ahBalances.length > 0) {
        const checkingAccount = ahBalances.find(b => b.balanceType === 'checkingAccount');
        const totalIssuance = ahBalances.find(b => b.balanceType === 'totalIssuance');

        if (checkingAccount && totalIssuance) {
          sendEvent('ahBalancesBefore', {
            checkingAccount: checkingAccount.balance,
            totalIssuance: totalIssuance.balance,
            timestamp: checkingAccount.lastUpdated.toISOString(),
          });
        }
      }
    }

    // Handle UMP queue priority initial state
    if (requestedEvents.includes('umpQueuePriority')) {
      const umpPriority = await db.query.queuePriorityConfigs.findFirst({
        where: eq(queuePriorityConfigs.queueType, 'ump'),
      });
      if (umpPriority) {
        sendEvent('umpQueuePriority', {
          type: umpPriority.priorityType,
          timestamp: umpPriority.lastUpdated.toISOString(),
        });
      }
    }

    // Handle DMP queue priority initial state
    if (requestedEvents.includes('dmpQueuePriority')) {
      const dmpPriority = await db.query.queuePriorityConfigs.findFirst({
        where: eq(queuePriorityConfigs.queueType, 'dmp'),
      });
      if (dmpPriority) {
        sendEvent('dmpQueuePriority', {
          type: dmpPriority.priorityType,
          timestamp: dmpPriority.lastUpdated.toISOString(),
        });
      }
    }
  } catch (error) {
    logger.error('Error sending initial state:', error);
  }

  // Handle client disconnect
  req.on('close', () => {
    logger.info('SSE connection closed');
    // Clean up all event listeners
    for (const [eventType, handler] of eventHandlers.entries()) {
      eventService.off(eventType, handler);
    }
  });

  // Handle errors
  req.on('error', error => {
    // Check if this is a connection abort (normal when browser closes)
    if (error.message === 'aborted' || (error as any).code === 'ECONNRESET') {
      logger.info('SSE connection aborted (client disconnected)');
    } else {
      logger.error('SSE connection error:', error);
    }
    // Clean up all event listeners
    for (const [eventType, handler] of eventHandlers.entries()) {
      eventService.off(eventType, handler);
    }
    res.end();
  });
};
