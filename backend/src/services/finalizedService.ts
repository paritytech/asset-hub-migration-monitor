import type { Header } from '@polkadot/types/interfaces';

import { VoidFn } from '@polkadot/api/types';

import { Log } from '../logging/Log';

import { AbstractApi } from './abstractApi';
import { BlockProcessor } from './BlockProcessor';

export class FinalizedService {
  private static instance: FinalizedService;
  private blockProcessor: BlockProcessor;
  private rcUnsubscribe: VoidFn | null = null;
  private ahUnsubscribe: VoidFn | null = null;

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
  public async start(): Promise<void> {
    Log.service({
      service: 'Finalized Service',
      action: 'Starting finalized head subscriptions',
    });

    try {
      await Promise.all([this.startRelayChainSubscription(), this.startAssetHubSubscription()]);

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
  private async startRelayChainSubscription(): Promise<void> {
    try {
      const api = await AbstractApi.getInstance().getRelayChainApi();

      this.rcUnsubscribe = await api.rpc.chain.subscribeFinalizedHeads((header: Header) => {
        const blockNumber = header.number.toNumber();
        const blockHash = header.hash.toHex();

        Log.chainEvent({
          chain: 'relay-chain',
          eventType: 'finalized_head',
          blockNumber,
          details: { blockHash },
        });

        // Submit to BlockProcessor
        this.blockProcessor.addBlock('relay-chain', blockNumber, blockHash);
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
  private async startAssetHubSubscription(): Promise<void> {
    try {
      const api = await AbstractApi.getInstance().getAssetHubApi();

      this.ahUnsubscribe = await api.rpc.chain.subscribeFinalizedHeads((header: Header) => {
        const blockNumber = header.number.toNumber();
        const blockHash = header.hash.toHex();

        Log.chainEvent({
          chain: 'asset-hub',
          eventType: 'finalized_head',
          blockNumber,
          details: { blockHash },
        });

        // Submit to BlockProcessor
        this.blockProcessor.addBlock('asset-hub', blockNumber, blockHash);
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
  public async stop(): Promise<void> {
    Log.service({
      service: 'Finalized Service',
      action: 'Stopping finalized head subscriptions',
    });

    try {
      // Unsubscribe from both chains
      if (this.rcUnsubscribe) {
        this.rcUnsubscribe();
        this.rcUnsubscribe = null;
      }

      if (this.ahUnsubscribe) {
        this.ahUnsubscribe();
        this.ahUnsubscribe = null;
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
      rcActive: this.rcUnsubscribe !== null,
      ahActive: this.ahUnsubscribe !== null,
    };
  }
}
