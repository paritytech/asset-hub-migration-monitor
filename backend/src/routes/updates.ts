import { desc, eq } from 'drizzle-orm';
import { Request, Response, RequestHandler } from 'express';

import { db } from '../db';
import { migrationStages, xcmMessageCounters } from '../db/schema';
import { Log } from '../logging/Log';
import { DmpMetricsCache } from '../services/cache/DmpMetricsCache';
import { PalletMigrationCache } from '../services/cache/PalletMigrationCache';
import { TimeInStageCache } from '../services/cache/TimeInStageCache';
import { UmpMetricsCache } from '../services/cache/UmpMetricsCache';
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
  | 'palletMigrationSummary';

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
          messagesSent: rcCounter.messagesSent,
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
          messagesSent: ahCounter.messagesSent,
          messagesProcessed: ahCounter.messagesProcessed,
          messagesFailed: ahCounter.messagesFailed,
          lastUpdated: ahCounter.lastUpdated,
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

        sendEvent('rcStageUpdate', {
          stage: rcStage.stage,
          details: rcStage.details ? JSON.parse(rcStage.details) : null,
          timestamp: rcStage.timestamp,
          palletName: palletName || null,
          palletInitStartedAt: palletInfo?.initStartedAt || null,
          timeInPallet: palletInfo?.timeInPallet || null,
          scheduledBlockNumber: rcStage.scheduledBlockNumber || null,
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

    // Handle DMP metrics initial state
    if (requestedEvents.includes('dmpMetrics')) {
      const dmpMetricsCacheInstance = DmpMetricsCache.getInstance();
      const currentMetrics = dmpMetricsCacheInstance.getMetrics();
      sendEvent('dmpMetrics', {
        averageLatencyMs: currentMetrics.averageLatencyMs,
        totalSizeBytes: currentMetrics.totalSizeBytes,
        lastUpdated: currentMetrics.lastUpdated,
        latencyCount: currentMetrics.latencyCount,
        sizeCount: currentMetrics.sizeCount,
        timestamp: new Date().toISOString(),
      });
    }

    // Handle UMP metrics initial state
    if (requestedEvents.includes('umpMetrics')) {
      const umpMetricsCacheInstance = UmpMetricsCache.getInstance();
      const currentMetrics = umpMetricsCacheInstance.getMetrics();
      sendEvent('umpMetrics', {
        averageLatencyMs: currentMetrics.averageLatencyMs,
        totalSizeBytes: currentMetrics.totalSizeBytes,
        lastUpdated: currentMetrics.lastUpdated,
        latencyCount: currentMetrics.latencyCount,
        sizeCount: currentMetrics.sizeCount,
        timestamp: new Date().toISOString(),
      });
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
