import { Log } from '../../logging/Log';
import { eventService } from '../eventService';

interface PalletMigrationData {
  palletName: string;
  totalItemsProcessed: number;
  totalItemsFailed: number;
  lastUpdated: Date;
}

export class PalletMigrationCache {
  private static instance: PalletMigrationCache;
  private palletData: Map<string, PalletMigrationData> = new Map();

  private constructor() {}

  public static getInstance(): PalletMigrationCache {
    if (!PalletMigrationCache.instance) {
      PalletMigrationCache.instance = new PalletMigrationCache();
    }
    return PalletMigrationCache.instance;
  }

  public addBatchData(palletName: string, itemsProcessed: number, itemsFailed: number): void {
    const existing = this.palletData.get(palletName);

    if (existing) {
      // Update existing data
      existing.totalItemsProcessed += itemsProcessed;
      existing.totalItemsFailed += itemsFailed;
      existing.lastUpdated = new Date();
    } else {
      // Create new data
      this.palletData.set(palletName, {
        palletName,
        totalItemsProcessed: itemsProcessed,
        totalItemsFailed: itemsFailed,
        lastUpdated: new Date(),
      });
    }
  }

  public emitEvents(): void {
    if (this.palletData.size === 0) return;

    // Convert map to array for emission
    const palletDataArray = Array.from(this.palletData.values());

    // Emit individual pallet data
    palletDataArray.forEach(data => {
      eventService.emit('palletMigrationUpdate', {
        palletName: data.palletName,
        totalItemsProcessed: data.totalItemsProcessed,
        totalItemsFailed: data.totalItemsFailed,
        lastUpdated: data.lastUpdated.toISOString(),
      });
    });

    // Emit summary data
    const summary = {
      totalPallets: palletDataArray.length,
      totalItemsProcessed: palletDataArray.reduce((sum, data) => sum + data.totalItemsProcessed, 0),
      totalItemsFailed: palletDataArray.reduce((sum, data) => sum + data.totalItemsFailed, 0),
      pallets: palletDataArray.map(data => ({
        palletName: data.palletName,
        totalItemsProcessed: data.totalItemsProcessed,
        totalItemsFailed: data.totalItemsFailed,
        lastUpdated: data.lastUpdated.toISOString(),
      })),
      timestamp: new Date().toISOString(),
    };

    eventService.emit('palletMigrationSummary', summary);

    Log.service({
      service: 'Pallet Migration Cache',
      action: 'Emitted pallet migration data',
      details: {
        palletsCount: palletDataArray.length,
        totalProcessed: summary.totalItemsProcessed,
        totalFailed: summary.totalItemsFailed,
      },
    });
  }

  public getPalletData(palletName: string): PalletMigrationData | null {
    return this.palletData.get(palletName) || null;
  }

  public getAllPalletData(): PalletMigrationData[] {
    return Array.from(this.palletData.values());
  }

  public clearPalletData(palletName: string): void {
    this.palletData.delete(palletName);
  }

  public clearAllData(): void {
    this.palletData.clear();
  }

  public getSummary(): {
    totalPallets: number;
    totalItemsProcessed: number;
    totalItemsFailed: number;
    pallets: Array<{
      palletName: string;
      totalItemsProcessed: number;
      totalItemsFailed: number;
      lastUpdated: string;
    }>;
  } {
    const palletDataArray = Array.from(this.palletData.values());

    return {
      totalPallets: palletDataArray.length,
      totalItemsProcessed: palletDataArray.reduce((sum, data) => sum + data.totalItemsProcessed, 0),
      totalItemsFailed: palletDataArray.reduce((sum, data) => sum + data.totalItemsFailed, 0),
      pallets: palletDataArray.map(data => ({
        palletName: data.palletName,
        totalItemsProcessed: data.totalItemsProcessed,
        totalItemsFailed: data.totalItemsFailed,
        lastUpdated: data.lastUpdated.toISOString(),
      })),
    };
  }
}
