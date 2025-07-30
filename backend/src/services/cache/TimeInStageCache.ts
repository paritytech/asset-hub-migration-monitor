import { eq } from 'drizzle-orm';

import { db } from '../../db';
import { stageStartTimes, type NewStageStartTime } from '../../db/schema';
import { Log } from '../../logging/Log';
import { getPalletFromStage, isInitStage, isDoneStage } from '../../util/stageToPalletMapping';

interface PalletTimeInfo {
  palletName: string;
  initStage: string;
  initStartedAt: Date | null;
  doneStage: string | null;
  doneEndedAt: Date | null;
  currentStage: string;
}

export class TimeInStageCache {
  private static instance: TimeInStageCache;
  private palletTiming: Map<string, PalletTimeInfo> = new Map(); // key: palletName
  private stageStartTimes: Map<string, Date> = new Map(); // key: stageName

  private constructor() {}

  public static getInstance(): TimeInStageCache {
    if (!TimeInStageCache.instance) {
      TimeInStageCache.instance = new TimeInStageCache();
    }
    return TimeInStageCache.instance;
  }

  // Initialize cache from database
  public async initialize(): Promise<void> {
    try {
      const startTimes = await db.select().from(stageStartTimes);

      for (const startTime of startTimes) {
        this.stageStartTimes.set(startTime.stage, startTime.startedAt);
      }

      // Build pallet timing from stage data
      this.buildPalletTimingFromStages();

      Log.service({
        service: 'TimeInStageCache',
        action: 'Initialized successfully',
        details: { stageCount: this.stageStartTimes.size, palletCount: this.palletTiming.size },
      });
    } catch (error) {
      Log.service({
        service: 'TimeInStageCache',
        action: 'Initialization error',
        error: error as Error,
      });
    }
  }

  // Build pallet timing information from stage data
  private buildPalletTimingFromStages(): void {
    this.palletTiming.clear();

    // Group stages by pallet
    const palletStages = new Map<string, { stage: string; startedAt: Date }[]>();

    for (const [stage, startedAt] of this.stageStartTimes.entries()) {
      const palletName = getPalletFromStage(stage);
      if (!palletName) continue;

      if (!palletStages.has(palletName)) {
        palletStages.set(palletName, []);
      }
      palletStages.get(palletName)!.push({ stage, startedAt });
    }

    // Build pallet timing for each pallet
    for (const [palletName, stages] of palletStages.entries()) {
      const initStage = stages.find(s => isInitStage(s.stage));
      const doneStage = stages.find(s => isDoneStage(s.stage));
      const currentStage = stages[stages.length - 1]?.stage || ''; // Latest stage

      this.palletTiming.set(palletName, {
        palletName,
        initStage: initStage?.stage || '',
        initStartedAt: initStage?.startedAt || null,
        doneStage: doneStage?.stage || null,
        doneEndedAt: doneStage?.startedAt || null, // Use startedAt as endedAt for Done stages
        currentStage,
      });
    }
  }

  // Record a new stage start time
  public async recordStageStart(stage: string): Promise<boolean> {
    try {
      // Check if stage already exists in cache
      if (this.stageStartTimes.has(stage)) {
        return false; // Stage already recorded
      }

      const timestamp = new Date();

      // Insert into database
      await db.insert(stageStartTimes).values({
        stage,
        startedAt: timestamp,
      });

      // Update cache
      this.stageStartTimes.set(stage, timestamp);

      // Update pallet timing
      this.updatePalletTiming(stage, timestamp);

      Log.service({
        service: 'TimeInStageCache',
        action: 'Recorded stage start time',
        details: { stage, timestamp: timestamp.toISOString() },
      });
      return true;
    } catch (error) {
      Log.service({
        service: 'TimeInStageCache',
        action: 'Error recording stage start',
        details: { stage },
        error: error as Error,
      });
      return false;
    }
  }

  // Update pallet timing when a new stage is recorded
  private updatePalletTiming(stage: string, startedAt: Date): void {
    const palletName = getPalletFromStage(stage);
    if (!palletName) return;

    const existing = this.palletTiming.get(palletName);

    if (isInitStage(stage)) {
      // This is the Init stage for the pallet
      this.palletTiming.set(palletName, {
        palletName,
        initStage: stage,
        initStartedAt: startedAt,
        doneStage: existing?.doneStage || null,
        doneEndedAt: existing?.doneEndedAt || null,
        currentStage: stage,
      });
    } else if (isDoneStage(stage)) {
      // This is the Done stage for the pallet
      this.palletTiming.set(palletName, {
        palletName,
        initStage: existing?.initStage || '',
        initStartedAt: existing?.initStartedAt || null,
        doneStage: stage,
        doneEndedAt: startedAt, // Use startedAt as endedAt for Done stages
        currentStage: stage,
      });
    } else {
      // This is an Ongoing stage, update current stage
      if (existing) {
        this.palletTiming.set(palletName, {
          ...existing,
          currentStage: stage,
        });
      }
    }
  }

