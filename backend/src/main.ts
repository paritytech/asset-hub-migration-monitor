import '@polkadot/api-augment';

import cors from 'cors';
import express, { Request, Response } from 'express';

import { getConfig } from './config';
import { initializeDb } from './db/initializeDb';
import { Log } from './logging/Log';
import { updatesHandler } from './routes/updates';
import { BlockProcessor } from './services/BlockProcessor';
import { FinalizedService } from './services/finalizedService';
import { MockFinalizedService } from './services/MockFinalizedService';

const app = express();
const port = getConfig().port;

// Initialize the database
initializeDb()
  .then(() => {
    Log.service({
      service: 'Database',
      action: 'Initialized successfully',
    });
  })
  .catch(err => {
    Log.service({
      service: 'Database',
      action: 'Initialization error',
      error: err as Error,
    });
  });

// Enable CORS
app.use(cors());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  const blockProcessor = BlockProcessor.getInstance();
  const testMode = process.env.TEST_MODE;
  const useMock = testMode !== undefined && testMode !== '';

  const finalizedService = useMock
    ? MockFinalizedService.getInstance()
    : FinalizedService.getInstance();

  res.json({
    status: 'ok',
    mode: useMock ? 'mock' : 'real',
    testMode: testMode || null,
    migrationStatus: blockProcessor.getMigrationStatus(),
    subscriptions: finalizedService.getStatus()
  });
});

// Queue status endpoint to monitor BlockProcessor queue growth
app.get('/api/queue-status', (_req: Request, res: Response) => {
  const blockProcessor = BlockProcessor.getInstance();
  const testMode = process.env.TEST_MODE;
  const useMock = testMode !== undefined && testMode !== '';

  const finalizedService = useMock
    ? MockFinalizedService.getInstance()
    : FinalizedService.getInstance();

  res.json({
    mode: useMock ? 'mock' : 'real',
    queues: blockProcessor.getQueueStatus(),
    subscriptions: finalizedService.getStatus(),
    timestamp: new Date().toISOString(),
  });
});

// Consolidated SSE endpoint
app.get('/api/updates', updatesHandler);

const main = async () => {
  const blockProcessor = BlockProcessor.getInstance();

  // Choose service based on TEST_MODE environment variable
  const testMode = process.env.TEST_MODE;
  const useMock = testMode !== undefined && testMode !== '';

  const finalizedService = useMock
    ? MockFinalizedService.getInstance()
    : FinalizedService.getInstance();

  Log.service({
    service: 'Application',
    action: 'Finalized service mode',
    details: {
      mode: useMock ? 'MOCK' : 'REAL',
      testMode: testMode || 'none'
    },
  });

  // Initialize BlockProcessor (includes DB state check)
  await blockProcessor.initialize();

  // Start finalized head subscriptions (this replaces all old subscriptions)
  await finalizedService.start();

  // Handle termination signals
  const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'] as const;
  signals.forEach(signal => {
    process.on(signal, async () => {
      Log.service({
        service: 'Application',
        action: 'Received termination signal, starting graceful shutdown',
        details: { signal },
      });

      await finalizedService.stop();
      await blockProcessor.cleanup();

      server.close(() => {
        Log.service({
          service: 'Application',
          action: 'Server closed, exiting',
        });
        process.exit(0);
      });

      // Force exit after 5 seconds if cleanup takes too long
      setTimeout(() => {
        Log.service({
          service: 'Application',
          action: 'Forced exit after timeout',
        });
        process.exit(1);
      }, 5000);
    });
  });

  const server = app.listen(port, () => {
    Log.service({
      service: 'Application',
      action: 'Server started',
      details: {
        port,
        assetHub: getConfig().assetHubUrl,
        relayChain: getConfig().relayChainUrl,
      },
    });
  });
};

try {
  main();
} catch (err) {
  console.error(err);
}
