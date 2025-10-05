import React, { useState, useCallback } from 'react';
import { useEventSource } from '../hooks/useEventSource';
import type { EventType } from '../hooks/useEventSource';
import './XcmMessageMetrics.css';

interface XcmCounter {
  sourceChain: string;
  destinationChain: string;
  messagesProcessed: number;
  messagesFailed: number;
  lastUpdated: string;
}

interface QueueEvent {
  queueSize: number;
  totalSizeBytes: number;
  eventType?: string;
  timestamp: string;
}

interface PriorityConfig {
  type: string;
  timestamp: string;
}

const XcmMessageMetrics: React.FC = () => {
  const [dmpCounter, setDmpCounter] = useState<XcmCounter | null>(null);
  const [umpCounter, setUmpCounter] = useState<XcmCounter | null>(null);
  const [dmpQueueEvent, setDmpQueueEvent] = useState<QueueEvent | null>(null);
  const [umpQueueEvent, setUmpQueueEvent] = useState<QueueEvent | null>(null);
  const [dmpPriority, setDmpPriority] = useState<PriorityConfig | null>(null);
  const [umpPriority, setUmpPriority] = useState<PriorityConfig | null>(null);

  // Subscribe to DMP message counter events (Relay → Asset Hub)
  useEventSource(['dmpMessageCounter'], useCallback((eventType: EventType, data: XcmCounter) => {
    if (eventType === 'dmpMessageCounter') {
      setDmpCounter(data);
    }
  }, []));

  // Subscribe to UMP message counter events (Asset Hub → Relay)
  useEventSource(['umpMessageCounter'], useCallback((eventType: EventType, data: XcmCounter) => {
    if (eventType === 'umpMessageCounter') {
      setUmpCounter(data);
    }
  }, []));

  // Subscribe to DMP queue events
  useEventSource(['dmpQueueEvent'], useCallback((eventType: EventType, data: QueueEvent) => {
    if (eventType === 'dmpQueueEvent') {
      setDmpQueueEvent(data);
    }
  }, []));

  // Subscribe to UMP queue events
  useEventSource(['umpQueueEvent'], useCallback((eventType: EventType, data: QueueEvent) => {
    if (eventType === 'umpQueueEvent') {
      setUmpQueueEvent(data);
    }
  }, []));

  // Subscribe to DMP queue priority events
  useEventSource(['dmpQueuePriority'], useCallback((eventType: EventType, data: PriorityConfig) => {
    if (eventType === 'dmpQueuePriority') {
      setDmpPriority(data);
    }
  }, []));

  // Subscribe to UMP queue priority events
  useEventSource(['umpQueuePriority'], useCallback((eventType: EventType, data: PriorityConfig) => {
    if (eventType === 'umpQueuePriority') {
      setUmpPriority(data);
    }
  }, []));

  // Format bytes for display
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  // Format queue size display
  const formatQueueSize = (size: number): string => {
    if (size === 0) return '0 messages';
    if (size === 1) return '1 message';
    return `${size.toLocaleString()} messages`;
  };

  // Format priority display
  const formatPriority = (config: PriorityConfig | null) => {
    if (!config) {
      return { text: 'Loading...', className: 'priority-unknown' };
    }

    switch (config.type) {
      case 'Config':
        return { text: 'Default Config', className: 'priority-default' };
      case 'OverrideConfig':
        return { text: 'Override', className: 'priority-override' };
      case 'Disabled':
        return { text: 'Disabled', className: 'priority-disabled' };
      default:
        return { text: config.type, className: 'priority-unknown' };
    }
  };

  const dmpPriorityDisplay = formatPriority(dmpPriority);
  const umpPriorityDisplay = formatPriority(umpPriority);

  return (
    <section className="card xcm-metrics">
      <div className="card-header">
        <h2 className="card-title">XCM Metrics</h2>
      </div>

      <div className="xcm-sections">
        {/* DMP Section (Relay → Asset Hub) */}
        <div className="xcm-section">
          <h3 className="xcm-section-title">DMP (Relay → Asset Hub)</h3>

          <div className="xcm-metrics-grid">
            <div className="xcm-metric">
              <div className="xcm-metric-label">Processed on AH</div>
              <div className="xcm-metric-value">
                {dmpCounter?.messagesProcessed.toLocaleString() || 0}
              </div>
            </div>

            <div className="xcm-metric">
              <div className="xcm-metric-label">Failed</div>
              <div className="xcm-metric-value xcm-metric-failed">
                {dmpCounter?.messagesFailed || 0}
              </div>
            </div>

            <div className="xcm-metric">
              <div className="xcm-metric-label">Current Queue</div>
              <div className="xcm-metric-value xcm-metric-queue">
                {formatQueueSize(dmpQueueEvent?.queueSize || 0)}
                <span className="xcm-metric-subtext">
                  ({formatBytes(dmpQueueEvent?.totalSizeBytes || 0)})
                </span>
              </div>
            </div>

            <div className="xcm-metric">
              <div className="xcm-metric-label">Priority</div>
              <div className="xcm-metric-value xcm-metric-priority">
                <span className={`priority-badge ${dmpPriorityDisplay.className}`}>
                  {dmpPriorityDisplay.text}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="xcm-divider"></div>

        {/* UMP Section (Asset Hub → Relay) */}
        <div className="xcm-section">
          <h3 className="xcm-section-title">UMP (Asset Hub → Relay)</h3>

          <div className="xcm-metrics-grid">
            <div className="xcm-metric">
              <div className="xcm-metric-label">Processed on RC</div>
              <div className="xcm-metric-value">
                {umpCounter?.messagesProcessed.toLocaleString() || 0}
              </div>
            </div>

            <div className="xcm-metric">
              <div className="xcm-metric-label">Failed</div>
              <div className="xcm-metric-value xcm-metric-failed">
                {umpCounter?.messagesFailed || 0}
              </div>
            </div>

            <div className="xcm-metric">
              <div className="xcm-metric-label">Current Queue</div>
              <div className="xcm-metric-value xcm-metric-queue">
                {formatQueueSize(umpQueueEvent?.queueSize || 0)}
                <span className="xcm-metric-subtext">
                  ({formatBytes(umpQueueEvent?.totalSizeBytes || 0)})
                </span>
              </div>
            </div>

            <div className="xcm-metric">
              <div className="xcm-metric-label">Priority</div>
              <div className="xcm-metric-value xcm-metric-priority">
                <span className={`priority-badge ${umpPriorityDisplay.className}`}>
                  {umpPriorityDisplay.text}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default XcmMessageMetrics; 