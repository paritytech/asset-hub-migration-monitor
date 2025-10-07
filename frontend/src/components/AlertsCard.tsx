import React, { useState, useCallback } from 'react';
import { useEventSource } from '../hooks/useEventSource';
import type { EventType } from '../hooks/useEventSource';
import './AlertsCard.css';

interface MigrationAlert {
  blockNumber: number;
  palletName: string;
  itemsProcessed: number;
  itemsFailed: number;
  stageName: string;
  stageId: number;
}

const MAX_ALERTS = 20;

const AlertsCard: React.FC = () => {
  const [alerts, setAlerts] = useState<MigrationAlert[]>([]);

  // Subscribe to migration alert events
  useEventSource(['migrationAlert'], useCallback((eventType: EventType, data: MigrationAlert) => {
    if (eventType === 'migrationAlert') {
      setAlerts(prev => {
        // Add new alert to the beginning
        const newAlerts = [data, ...prev];
        // Keep only the last MAX_ALERTS
        return newAlerts.slice(0, MAX_ALERTS);
      });
    }
  }, []));

  const clearAlerts = () => {
    setAlerts([]);
  };

  return (
    <section className="card alerts-card">
      <div className="card-header">
        <h2 className="card-title">
          Migration Alerts
          {alerts.length > 0 && <span className="alert-count">{alerts.length}</span>}
        </h2>
        <div className="card-actions">
          {alerts.length > 0 && (
            <button className="clear-alerts-btn" onClick={clearAlerts}>
              Clear All
            </button>
          )}
        </div>
      </div>

      <div className="alerts-container">
        {alerts.length === 0 ? (
          <div className="no-alerts">
            <p className="no-alerts-text">No failed items detected. All batches processing successfully.</p>
          </div>
        ) : (
          <table className="alerts-table">
            <thead>
              <tr>
                <th>Block #</th>
                <th>Pallet</th>
                <th>Stage</th>
                <th>Items Processed</th>
                <th>Items Failed</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert, index) => (
                <tr key={`${alert.blockNumber}-${alert.palletName}-${index}`} className="alert-row">
                  <td className="alert-block">#{alert.blockNumber.toLocaleString()}</td>
                  <td className="alert-pallet">{alert.palletName}</td>
                  <td className="alert-stage">{alert.stageName}</td>
                  <td className="alert-processed">{alert.itemsProcessed.toLocaleString()}</td>
                  <td className="alert-failed">
                    <span className="failed-badge">{alert.itemsFailed.toLocaleString()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};

export default AlertsCard;
