import React, { useState, useCallback, useEffect } from 'react';
import { useEventSource } from '../hooks/useEventSource';
import type { EventType } from '../hooks/useEventSource';
import { MIGRATION_PALLETS } from '../constants/migrationPallets';
import './MigrationStatus.css';

interface MigrationStage {
  stage: string;
  details: any;
  blockHash: string;
  timestamp: string;
  scheduledBlockNumber: number | null;
}

// LiveTimer component for showing time since last update
const LiveTimer: React.FC<{ lastUpdate: Date | null; chain: string; dotColor: string }> = ({ 
  lastUpdate, 
  chain, 
  dotColor 
}) => {
  const [elapsed, setElapsed] = useState<number>(0);
  
  useEffect(() => {
    if (!lastUpdate) {
      setElapsed(0);
      return;
    }
    
    // Reset to 0 when we get a new update
    setElapsed(0);
    
    // Then increment every second
    const interval = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [lastUpdate]);
  
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `00:${seconds.toString().padStart(2, '0')}`;
    }
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };
  
  const getTimerClass = () => {
    if (!lastUpdate) return 'timer-never';
    if (elapsed > 60) return 'timer-danger';
    if (elapsed > 30) return 'timer-warning';
    return 'timer-normal';
  };
  
  const getDisplayText = () => {
    if (!lastUpdate) return '00:00';
    return formatTime(elapsed);
  };
  
  return (
    <span className="timer-group">
      <div className={`indicator-dot ${getTimerClass() === 'timer-never' ? dotColor : getTimerClass() === 'timer-danger' ? 'dot-red' : getTimerClass() === 'timer-warning' ? 'dot-yellow' : 'dot-green'}`}></div>
      <span className="timer-chain">{chain}</span>
      <span className={`timer ${getTimerClass()}`}>{getDisplayText()}</span>
    </span>
  );
};

const ESTIMATED_TOTAL_ITEMS = 140000;
// const ESTIMATED_TOTAL_ITEMS = 858345; // Kusama

