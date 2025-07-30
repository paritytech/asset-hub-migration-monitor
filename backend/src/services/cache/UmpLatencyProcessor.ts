import { eventService } from '../eventService';

import { UmpMetricsCache } from './UmpMetricsCache';

interface UmpEvent {
  timestamp: Date;
}

export class UmpLatencyProcessor {
  private static instance: UmpLatencyProcessor;
  private upwardMessageStack: UmpEvent[] = [];
  private messageQueueStack: UmpEvent[] = [];
  private readonly maxStackSize = 10; // Keep last 10 events in each stack
  private readonly defaultLatencyMs = 200; // 0.2 seconds default for race conditions

  private constructor() {}

  public static getInstance(): UmpLatencyProcessor {
    if (!UmpLatencyProcessor.instance) {
      UmpLatencyProcessor.instance = new UmpLatencyProcessor();
    }
    return UmpLatencyProcessor.instance;
  }

  // Add upward message sent event
  public addUpwardMessageSent(timestamp: Date): void {
    this.upwardMessageStack.push({ timestamp });
    // Keep only the last maxStackSize events
    if (this.upwardMessageStack.length > this.maxStackSize) {
      this.upwardMessageStack.shift();
    }

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

    // Try to process any pending upward message events
    this.processPendingEvents();
  }

  private processPendingEvents(): void {
    // Wait until both stacks have at least 2 values
    if (this.upwardMessageStack.length < 2 || this.messageQueueStack.length < 2) {
      return;
    }

    // Get the first upward event
    const firstUpwardEvent = this.upwardMessageStack[0];

    // Check if any message processed event has the same timestamp as the first upward event
    let matchedIndex = -1;
    for (let i = 0; i < this.messageQueueStack.length; i++) {
      if (this.messageQueueStack[i].timestamp.getTime() === firstUpwardEvent.timestamp.getTime()) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex !== -1) {
      // Found a timestamp match, calculate latency
      const matchedQueueEvent = this.messageQueueStack[matchedIndex];
      const latencyMs =
        matchedQueueEvent.timestamp.getTime() - firstUpwardEvent.timestamp.getTime();
      this.emitLatency(latencyMs, matchedQueueEvent.timestamp);

      // Remove the matched events
      this.upwardMessageStack.shift();
      this.messageQueueStack.splice(matchedIndex, 1);
    } else {
      // No exact timestamp match found, use default latency for the first queue event
      const firstQueueEvent = this.messageQueueStack[0];
      this.emitLatency(this.defaultLatencyMs, firstQueueEvent.timestamp);

      // Remove both the first queue event and the first upward message since no match was found
      this.messageQueueStack.shift();
      this.upwardMessageStack.shift();
    }
  }

  private emitLatency(latencyMs: number, timestamp: Date): void {
    const umpMetricsCacheInstance = UmpMetricsCache.getInstance();
    umpMetricsCacheInstance.updateAverageLatency(latencyMs);

    eventService.emit('umpLatency', {
      latencyMs,
      averageLatencyMs: umpMetricsCacheInstance.getAverageLatencyMs(),
      timestamp: timestamp.toISOString(),
    });
  }

  // Get current stack sizes for debugging
  public getStackSizes(): { upward: number; queue: number } {
    return {
      upward: this.upwardMessageStack.length,
      queue: this.messageQueueStack.length,
    };
  }

  // Clear stacks (useful for testing or reset)
  public clearStacks(): void {
    this.upwardMessageStack = [];
    this.messageQueueStack = [];
  }
}
