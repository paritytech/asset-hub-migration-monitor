import { Log } from '../logging/Log';

interface QueueItem {
  blockNumber: number;
  blockHash: string;
  chain: 'relay-chain' | 'asset-hub';
  processed: boolean;
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
          blockHash: '', // Will need to be fetched later
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

    // TODO: Implement actual block processing logic
    // - Fetch block events
    // - Check for migration-related events
    // - Update database
    // - Emit events for frontend
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  public getQueueStatus(): { [chain: string]: { length: number, processing: boolean, lastBlock: number } } {
    return {
      'relay-chain': {
        length: this.queue.get('relay-chain')!.length,
        processing: this.processing.get('relay-chain')!,
        lastBlock: this.lastBlockNumber.get('relay-chain')!
      },
      'asset-hub': {
        length: this.queue.get('asset-hub')!.length,
        processing: this.processing.get('asset-hub')!,
        lastBlock: this.lastBlockNumber.get('asset-hub')!
      }
    };
  }
}