  // Get pallet timing info
  public getPalletTiming(palletName: string): PalletTimeInfo | null {
    return this.palletTiming.get(palletName) || null;
  }

  // Calculate time in pallet migration (returns milliseconds) - for active pallets
  public getTimeInPallet(palletName: string): number | null {
    const palletInfo = this.palletTiming.get(palletName);
    if (!palletInfo || !palletInfo.initStartedAt || palletInfo.doneEndedAt) {
      return null; // Pallet doesn't exist, hasn't started, or is completed
    }

    return Date.now() - palletInfo.initStartedAt.getTime();
  }

  // Calculate total duration of a pallet migration (returns milliseconds) - for completed pallets
  public getPalletDuration(palletName: string): number | null {
    const palletInfo = this.palletTiming.get(palletName);
    if (!palletInfo || !palletInfo.initStartedAt || !palletInfo.doneEndedAt) {
      return null; // Pallet doesn't exist, hasn't started, or is not completed
    }

    return palletInfo.doneEndedAt.getTime() - palletInfo.initStartedAt.getTime();
  }

  // Get formatted time in pallet (e.g., "2h 15m 30s") - for active pallets
  public getFormattedTimeInPallet(palletName: string): string | null {
    const timeInMs = this.getTimeInPallet(palletName);
    if (timeInMs === null) {
      return null;
    }

    return this.formatDuration(timeInMs);
  }

  // Get formatted pallet duration (e.g., "2h 15m 30s") - for completed pallets
  public getFormattedPalletDuration(palletName: string): string | null {
    const timeInMs = this.getPalletDuration(palletName);
    if (timeInMs === null) {
      return null;
    }

    return this.formatDuration(timeInMs);
  }

  // Helper method to format duration
  private formatDuration(timeInMs: number): string {
    const hours = Math.floor(timeInMs / (1000 * 60 * 60));
    const minutes = Math.floor((timeInMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeInMs % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Get current pallet info for frontend
  public getCurrentPalletInfo(palletName: string): {
    initStartedAt: string | null;
    timeInPallet: number | null;
    isCompleted: boolean;
    totalDuration: number | null;
    currentStage: string;
  } | null {
    const palletInfo = this.palletTiming.get(palletName);
    if (!palletInfo) {
      return null;
    }

    const isCompleted = palletInfo.doneEndedAt !== null;
    const timeInPallet = isCompleted
      ? null
      : palletInfo.initStartedAt
        ? Date.now() - palletInfo.initStartedAt.getTime()
        : null;
    const totalDuration =
      isCompleted && palletInfo.initStartedAt && palletInfo.doneEndedAt
        ? palletInfo.doneEndedAt.getTime() - palletInfo.initStartedAt.getTime()
        : null;

    return {
      initStartedAt: palletInfo.initStartedAt?.toISOString() || null,
      timeInPallet,
      isCompleted,
      totalDuration,
      currentStage: palletInfo.currentStage,
    };
  }

  // Get all active pallets (not completed)
  public getActivePallets(): string[] {
    return Array.from(this.palletTiming.entries())
      .filter(
        ([_, palletInfo]) => palletInfo.doneEndedAt === null && palletInfo.initStartedAt !== null
      )
      .map(([palletName, _]) => palletName);
  }

  // Get all completed pallets
  public getCompletedPallets(): string[] {
    return Array.from(this.palletTiming.entries())
      .filter(([_, palletInfo]) => palletInfo.doneEndedAt !== null)
      .map(([palletName, _]) => palletName);
  }

  // Get all pallets that have started (Init stage recorded)
  public getStartedPallets(): string[] {
    return Array.from(this.palletTiming.entries())
      .filter(([_, palletInfo]) => palletInfo.initStartedAt !== null)
      .map(([palletName, _]) => palletName);
  }

  // Clear cache (useful for testing)
  public clearCache(): void {
    this.palletTiming.clear();
    this.stageStartTimes.clear();
  }
}
