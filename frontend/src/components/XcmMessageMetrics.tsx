import React, { useState, useCallback, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { useEventSource } from '../hooks/useEventSource';
import type { EventType } from '../hooks/useEventSource';
import './XcmMessageMetrics.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface XcmCounter {
  sourceChain: string;
  destinationChain: string;
  messagesSent: number;
  messagesProcessed: number;
  messagesFailed: number;
  lastUpdated: string;
}

interface DmpLatency {
  latencyMs: number;
  averageLatencyMs: number;
  timestamp: string;
}

interface UmpLatency {
  latencyMs: number;
  averageLatencyMs: number;
  timestamp: string;
}

interface DmpQueueEvent {
  queueSize: number;
  totalSizeBytes: number;
  eventType: string;
  timestamp: string;
}

interface UmpQueueEvent {
  queueSize: number;
  totalSizeBytes: number;
  timestamp: string;
}

interface UmpMetrics {
  averageLatencyMs: number;
  totalSizeBytes: number;
  lastUpdated: string;
  latencyCount: number;
  sizeCount: number;
  timestamp: string;
}

interface DmpMetrics {
  averageLatencyMs: number;
  totalSizeBytes: number;
  lastUpdated: string;
  latencyCount: number;
  sizeCount: number;
  timestamp: string;
}