const MigrationStatus: React.FC = () => {
  const [currentStage, setCurrentStage] = useState<MigrationStage | null>(null);
  const [completedPallets, setCompletedPallets] = useState<string[]>([]);
  const [totalItemsProcessed, setTotalItemsProcessed] = useState<number>(0);
  const [isMobile, setIsMobile] = useState(false);
  const [rcLastUpdate, setRcLastUpdate] = useState<Date | null>(null);
  const [ahLastUpdate, setAhLastUpdate] = useState<Date | null>(null);
  const [xcmErrorCount, setXcmErrorCount] = useState<number>(0);
  
  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Subscribe to RC migration stage updates
  const { error } = useEventSource(['rcStageUpdate'], useCallback((_eventType: EventType, data: MigrationStage) => {
    setCurrentStage(data);
    setRcLastUpdate(new Date()); // Reset RC timer

    // Handle MigrationDone stage - set progress to 100%
    if (data.stage === 'MigrationDone') {
      setCompletedPallets([...MIGRATION_PALLETS]);
      setTotalItemsProcessed(ESTIMATED_TOTAL_ITEMS); // Force 100%
      return;
    }

    // Update completed pallets based on the stage for timeline display
    const stageName = data.stage;
    const palletIndex = MIGRATION_PALLETS.findIndex(pallet =>
      stageName.toLowerCase().includes(pallet.toLowerCase())
    );

    if (palletIndex > 0) {
      const newCompleted = MIGRATION_PALLETS.slice(0, palletIndex);
      setCompletedPallets(newCompleted);
    }
  }, []));

  // Subscribe to RC events (excluding rcStageUpdate)
  useEventSource(['rcHead', 'umpMessageCounter', 'umpQueueEvent'], useCallback((_eventType: EventType, data: any) => {
    setRcLastUpdate(new Date()); // Reset RC timer
  }, []));

  // Subscribe to AH events
  useEventSource(['ahHead', 'dmpMessageCounter', 'ahStageUpdate', 'dmpQueueEvent'], useCallback((_eventType: EventType, data: any) => {
    setAhLastUpdate(new Date()); // Reset AH timer
  }, []));

  // Subscribe to XCM message counters to track errors
  useEventSource(['dmpMessageCounter', 'umpMessageCounter'], useCallback((_eventType: EventType, data: any) => {
    if (data.messagesFailed !== undefined) {
      setXcmErrorCount(data.messagesFailed);
    }
  }, []));

  // Subscribe to pallet migration summary to track total items processed across all pallets
  useEventSource(['palletMigrationSummary'], useCallback((_eventType: EventType, data: any) => {
    // Sum up all items processed and failed across all pallets
    if (data.pallets && Array.isArray(data.pallets)) {
      const total = data.pallets.reduce((sum: number, pallet: any) => {
        const itemsProcessed = pallet.totalItemsProcessed || 0;
        const itemsFailed = pallet.totalItemsFailed || 0;
        return sum + itemsProcessed + itemsFailed;
      }, 0);
      setTotalItemsProcessed(total);
    }
  }, []));

  // Calculate which pallets to show in the carousel
  const getVisiblePallets = () => {
    const currentIndex = MIGRATION_PALLETS.findIndex(pallet => 
      currentStage?.stage.toLowerCase().includes(pallet.toLowerCase())
    );
    
    // If no current stage, show first few pallets
    if (currentIndex === -1) {
      return MIGRATION_PALLETS.slice(0, 6);
    }
    
    // Show current pallet and a few before/after
    const startIndex = Math.max(0, currentIndex - 2);
    const endIndex = Math.min(MIGRATION_PALLETS.length, currentIndex + 4);
    
    return MIGRATION_PALLETS.slice(startIndex, endIndex);
  };

  const visiblePallets = getVisiblePallets();
  const progressPercentage = currentStage?.stage === 'MigrationDone'
    ? 100
    : Math.min(100, (totalItemsProcessed / ESTIMATED_TOTAL_ITEMS) * 100);

  // Get XCM status based on error count
  const getXcmStatus = () => {
    if (xcmErrorCount === 0) {
      return {
        dotClass: 'dot-green',
        text: 'No XCM errors found'
      };
    } else if (xcmErrorCount === 1) {
      return {
        dotClass: 'dot-yellow',
        text: '1 XCM error found'
      };
    } else {
      return {
        dotClass: 'dot-red',
        text: `${xcmErrorCount} XCM errors found`
      };
    }
  };

  const xcmStatus = getXcmStatus();

  // Get overall status based on connection health
  const getOverallStatus = () => {
    const rcElapsed = rcLastUpdate ? Math.floor((Date.now() - rcLastUpdate.getTime()) / 1000) : 999;
    const ahElapsed = ahLastUpdate ? Math.floor((Date.now() - ahLastUpdate.getTime()) / 1000) : 999;
    
    if (rcElapsed > 60 && ahElapsed > 60) {
      return {
        dotClass: 'dot-red',
        text: 'Connection issues'
      };
    } else if (rcElapsed > 30 || ahElapsed > 30) {
      return {
        dotClass: 'dot-yellow',
        text: 'One chain delayed'
      };
    } else {
      return {
        dotClass: 'dot-green',
        text: 'Both chains connected'
      };
    }
  };

  const overallStatus = getOverallStatus();

  return (
    <section className="card migration-status">
      <div className="card-header">
        <h2 className="card-title">Migration Status</h2>
        <div className="card-actions">
          {/* Icons for card actions would go here */}
        </div>
      </div>
      
      <div className="stage-display">
        <div className="stage-name">
          {currentStage ? currentStage.stage : 'Loading...'}
        </div>
        <div className="stage-description">
          {currentStage 
            ? currentStage.stage === 'MigrationDone'
              ? 'Migration completed successfully! All pallets have been migrated.'
              : currentStage.stage === 'Pending'
              ? 'Currently Pending'
              : currentStage.stage === 'Scheduled' && currentStage.scheduledBlockNumber
              ? `Scheduled at block ${currentStage.scheduledBlockNumber}`
              : `Currently migrating ${currentStage.stage}`
            : 'Waiting for migration status updates'
          }
        </div>
      </div>
      
      <div className="progress-container">
        <div className="progress-header">
          <span className="progress-label">Overall Progress</span>
          <span className="progress-value">{Math.round(progressPercentage)}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progressPercentage}%` }}></div>
        </div>
      </div>
      
      {/* Timeline - only show on desktop/tablet */}
      {!isMobile && (
        <div className="timeline">
          {visiblePallets.map((pallet, index) => {
            const isCompleted = completedPallets.includes(pallet);
            const isCurrent = currentStage?.stage.toLowerCase().includes(pallet.toLowerCase());
            
            return (
              <div key={pallet} className="timeline-point">
                <div className={`point-marker ${isCompleted ? 'completed' : isCurrent ? 'ongoing' : ''}`}></div>
                <div className="point-label">{pallet}</div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Health indicators - show on all screen sizes */}
      <div className="health-indicators">
        <div className="overall-status-group">
          <span className="overall-status-label">Overall Status</span>
          <div className="overall-status-status">
            <div className={`indicator-dot ${overallStatus.dotClass}`}></div>
            <span className="overall-status-text">{overallStatus.text}</span>
          </div>
        </div>
        <div className="xcm-messages-group">
          <span className="xcm-messages-label">XCM Messages</span>
          <div className="xcm-messages-status">
            <div className={`indicator-dot ${xcmStatus.dotClass}`}></div>
            <span className="xcm-status-text">{xcmStatus.text}</span>
          </div>
        </div>
        <div className="last-updated-group">
          <span className="last-updated-label">Last Updated:</span>
          <div className="last-updated-timers">
            <LiveTimer 
              lastUpdate={rcLastUpdate} 
              chain="RC" 
              dotColor="dot-ah" 
            />
            <span className="timer-separator">|</span>
            <LiveTimer 
              lastUpdate={ahLastUpdate} 
              chain="AH" 
              dotColor="dot-ah" 
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default MigrationStatus; 