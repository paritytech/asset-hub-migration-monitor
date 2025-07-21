import { Log } from '../../logging/Log';
import { eventService } from '../eventService';

import { DmpMetricsCache } from './DmpMetricsCache';

interface DmpEvent {
  timestamp: Date;
}

export class DmpLatencyProcessor {
  private static instance: DmpLatencyProcessor;
  private fillMessageStack: DmpEvent[] = [];
  private messageQueueStack: DmpEvent[] = [];
  private readonly maxStackSize = 10; // Keep last 10 events in each stack
  private readonly defaultLatencyMs = 200; // 0.2 seconds default for race conditions

  private constructor() {}

  public static getInstance(): DmpLatencyProcessor {
    if (!DmpLatencyProcessor.instance) {
      DmpLatencyProcessor.instance = new DmpLatencyProcessor();
    }
    return DmpLatencyProcessor.instance;
  }

  // Add fill message sent event
  public addFillMessageSent(timestamp: Date): void {
    this.fillMessageStack.push({ timestamp });
    // Keep only the last maxStackSize events
    if (this.fillMessageStack.length > this.maxStackSize) {
      this.fillMessageStack.shift();
    }

    // Clean up old fill events when new ones arrive
    this.cleanupOldFillEvents();

    // Try to process any pending message queue events
    this.processPendingEvents();
  }

  // Add message queue processed event
  public addMessageQueueProcessed(timestamp: Date): void {
    this.messageQueueStack.push({ timestamp });

    // Keep only the last maxStackSize events
    if (this.messageQueueStack.length > this.maxStackSize) {
      this.messageQueueStack.shift();
    }

    // Try to process any pending fill message events
    this.processPendingEvents();
  }

  private processPendingEvents(): void {
    // Wait until both stacks have at least 1 value
    if (this.fillMessageStack.length < 1 || this.messageQueueStack.length < 1) {
      return;
    }

    const firstFillEvent = this.fillMessageStack[0];
    const firstQueueEvent = this.messageQueueStack[0];

    // Calculate latency
    const latencyMs = firstQueueEvent.timestamp.getTime() - firstFillEvent.timestamp.getTime();

    // Handle negative latency (queue event happened before fill event)
    if (latencyMs < 0) {
      Log.service({
        service: 'DMP Latency Processor',
        action: 'Negative latency detected, clearing messageQueue stack',
        details: {
          latencyMs,
          fillEventTimestamp: firstFillEvent.timestamp.toISOString(),
          queueEventTimestamp: firstQueueEvent.timestamp.toISOString(),
        },
      });
      // Clear the messageQueue stack and wait for the next messageQueue processed event
      this.messageQueueStack.shift();
      return;
    } else {
      this.emitLatency(latencyMs, firstQueueEvent.timestamp);
    }

    // Remove the matched events
    this.fillMessageStack.shift();
    this.messageQueueStack.shift();
  }

  // Clean up old fill events when new ones arrive
  // This handles the case where multiple fills happen before any processing
  private cleanupOldFillEvents(): void {
    // If we have multiple fill events, keep only the latest one
    // This is because a single messageQueue processed event might consume multiple fill events
    if (this.fillMessageStack.length > 1) {
      const oldCount = this.fillMessageStack.length - 1;
      const latestFillEvent = this.fillMessageStack[this.fillMessageStack.length - 1];
      this.fillMessageStack = [latestFillEvent];

      Log.service({
        service: 'DMP Latency Processor',
        action: 'Cleaned up old fill events',
        details: {
          oldCount,
          latestTimestamp: latestFillEvent.timestamp.toISOString(),
        },
      });
    }
  }

  private emitLatency(latencyMs: number, timestamp: Date): void {
    const dmpMetricsCacheInstance = DmpMetricsCache.getInstance();
    dmpMetricsCacheInstance.updateAverageLatency(latencyMs);

    eventService.emit('dmpLatency', {
      latencyMs,
      averageLatencyMs: dmpMetricsCacheInstance.getAverageLatencyMs(),
      timestamp: timestamp.toISOString(),
    });
  }

  // Get current stack sizes for debugging
  public getStackSizes(): { fill: number; queue: number } {
    return {
      fill: this.fillMessageStack.length,
      queue: this.messageQueueStack.length,
    };
  }

  // Clear stacks (useful for testing or reset)
  public clearStacks(): void {
    this.fillMessageStack = [];
    this.messageQueueStack = [];
  }
}
