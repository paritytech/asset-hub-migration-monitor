import React, { useState, useEffect, useCallback } from 'react';
import { useEventSource } from '../hooks/useEventSource';
import { MIGRATION_PALLETS } from '../constants/migrationPallets';
import './PerPalletMigrationStatus.css';

const PALLETS_PER_PAGE = 7;

interface PalletStatus {
  palletName: string;
  status: 'pending' | 'active' | 'completed';
  currentStage: string | null;
  timeInPallet: number | null;
  totalDuration: number | null;
  isCompleted: boolean;
  palletInitStartedAt: string | null;
  lastUpdated: number;
  itemsProcessed?: number;
  itemsFailed?: number;
}

// Timer component for real-time updates
const PalletTimer: React.FC<{ 
  startTime: string | null; 
  isCompleted: boolean; 
  totalDuration: number | null;
  timeInPallet: number | null;
}> = ({ startTime, isCompleted, totalDuration, timeInPallet }) => {
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    if (isCompleted || !startTime) return;

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [isCompleted, startTime]);

  const formatDuration = (milliseconds: number): string => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (!startTime) {
    return <span>-</span>;
  }

  if (isCompleted && totalDuration) {
    return <span className="completed-time">{formatDuration(totalDuration)}</span>;
  }

  // Calculate elapsed time from start time to current time
  const startTimeMs = new Date(startTime).getTime();
  const elapsedTime = currentTime - startTimeMs;

  return <span className="active-time">{formatDuration(elapsedTime)}</span>;
};

