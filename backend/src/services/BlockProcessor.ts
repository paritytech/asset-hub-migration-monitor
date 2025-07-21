import { Vec } from '@polkadot/types';
import { FrameSystemEventRecord } from '@polkadot/types/lookup';
import { Event } from '@polkadot/types/interfaces';

import { db } from '../db';
import { Log } from '../logging/Log';
import { AbstractApi } from './abstractApi';
import { UmpLatencyProcessor } from './cache/UmpLatencyProcessor';
import { messageProcessingEventsRC } from '../db/schema';

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

  public addBlock(chain: 'relay-chain' | 'asset-hub', blockNumber: number, blockHash: string): void {
    const chainQueue = this.queue.get(chain)!;
    const lastBlock = this.lastBlockNumber.get(chain)!;
    
    // Check if block already exists
    const exists = chainQueue.some(item => item.blockNumber === blockNumber);
    if (exists) {
      Log.service({
        service: 'Block Processor',
        action: 'Block already in queue',
        details: { chain, blockNumber }
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
          gap: blockNumber - lastBlock - 1 
        }
      });

      // Add all missing blocks to queue
      for (let missingBlock = lastBlock + 1; missingBlock < blockNumber; missingBlock++) {
        chainQueue.push({
          blockNumber: missingBlock,
          blockHash: null,
          chain,
          processed: false
        });
      }
    }

    // Add the new block to queue
    chainQueue.push({
      blockNumber,
      blockHash,
      chain,
      processed: false
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
        lastBlock: this.lastBlockNumber.get(chain)
      }
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
        details: { chain }
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
            remaining: chainQueue.length - 1
          }
        });
        
        chainQueue.shift(); // Remove processed item
      } catch (error) {
        Log.service({
          service: 'Block Processor',
          action: 'Block processing failed',
          error: error as Error,
          details: { chain: item.chain, blockNumber: item.blockNumber }
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
        blockHash: item.blockHash
      }
    });

    try {
      // Get the appropriate API instance
      const abstractApi = AbstractApi.getInstance();
      const api = item.chain === 'asset-hub' 
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
        apiAt.query.system.events()
      ])

      const timestamp = timestampMoment.toNumber(); // Convert from Moment to number (milliseconds)
      item.timestamp = timestamp;

      Log.service({
        service: 'Block Processor',
        action: 'Block timestamp retrieved',
        details: { 
          chain: item.chain, 
          blockNumber: item.blockNumber,
          timestamp,
          timestampDate: new Date(timestamp).toISOString()
        }
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
          blockHash: item.blockHash
        }
      });
      // Continue processing even if timestamp query fails
    }
  }

  /**
   * Process Asset Hub specific block data
   */
  private async processAssetHubBlock(item: QueueItem, apiAt: any, events: Vec<FrameSystemEventRecord>): Promise<void> {
    Log.service({
      service: 'Block Processor',
      action: 'Processing Asset Hub block',
      details: { 
        blockNumber: item.blockNumber,
        eventsCount: events.length
      }
    });

    try {
      // Process Asset Hub specific events
      for (const record of events) {
        const { event } = record;
        
        // Handle ahMigrator.BatchProcessed events
        if (event.section === 'ahMigrator' && event.method === 'BatchProcessed') {
          await this.handleAssetHubBatchProcessed(event, item);
        }
        
        // Handle messageQueue.Processed events (DMP latency)
        if (event.section === 'messageQueue' && event.method === 'Processed') {
          await this.handleAssetHubMessageQueueProcessed(event, item);
        }
        
        // Handle parachainSystem.UpwardMessageSent events (UMP)
        if (event.section === 'parachainSystem' && event.method === 'UpwardMessageSent') {
          await this.handleAssetHubUpwardMessageSent(event, item);
        }
      }

      // Query Asset Hub specific storage
      await this.processAssetHubStorage(apiAt, item);

    } catch (error) {
      Log.service({
        service: 'Block Processor',
        action: 'Error processing Asset Hub block',
        error: error as Error,
        details: { blockNumber: item.blockNumber }
      });
    }
  }

  /**
   * Process Relay Chain specific block data
   */
  private async processRelayChainBlock(item: QueueItem, apiAt: any, events: Vec<FrameSystemEventRecord>): Promise<void> {
    Log.service({
      service: 'Block Processor',
      action: 'Processing Relay Chain block',
      details: { 
        blockNumber: item.blockNumber,
        eventsCount: events.length
      }
    });

    try {
      // Process Relay Chain specific events
      for (const record of events) {
        const { event } = record;
        
        // Handle messageQueue.Processed events (UMP latency)
        if (event.section === 'messageQueue' && event.method === 'Processed') {
          await this.handleRelayChainMessageQueueProcessed(event, item);
        }
      }

      // Query Relay Chain specific storage
      await this.processRelayChainStorage(apiAt, item);

    } catch (error) {
      Log.service({
        service: 'Block Processor',
        action: 'Error processing Relay Chain block',
        error: error as Error,
        details: { blockNumber: item.blockNumber }
      });
    }
  }

  /**
   * Asset Hub event handlers
   */
  private async handleAssetHubBatchProcessed(event: any, item: QueueItem): Promise<void> {
    Log.chainEvent({
      chain: 'asset-hub',
      eventType: 'BatchProcessed',
      blockNumber: item.blockNumber,
      details: { eventData: event.toJSON() }
    });
    // TODO: Implement batch processing logic from ahService
  }

  private async handleAssetHubMessageQueueProcessed(event: any, item: QueueItem): Promise<void> {
    Log.chainEvent({
      chain: 'asset-hub',
      eventType: 'MessageQueue.Processed',
      blockNumber: item.blockNumber,
      details: { eventData: event.toJSON() }
    });
    // TODO: Implement DMP latency tracking
  }

  private async handleAssetHubUpwardMessageSent(event: any, item: QueueItem): Promise<void> {
    Log.chainEvent({
      chain: 'asset-hub',
      eventType: 'UpwardMessageSent',
      blockNumber: item.blockNumber,
      details: { eventData: event.toJSON() }
    });
    // TODO: Implement UMP tracking
  }

  /**
   * Relay Chain event handlers
   */
  private async handleRelayChainMessageQueueProcessed(event: Event, item: QueueItem): Promise<void> {
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
        details: { eventData: event.toJSON() }
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
  private async processAssetHubStorage(apiAt: any, item: QueueItem): Promise<void> {
    try {
      // TODO: Query Asset Hub specific storage:
      // - ahMigrator.ahMigrationStage
      // - ahMigrator.dmpDataMessageCounts
      // - parachainSystem.pendingUpwardMessages
      
      Log.service({
        service: 'Block Processor',
        action: 'Asset Hub storage queries completed',
        details: { blockNumber: item.blockNumber }
      });
    } catch (error) {
      Log.service({
        service: 'Block Processor',
        action: 'Error querying Asset Hub storage',
        error: error as Error,
        details: { blockNumber: item.blockNumber }
      });
    }
  }

  /**
   * Relay Chain storage queries
   */
  private async processRelayChainStorage(apiAt: any, item: QueueItem): Promise<void> {
    try {
      // TODO: Query Relay Chain specific storage:
      // - rcMigrator.rcMigrationStage
      // - rcMigrator.dmpDataMessageCounts
      // - dmp.downwardMessageQueues
      
      Log.service({
        service: 'Block Processor',
        action: 'Relay Chain storage queries completed',
        details: { blockNumber: item.blockNumber }
      });
    } catch (error) {
      Log.service({
        service: 'Block Processor',
        action: 'Error querying Relay Chain storage',
        error: error as Error,
        details: { blockNumber: item.blockNumber }
      });
    }
  }

  public getQueueStatus(): { [chain: string]: { length: number, processing: boolean, lastBlock: number, latestTimestamp?: number } } {
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
        latestTimestamp: getLatestTimestamp('relay-chain')
      },
      'asset-hub': {
        length: this.queue.get('asset-hub')!.length,
        processing: this.processing.get('asset-hub')!,
        lastBlock: this.lastBlockNumber.get('asset-hub')!,
        latestTimestamp: getLatestTimestamp('asset-hub')
      }
    };
  }
}