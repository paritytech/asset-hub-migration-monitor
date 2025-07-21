import type { VoidFn } from '@polkadot/api/types';

import { ApiPromise } from '@polkadot/api';

import { Log } from '../logging/Log';
import { AbstractApi } from '../services/abstractApi';
import { eventService } from '../services/eventService';

export class RuntimeManager {
  private static instance: RuntimeManager;
  private rcMigratorAvailable = false;
  private runtimeVersionUnsubscribe?: VoidFn;
  private pollInterval?: NodeJS.Timeout;
  private initializationPromise?: Promise<void>;

  private constructor() {}

  public static getInstance(): RuntimeManager {
    if (!RuntimeManager.instance) {
      RuntimeManager.instance = new RuntimeManager();
    }
    return RuntimeManager.instance;
  }

  public async initializeRuntimeDetection(): Promise<void> {
    // Prevent multiple initialization attempts
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    const api = await AbstractApi.getInstance().getRelayChainApi();

    Log.service({
      service: 'Runtime Manager',
      action: 'Starting runtime detection initialization',
    });

    // Initial check
    if (this.checkPalletAvailability(api)) {
      this.rcMigratorAvailable = true;
      this.notifyPalletAvailable();

      return;
    }

    Log.service({
      service: 'Runtime Manager',
      action: 'rcMigrator pallet not available yet, setting up detection',
    });

    // Subscribe to runtime upgrades
    try {
      this.runtimeVersionUnsubscribe = await api.rpc.state.subscribeRuntimeVersion(
        async version => {
          Log.service({
            service: 'Runtime Manager',
            action: 'Runtime version updated',
            details: { specVersion: version.specVersion.toNumber() },
          });

          if (!this.rcMigratorAvailable && this.checkPalletAvailability(api)) {
            this.rcMigratorAvailable = true;
            this.notifyPalletAvailable();
            this.cleanup();
          }
        }
      );

      Log.service({
        service: 'Runtime Manager',
        action: 'Successfully subscribed to runtime version updates',
      });
    } catch (error) {
      Log.service({
        service: 'Runtime Manager',
        action: 'Failed to subscribe to runtime version, falling back to polling',
        error: error as Error,
      });

      // Fallback to polling
      this.startPolling();
    }
  }

  private checkPalletAvailability(api: ApiPromise): boolean {
    try {
      return !!(api.query.rcMigrator && api.query.rcMigrator.rcMigrationStage);
    } catch (error) {
      // If there's an error accessing the pallet, it's not available
      return false;
    }
  }

  private notifyPalletAvailable(): void {
    Log.service({
      service: 'Runtime Manager',
      action: 'rcMigrator pallet is now available, notifying subscribers',
    });

    eventService.emit('rcMigratorAvailable', {
      timestamp: new Date().toISOString(),
    });
  }

  private async startPolling(): Promise<void> {
    let attempt = 0;
    const maxInitialAttempts = 50;

    const poll = async () => {
      if (this.rcMigratorAvailable) {
        return;
      }

      // After max initial attempts, switch to slower polling
      if (attempt >= maxInitialAttempts) {
        Log.service({
          service: 'Runtime Manager',
          action: 'Maximum initial polling attempts reached, switching to slow polling',
          details: { nextCheckIn: '1 minute' },
        });

        // Poll every minute indefinitely
        this.pollInterval = setTimeout(poll, 60 * 1000);
        return;
      }

      try {
        const api = await AbstractApi.getInstance().getRelayChainApi();

        if (this.checkPalletAvailability(api)) {
          this.rcMigratorAvailable = true;
          this.notifyPalletAvailable();
          this.cleanup();
          return;
        }

        attempt++;
        const delay = Math.min(5000 * Math.pow(1.5, attempt), 60000); // Max 1 minute

        Log.service({
          service: 'Runtime Manager',
          action: 'Polling for rcMigrator pallet',
          details: { attempt, nextCheckIn: `${delay}ms` },
        });

        this.pollInterval = setTimeout(poll, delay);
      } catch (error) {
        Log.service({
          service: 'Runtime Manager',
          action: 'Error during polling',
          error: error as Error,
        });

        attempt++;
        this.pollInterval = setTimeout(poll, 10000); // Retry in 10s on error
      }
    };

    Log.service({
      service: 'Runtime Manager',
      action: 'Starting polling for rcMigrator pallet',
    });

    poll();
  }

  private cleanup(): void {
    Log.service({
      service: 'Runtime Manager',
      action: 'Cleaning up runtime detection resources',
    });

    if (this.runtimeVersionUnsubscribe) {
      this.runtimeVersionUnsubscribe();
      this.runtimeVersionUnsubscribe = undefined;
    }

    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = undefined;
    }
  }

  public isRcMigratorAvailable(): boolean {
    return this.rcMigratorAvailable;
  }

  public async cleanupAsync(): Promise<void> {
    this.cleanup();
  }
}