const PerPalletMigrationStatus: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(0);
  const [palletStatuses, setPalletStatuses] = useState<Map<string, PalletStatus>>(new Map());

  const totalPages = Math.ceil(MIGRATION_PALLETS.length / PALLETS_PER_PAGE);
  const startIndex = currentPage * PALLETS_PER_PAGE;
  const endIndex = startIndex + PALLETS_PER_PAGE;
  const visiblePallets = MIGRATION_PALLETS.slice(startIndex, endIndex);

  // Subscribe to rcStageUpdate events
  const handleStageUpdate = useCallback((eventType: string, data: any) => {
    if (eventType === 'rcStageUpdate') {
      setPalletStatuses(prev => {
        const newStatuses = new Map(prev);

        // If migration is done, mark all pallets as completed
        if (data.stage === 'MigrationDone') {
          MIGRATION_PALLETS.forEach(pallet => {
            const existing = newStatuses.get(pallet) || {
              palletName: pallet,
              status: 'pending' as const,
              currentStage: null,
              timeInPallet: null,
              totalDuration: null,
              isCompleted: false,
              palletInitStartedAt: null,
              lastUpdated: Date.now(),
            };
            newStatuses.set(pallet, {
              ...existing,
              status: 'completed',
              isCompleted: true,
            });
          });
          return newStatuses;
        }

        // Handle normal pallet updates
        if (data.palletName) {
          const existing = newStatuses.get(data.palletName) || {
            palletName: data.palletName,
            status: 'pending',
            currentStage: null,
            timeInPallet: null,
            totalDuration: null,
            isCompleted: false,
            palletInitStartedAt: null,
            lastUpdated: Date.now(),
          };

          // Determine status based on completion and current stage
          let status: 'pending' | 'active' | 'completed' = 'pending';
          if (data.isPalletCompleted) {
            status = 'completed';
          } else if (data.palletInitStartedAt) {
            status = 'active';
          }

          newStatuses.set(data.palletName, {
            ...existing,
            status,
            currentStage: data.currentPalletStage || data.stage,
            timeInPallet: data.timeInPallet,
            totalDuration: data.palletTotalDuration,
            isCompleted: data.isPalletCompleted,
            palletInitStartedAt: data.palletInitStartedAt,
            lastUpdated: Date.now(),
          });

          // Mark all pallets before the current active one as completed
          const currentPalletIndex = MIGRATION_PALLETS.indexOf(data.palletName);
          if (currentPalletIndex > 0 && !data.isPalletCompleted) {
            for (let i = 0; i < currentPalletIndex; i++) {
              const previousPallet = MIGRATION_PALLETS[i];
              const previousStatus = newStatuses.get(previousPallet);
              if (previousStatus && previousStatus.status !== 'completed') {
                newStatuses.set(previousPallet, {
                  ...previousStatus,
                  status: 'completed',
                  isCompleted: true,
                });
              }
            }
          }
        }

        return newStatuses;
      });
    }
  }, []);

  // Subscribe to pallet migration updates
  const handlePalletMigrationUpdate = useCallback((eventType: string, data: any) => {
    if (eventType === 'palletMigrationUpdate') {
      setPalletStatuses(prev => {
        const newStatuses = new Map(prev);
        const existing = newStatuses.get(data.palletName);
        
        if (existing) {
          newStatuses.set(data.palletName, {
            ...existing,
            itemsProcessed: data.totalItemsProcessed,
            itemsFailed: data.totalItemsFailed,
            lastUpdated: Date.now(),
          });
        }
        
        return newStatuses;
      });
    }
  }, []);

  // Subscribe to pallet migration summary for initial state
  const handlePalletMigrationSummary = useCallback((eventType: string, data: any) => {
    if (eventType === 'palletMigrationSummary') {
      setPalletStatuses(prev => {
        const newStatuses = new Map(prev);

        // Update each pallet with its migration data
        data.pallets.forEach((pallet: any) => {
          const existing = newStatuses.get(pallet.palletName) || {
            palletName: pallet.palletName,
            status: 'pending' as const,
            currentStage: null,
            timeInPallet: null,
            totalDuration: null,
            isCompleted: false,
            palletInitStartedAt: null,
            lastUpdated: Date.now(),
          };
          newStatuses.set(pallet.palletName, {
            ...existing,
            itemsProcessed: pallet.totalItemsProcessed,
            itemsFailed: pallet.totalItemsFailed,
            lastUpdated: Date.now(),
          });
        });

        return newStatuses;
      });
    }
  }, []);

  useEventSource(['rcStageUpdate'], handleStageUpdate);
  useEventSource(['palletMigrationUpdate'], handlePalletMigrationUpdate);
  useEventSource(['palletMigrationSummary'], handlePalletMigrationSummary);

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
  };

  const getStatusBadge = (status: 'pending' | 'active' | 'completed') => {
    switch (status) {
      case 'active':
        return <span className="badge badge-active">Active</span>;
      case 'completed':
        return <span className="badge badge-completed">Completed</span>;
      default:
        return <span className="badge badge-pending">Pending</span>;
    }
  };

  const getProgressPercentage = (status: 'pending' | 'active' | 'completed') => {
    switch (status) {
      case 'completed':
        return 100;
      case 'active':
        return 50; // Could be more sophisticated based on current stage
      default:
        return 0;
    }
  };

  return (
    <section className="card pallet-status">
      <div className="card-header">
        <h2 className="card-title">Per-Pallet Migration Status</h2>
        <div className="card-actions">
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Pallet Name</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Items Processed / Failed</th>
              <th>Time in Stage</th>
            </tr>
          </thead>
          <tbody>
            {visiblePallets.map((pallet) => {
              const status = palletStatuses.get(pallet);
              const progressPercentage = status ? getProgressPercentage(status.status) : 0;
              
              return (
                <tr key={pallet}>
                  <td>{pallet}</td>
                  <td>{status ? getStatusBadge(status.status) : <span className="badge badge-pending">Pending</span>}</td>
                  <td>
                    <div className="progress-bar">
                      <div 
                        className={`progress-fill ${status?.status === 'active' ? 'loading' : ''}`}
                        style={{ width: status?.status === 'active' ? '100%' : '0%' }}
                      ></div>
                    </div>
                  </td>
                  <td>
                    {status?.itemsProcessed !== undefined ? (
                      <div className="items-ratio">
                        <span className="items-processed">
                          {status.itemsProcessed.toLocaleString()}
                        </span>
                        <span className="separator"> / </span>
                        <span className="items-failed">
                          {status.itemsFailed !== undefined ? status.itemsFailed.toLocaleString() : '0'}
                        </span>
                      </div>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                  <td>
                    {status ? (
                      <PalletTimer
                        startTime={status.currentStage ? status.palletInitStartedAt : null}
                        isCompleted={status.isCompleted}
                        totalDuration={status.totalDuration}
                        timeInPallet={status.timeInPallet}
                      />
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button 
            className="pagination-btn" 
            onClick={handlePreviousPage}
            disabled={currentPage === 0}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Previous
          </button>
          <span className="pagination-info">
            {startIndex + 1}-{Math.min(endIndex, MIGRATION_PALLETS.length)} of {MIGRATION_PALLETS.length} pallets
          </span>
          <button 
            className="pagination-btn" 
            onClick={handleNextPage}
            disabled={currentPage === totalPages - 1}
          >
            Next
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}
    </section>
  );
};

export default PerPalletMigrationStatus; 