const XcmMessageMetrics: React.FC = () => {
  const [rcCounter, setRcCounter] = useState<XcmCounter | null>(null);
  const [ahCounter, setAhCounter] = useState<XcmCounter | null>(null);
  const [dmpLatency, setDmpLatency] = useState<DmpLatency | null>(null);
  const [umpLatency, setUmpLatency] = useState<UmpLatency | null>(null);
  const [dmpQueueEvent, setDmpQueueEvent] = useState<DmpQueueEvent | null>(null);
  const [umpQueueEvent, setUmpQueueEvent] = useState<UmpQueueEvent | null>(null);
  const [umpMetrics, setUmpMetrics] = useState<UmpMetrics | null>(null);
  const [dmpMetrics, setDmpMetrics] = useState<DmpMetrics | null>(null);
  
  // Historical data for charts
  const [dmpLatencyHistory, setDmpLatencyHistory] = useState<DmpLatency[]>([]);
  const [umpLatencyHistory, setUmpLatencyHistory] = useState<UmpLatency[]>([]);
  const maxDataPoints = 30; // Keep last 30 data points

  // Subscribe to RC and AH XCM message counter events
  const { error: xcmError } = useEventSource(['rcXcmMessageCounter', 'ahXcmMessageCounter'], useCallback((eventType: EventType, data: XcmCounter) => {
    if (eventType === 'rcXcmMessageCounter') {
      setRcCounter(data);
    } else if (eventType === 'ahXcmMessageCounter') {
      setAhCounter(data);
    }
  }, []));

  // Subscribe to DMP latency events
  const { error: dmpLatencyError } = useEventSource(['dmpLatency'], useCallback((eventType: EventType, data: DmpLatency) => {
    if (eventType === 'dmpLatency') {
      setDmpLatency(data);
      // Add to historical data
      setDmpLatencyHistory(prev => {
        const newHistory = [...prev, data];
        return newHistory.slice(-maxDataPoints);
      });
    }
  }, [maxDataPoints]));

  // Subscribe to UMP latency events
  const { error: umpLatencyError } = useEventSource(['umpLatency'], useCallback((eventType: EventType, data: UmpLatency) => {
    if (eventType === 'umpLatency') {
      setUmpLatency(data);
      // Add to historical data
      setUmpLatencyHistory(prev => {
        const newHistory = [...prev, data];
        return newHistory.slice(-maxDataPoints);
      });
    }
  }, [maxDataPoints]));

  // Subscribe to UMP metrics events
  const { error: umpMetricsError } = useEventSource(['umpMetrics'], useCallback((eventType: EventType, data: UmpMetrics) => {
    if (eventType === 'umpMetrics') {
      setUmpMetrics(data);
    }
  }, []));

  // Subscribe to DMP metrics events
  const { error: dmpMetricsError } = useEventSource(['dmpMetrics'], useCallback((eventType: EventType, data: DmpMetrics) => {
    if (eventType === 'dmpMetrics') {
      setDmpMetrics(data);
    }
  }, []));

  // Subscribe to DMP queue events
  const { error: queueError } = useEventSource(['dmpQueueEvent'], useCallback((eventType: EventType, data: DmpQueueEvent) => {
    if (eventType === 'dmpQueueEvent') {
      setDmpQueueEvent(data);
    }
  }, []));

  // Subscribe to UMP queue events
  const { error: umpQueueError } = useEventSource(['umpQueueEvent'], useCallback((eventType: EventType, data: UmpQueueEvent) => {
    if (eventType === 'umpQueueEvent') {
      setUmpQueueEvent(data);
    }
  }, []));

  // Calculate metrics
  const totalMessagesSent = rcCounter?.messagesSent || 0;
  const totalMessagesProcessed = ahCounter?.messagesProcessed || 0;
  const totalMessagesFailed = ahCounter?.messagesFailed || 0;
  const messagesInFlight = totalMessagesSent - totalMessagesProcessed;
  const errorRate = totalMessagesSent > 0 ? (totalMessagesFailed / totalMessagesSent) * 100 : 0;

  // Determine status for in-flight messages
  const getInFlightStatus = () => {
    if (messagesInFlight === 0) return { text: 'Normal', color: 'var(--success)' };
    if (messagesInFlight <= 5) return { text: 'Low', color: 'var(--warning)' };
    return { text: 'High', color: 'var(--danger)' };
  };

  const inFlightStatus = getInFlightStatus();

  // Format latency for display
  const formatLatency = (latencyMs: number) => {
    if (latencyMs === 0) return '0s';
    if (latencyMs < 0) return 'Invalid'; // Handle negative latency
    return `${(latencyMs / 1000).toFixed(1)}s`;
  };

  // Get latency color based on value
  const getLatencyColor = (latencyMs: number) => {
    if (latencyMs < 0) return 'var(--danger)'; // Negative latency = red
    if (latencyMs < 5000) return 'var(--success)'; // < 5s = green
    if (latencyMs < 15000) return '#4CAF50'; // 5-15s = blue/green
    if (latencyMs < 30000) return 'var(--warning)'; // 15-30s = yellow
    return 'var(--danger)'; // > 30s = red
  };

  // Format bytes for display
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0KB';
    return `${(bytes / 1024).toFixed(1)}KB`;
  };

  // Get DMP queue status based on metrics
  const getDmpStatus = () => {
    const latency = dmpLatency?.averageLatencyMs || 0;
    const queueSize = dmpQueueEvent?.queueSize || 0;
    
    if (latency < 5000 && queueSize < 10) return { text: 'Excellent', class: 'status-excellent', color: 'var(--success)' };
    if (latency < 15000 && queueSize < 50) return { text: 'Good', class: 'status-good', color: '#4CAF50' };
    if (latency < 30000 && queueSize < 100) return { text: 'Fair', class: 'status-fair', color: 'var(--warning)' };
    return { text: 'Poor', class: 'status-poor', color: 'var(--danger)' };
  };

  // Get UMP queue status based on metrics
  const getUmpStatus = () => {
    const latency = umpLatency?.averageLatencyMs || 0;
    const queueSize = umpQueueEvent?.queueSize || 0;
    
    if (latency < 5000 && queueSize < 10) return { text: 'Excellent', class: 'status-excellent', color: 'var(--success)' };
    if (latency < 15000 && queueSize < 50) return { text: 'Good', class: 'status-good', color: '#4CAF50' };
    if (latency < 30000 && queueSize < 100) return { text: 'Fair', class: 'status-fair', color: 'var(--warning)' };
    return { text: 'Poor', class: 'status-poor', color: 'var(--danger)' };
  };

  const dmpStatus = getDmpStatus();
  const umpStatus = getUmpStatus();

  // Prepare chart data
  const chartMaxPoints = Math.max(dmpLatencyHistory.length, umpLatencyHistory.length);
  const chartData = {
    labels: chartMaxPoints > 0 ? Array.from({ length: chartMaxPoints }, (_, i) => i + 1) : [],
    datasets: [
      {
        label: 'DMP Latency (ms)',
        data: dmpLatencyHistory.map(d => d.latencyMs),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
      {
        label: 'UMP Latency (ms)',
        data: umpLatencyHistory.map(d => d.latencyMs),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: 'XCM Message Latency Over Time',
        font: {
          size: 14,
          weight: 'bold',
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Latency (ms)',
          font: {
            size: 12,
          },
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Data Points',
          font: {
            size: 12,
          },
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  };

  return (
    <section className="card xcm-messages">
      <div className="card-header">
        <h2 className="card-title">XCM Message Metrics</h2>
        <div className="card-actions">
          {/* Icons for card actions would go here */}
        </div>
      </div>
      
      
      <div className="queue-sections">
        {/* DMP Queue Section */}
        <div className="queue-section">
          <div className="queue-section-header">
            <h3 className="queue-section-title">DMP Queue (Downward Message Passing)</h3>
            <div className="queue-section-status">
              <div className={`queue-status ${dmpStatus.class}`}></div>
              <span className="queue-section-throughput" style={{ color: dmpStatus.color }}>{dmpStatus.text}</span>
            </div>
          </div>
          
          <div className="queue-section-metrics">
            <div className="queue-section-metric">
              <div className="queue-section-value">{dmpQueueEvent?.queueSize.toLocaleString() || 0}</div>
              <div className="queue-section-label">Current Depth</div>
            </div>
            <div className="queue-section-metric">
              <div className="queue-section-value">{formatBytes(dmpQueueEvent?.totalSizeBytes || dmpMetrics?.totalSizeBytes || 0)}</div>
              <div className="queue-section-label">Total Size</div>
            </div>
            <div className="queue-section-metric">
              <div className="queue-section-value" style={{ color: getLatencyColor(dmpLatency?.averageLatencyMs || dmpMetrics?.averageLatencyMs || 0) }}>
                {formatLatency(dmpLatency?.averageLatencyMs || dmpMetrics?.averageLatencyMs || 0)}
              </div>
              <div className="queue-section-label">Avg Latency</div>
            </div>
            <div className="queue-section-metric">
              <div className="queue-section-value" style={{ color: getLatencyColor(dmpLatency?.latencyMs || 0) }}>
                {formatLatency(dmpLatency?.latencyMs || 0)}
              </div>
              <div className="queue-section-label">Current Latency</div>
            </div>
          </div>
        </div>
        
        {/* UMP Queue Section */}
        <div className="queue-section">
          <div className="queue-section-header">
            <h3 className="queue-section-title">UMP Queue (Upward Message Passing)</h3>
            <div className="queue-section-status">
              <div className={`queue-status ${umpStatus.class}`}></div>
              <span className="queue-section-throughput" style={{ color: umpStatus.color }}>{umpStatus.text}</span>
            </div>
          </div>
          
          <div className="queue-section-metrics">
            <div className="queue-section-metric">
              <div className="queue-section-value">{umpQueueEvent?.queueSize.toLocaleString() || 0}</div>
              <div className="queue-section-label">Current Depth</div>
            </div>
            <div className="queue-section-metric">
              <div className="queue-section-value">{formatBytes(umpQueueEvent?.totalSizeBytes || umpMetrics?.totalSizeBytes || 0)}</div>
              <div className="queue-section-label">Total Size</div>
            </div>
            <div className="queue-section-metric">
              <div className="queue-section-value" style={{ color: getLatencyColor(umpLatency?.averageLatencyMs || umpMetrics?.averageLatencyMs || 0) }}>
                {formatLatency(umpLatency?.averageLatencyMs || umpMetrics?.averageLatencyMs || 0)}
              </div>
              <div className="queue-section-label">Avg Latency</div>
            </div>
            <div className="queue-section-metric">
              <div className="queue-section-value" style={{ color: getLatencyColor(umpLatency?.latencyMs || 0) }}>
                {formatLatency(umpLatency?.latencyMs || 0)}
              </div>
              <div className="queue-section-label">Current Latency</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="chart-container">
        {dmpLatencyHistory.length > 0 || umpLatencyHistory.length > 0 ? (
          <Line data={chartData} options={chartOptions} />
        ) : (
          <div className="chart-placeholder">
            <p>Waiting for latency data...</p>
            <p>DMP and UMP latency will appear here once events are received.</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default XcmMessageMetrics; 