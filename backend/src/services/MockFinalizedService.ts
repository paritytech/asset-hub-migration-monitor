import { Log } from '../logging/Log';
import { AbstractApi } from './abstractApi';
import { BlockProcessor } from './BlockProcessor';
import { eventService } from './eventService';

// Start blocks for different test networks
const TEST_START_BLOCKS: Record<string, { relayChain: number; assetHub: number }> = {
  paseo: {
    relayChain: 7926842 - 5, 
    assetHub: 2593897 - 5,
  },
  kusama: {
    relayChain: 30423691 - 5, 
    assetHub: 11150168 - 5,
  }
};

export class MockFinalizedService {
  private static instance: MockFinalizedService;
  private blockProcessor: BlockProcessor;
  private rcIntervalId: NodeJS.Timeout | null = null;
  private ahIntervalId: NodeJS.Timeout | null = null;
  private rcCurrentBlock: number = 0;
  private ahCurrentBlock: number = 0;
  private readonly rcBlockInterval: number = 2000; // 6 seconds per block (Relay Chain)
  private readonly ahBlockInterval: number = 2200; // 12 seconds per block (Asset Hub)

  private constructor() {
    this.blockProcessor = BlockProcessor.getInstance();
  }

  public static getInstance(): MockFinalizedService {
    if (!MockFinalizedService.instance) {
      MockFinalizedService.instance = new MockFinalizedService();
    }
    return MockFinalizedService.instance;
  }

  /**
   * Start mock finalized head production
   */
  public async start(): Promise<void> {
    const testMode = process.env.TEST_MODE;

    if (!testMode) {
      throw new Error('TEST_MODE environment variable not set');
    }

    const startBlocks = TEST_START_BLOCKS[testMode];
    if (!startBlocks) {
      throw new Error(`Unknown TEST_MODE: ${testMode}. Available modes: ${Object.keys(TEST_START_BLOCKS).join(', ')}`);
    }

    this.rcCurrentBlock = startBlocks.relayChain;
    this.ahCurrentBlock = startBlocks.assetHub;

    Log.service({
      service: 'Mock Finalized Service',
      action: 'Starting mock finalized head production',
      details: {
        testMode,
        rcStartBlock: this.rcCurrentBlock,
        ahStartBlock: this.ahCurrentBlock,
        rcBlockInterval: `${this.rcBlockInterval}ms`,
        ahBlockInterval: `${this.ahBlockInterval}ms`,
      },
    });

    try {
      this.startRelayChainProduction();
      this.startAssetHubProduction();

      Log.service({
        service: 'Mock Finalized Service',
        action: 'Mock finalized head production started successfully',
      });
    } catch (error) {
      Log.service({
        service: 'Mock Finalized Service',
        action: 'Failed to start mock finalized head production',
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Start Relay Chain mock block production
   */
  private startRelayChainProduction(): void {
    const abstractApi = AbstractApi.getInstance();
    const client = abstractApi.getRelayChainClient();

    this.rcIntervalId = setInterval(async () => {
      const blockNumber = this.rcCurrentBlock;

      try {
        // Query actual block hash from the node using RPC
        const blockHash = await client._request<string, [number]>('chain_getBlockHash', [blockNumber]);

        Log.chainEvent({
          chain: 'relay-chain',
          eventType: 'finalized_head (mock)',
          blockNumber,
          details: { blockHash },
        });

        // Emit to frontend
        eventService.emit('rcHead', {
          blockNumber,
          blockHash,
          timestamp: new Date().toISOString(),
        });

        // Submit to BlockProcessor
        this.blockProcessor.addBlock('relay-chain', blockNumber, blockHash);

        this.rcCurrentBlock++;
      } catch (error) {
        Log.chainEvent({
          chain: 'relay-chain',
          eventType: 'mock block hash query error',
          blockNumber,
          error: error as Error,
        });
      }
    }, this.rcBlockInterval);

    Log.service({
      service: 'Mock Finalized Service',
      action: 'Relay Chain mock block production started',
      details: { startBlock: this.rcCurrentBlock },
    });
  }

  /**
   * Start Asset Hub mock block production
   */
  private startAssetHubProduction(): void {
    const abstractApi = AbstractApi.getInstance();
    const client = abstractApi.getAssetHubClient();

    this.ahIntervalId = setInterval(async () => {
      const blockNumber = this.ahCurrentBlock;

      try {
        // Query actual block hash from the node using RPC
        const blockHash = await client._request<string, [number]>('chain_getBlockHash', [blockNumber]);

        Log.chainEvent({
          chain: 'asset-hub',
          eventType: 'finalized_head (mock)',
          blockNumber,
          details: { blockHash },
        });

        // Emit to frontend
        eventService.emit('ahHead', {
          blockNumber,
          blockHash,
          timestamp: new Date().toISOString(),
        });

        // Submit to BlockProcessor
        this.blockProcessor.addBlock('asset-hub', blockNumber, blockHash);

        this.ahCurrentBlock++;
      } catch (error) {
        Log.chainEvent({
          chain: 'asset-hub',
          eventType: 'mock block hash query error',
          blockNumber,
          error: error as Error,
        });
      }
    }, this.ahBlockInterval);

    Log.service({
      service: 'Mock Finalized Service',
      action: 'Asset Hub mock block production started',
      details: { startBlock: this.ahCurrentBlock },
    });
  }

  /**
   * Stop all mock block production and cleanup
   */
  public async stop(): Promise<void> {
    Log.service({
      service: 'Mock Finalized Service',
      action: 'Stopping mock finalized head production',
    });

    try {
      if (this.rcIntervalId) {
        clearInterval(this.rcIntervalId);
        this.rcIntervalId = null;
      }

      if (this.ahIntervalId) {
        clearInterval(this.ahIntervalId);
        this.ahIntervalId = null;
      }

      Log.service({
        service: 'Mock Finalized Service',
        action: 'Mock finalized head production stopped',
        details: {
          finalRcBlock: this.rcCurrentBlock - 1,
          finalAhBlock: this.ahCurrentBlock - 1,
        },
      });
    } catch (error) {
      Log.service({
        service: 'Mock Finalized Service',
        action: 'Error stopping mock finalized head production',
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Get status of mock production
   */
  public getStatus(): { rcActive: boolean; ahActive: boolean; rcCurrentBlock: number; ahCurrentBlock: number } {
    return {
      rcActive: this.rcIntervalId !== null,
      ahActive: this.ahIntervalId !== null,
      rcCurrentBlock: this.rcCurrentBlock,
      ahCurrentBlock: this.ahCurrentBlock,
    };
  }

  /**
   * Manually advance to a specific block (for testing specific scenarios)
   */
  public jumpToBlock(chain: 'relay-chain' | 'asset-hub', blockNumber: number): void {
    if (chain === 'relay-chain') {
      this.rcCurrentBlock = blockNumber;
      Log.service({
        service: 'Mock Finalized Service',
        action: 'Jumped Relay Chain to block',
        details: { blockNumber },
      });
    } else {
      this.ahCurrentBlock = blockNumber;
      Log.service({
        service: 'Mock Finalized Service',
        action: 'Jumped Asset Hub to block',
        details: { blockNumber },
      });
    }
  }
}
