import type { Subscription } from 'rxjs';

import { Log } from '../logging/Log';

import { AbstractApi } from './abstractApi';
import { BlockProcessor } from './BlockProcessor';
import { eventService } from './eventService';

export class FinalizedService {
  private static instance: FinalizedService;
  private blockProcessor: BlockProcessor;
  private rcSubscription: Subscription | null = null;
  private ahSubscription: Subscription | null = null;

  private constructor() {
    this.blockProcessor = BlockProcessor.getInstance();
  }

  public static getInstance(): FinalizedService {
    if (!FinalizedService.instance) {
      FinalizedService.instance = new FinalizedService();
    }
    return FinalizedService.instance;
  }

  /**
   * Start both finalized head subscriptions
   */
  public start(): void {
    Log.service({
      service: 'Finalized Service',
      action: 'Starting finalized head subscriptions',
    });

    try {
      this.startRelayChainSubscription();
      this.startAssetHubSubscription();

      Log.service({
        service: 'Finalized Service',
        action: 'Both finalized head subscriptions started successfully',
      });
    } catch (error) {
      Log.service({
        service: 'Finalized Service',
        action: 'Failed to start finalized head subscriptions',
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Start Relay Chain finalized head subscription
   */
  private startRelayChainSubscription(): void {
    try {
      const client = AbstractApi.getInstance().getRelayChainClient();

      this.rcSubscription = client.finalizedBlock$.subscribe({
        next: (blockInfo) => {
          const blockNumber = blockInfo.number;
          const blockHash = blockInfo.hash;

          Log.chainEvent({
            chain: 'relay-chain',
            eventType: 'finalized_head',
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
        },
        error: (error) => {
          Log.service({
            service: 'Finalized Service',
            action: 'Relay Chain finalized head subscription error',
            error: error as Error,
          });
        },
      });

      Log.service({
        service: 'Finalized Service',
        action: 'Relay Chain finalized head subscription started',
      });
    } catch (error) {
      Log.service({
        service: 'Finalized Service',
        action: 'Failed to start Relay Chain finalized head subscription',
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Start Asset Hub finalized head subscription
   */
  private startAssetHubSubscription(): void {
    try {
      const client = AbstractApi.getInstance().getAssetHubClient();

      this.ahSubscription = client.finalizedBlock$.subscribe({
        next: (blockInfo) => {
          const blockNumber = blockInfo.number;
          const blockHash = blockInfo.hash;

          Log.chainEvent({
            chain: 'asset-hub',
            eventType: 'finalized_head',
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
        },
        error: (error) => {
          Log.service({
            service: 'Finalized Service',
            action: 'Asset Hub finalized head subscription error',
            error: error as Error,
          });
        },
      });

      Log.service({
        service: 'Finalized Service',
        action: 'Asset Hub finalized head subscription started',
      });
    } catch (error) {
      Log.service({
        service: 'Finalized Service',
        action: 'Failed to start Asset Hub finalized head subscription',
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Stop all subscriptions and cleanup
   */
  public stop(): void {
    Log.service({
      service: 'Finalized Service',
      action: 'Stopping finalized head subscriptions',
    });

    try {
      // Unsubscribe from both chains
      if (this.rcSubscription) {
        this.rcSubscription.unsubscribe();
        this.rcSubscription = null;
      }

      if (this.ahSubscription) {
        this.ahSubscription.unsubscribe();
        this.ahSubscription = null;
      }

      Log.service({
        service: 'Finalized Service',
        action: 'All finalized head subscriptions stopped',
      });
    } catch (error) {
      Log.service({
        service: 'Finalized Service',
        action: 'Error stopping finalized head subscriptions',
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Get status of subscriptions
   */
  public getStatus(): { rcActive: boolean; ahActive: boolean } {
    return {
      rcActive: this.rcSubscription !== null && !this.rcSubscription.closed,
      ahActive: this.ahSubscription !== null && !this.ahSubscription.closed,
    };
  }
}
