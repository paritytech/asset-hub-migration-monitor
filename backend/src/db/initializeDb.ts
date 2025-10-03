import { Log } from '../logging/Log';
import { TimeInStageCache } from '../services/cache/TimeInStageCache';

import { xcmMessageCounters } from './schema';

import { db } from './index';

export async function initializeDb() {
  try {
    // Initialize XCM message counters for both chains
    const existingCounters = await db.query.xcmMessageCounters.findMany();
    Log.service({
      service: 'Database Initialization',
      action: 'Found existing counters',
      details: { count: existingCounters.length },
    });

    // Initialize RC counter if it doesn't exist
    if (!existingCounters.find(c => c.sourceChain === 'relay-chain')) {
      Log.service({
        service: 'Database Initialization',
        action: 'Initializing XCM message counter',
        details: { chain: 'relay-chain', destination: 'asset-hub' },
      });
      await db.insert(xcmMessageCounters).values({
        sourceChain: 'relay-chain',
        destinationChain: 'asset-hub',
        messagesProcessed: 0,
        messagesFailed: 0,
        lastUpdated: new Date(),
      });
    }

    // Initialize AH counter if it doesn't exist
    if (!existingCounters.find(c => c.sourceChain === 'asset-hub')) {
      Log.service({
        service: 'Database Initialization',
        action: 'Initializing XCM message counter',
        details: { chain: 'asset-hub', destination: 'relay-chain' },
      });
      await db.insert(xcmMessageCounters).values({
        sourceChain: 'asset-hub',
        destinationChain: 'relay-chain',
        messagesProcessed: 0,
        messagesFailed: 0,
        lastUpdated: new Date(),
      });
    }

    // Initialize TimeInStageCache
    Log.service({
      service: 'Database Initialization',
      action: 'Initializing TimeInStageCache',
    });
    const timeInStageCache = TimeInStageCache.getInstance();
    await timeInStageCache.initialize();

    Log.service({
      service: 'Database Initialization',
      action: 'Database initialization completed successfully',
    });
  } catch (error) {
    Log.service({
      service: 'Database Initialization',
      action: 'Database initialization error',
      error: error as Error,
    });
    throw error;
  }
}
