import React, { useState, useCallback } from 'react';
import MigrationStatus from './components/MigrationStatus';
import PerPalletMigrationStatus from './components/PerPalletMigrationStatus';
import XcmMessageMetrics from './components/XcmMessageMetrics';
import BalanceVerification from './components/BalanceVerification';
import AlertsCard from './components/AlertsCard';
import BackendUrlInput from './components/BackendUrlInput';
import { useEventSource, useBackendUrl } from './hooks/useEventSource';
import type { EventType } from './hooks/useEventSource';
import './App.css';
import polkadotLogo from './assets/Polkadot_Token_Pink.png';

function App() {
  const [rcBlockNumber, setRcBlockNumber] = useState<number | null>(null);
  const [ahBlockNumber, setAhBlockNumber] = useState<number | null>(null);

  const { backendUrl, setBackendUrl, isConnected } = useBackendUrl();

  const handleEvent = useCallback((eventType: EventType, data: any) => {
    if (eventType === 'rcHead' && data.blockNumber) {
      setRcBlockNumber(data.blockNumber);
    } else if (eventType === 'ahHead' && data.blockNumber) {
      setAhBlockNumber(data.blockNumber);
    }
  }, []);

  useEventSource(['rcHead', 'ahHead'], handleEvent);

  const handleBackendUrlChange = useCallback((url: string) => {
    setBackendUrl(url);
  }, [setBackendUrl]);

  return (
    <div className="app">
      <header>
        <div className="logo">
          <img src={polkadotLogo} alt="Polkadot Logo" />
          <h1>Asset Hub Kusama Migration Monitor</h1>
        </div>
        <div className="header-info">
          {process.env.ALLOW_REMOTE_BACKEND === 'true' && (
            <BackendUrlInput
              currentUrl={backendUrl}
              onUrlChange={handleBackendUrlChange}
              isConnected={isConnected}
            />
          )}
          <span className="timestamp">Last updated: {new Date().toLocaleString()}</span>
          <div className="finalized-heads">
            <div className="head-display">
              <div className="head-status"></div>
              <span className="head-label">RC Finalized:</span>
              <span className="head-value">{rcBlockNumber?.toLocaleString() ?? 'Waiting...'}</span>
            </div>
            <div className="head-display">
              <div className="head-status"></div>
              <span className="head-label">AH Finalized:</span>
              <span className="head-value">{ahBlockNumber?.toLocaleString() ?? 'Waiting...'}</span>
            </div>
          </div>
        </div>
      </header>
      <main>
        <MigrationStatus />
        <PerPalletMigrationStatus />
        <XcmMessageMetrics />
        <BalanceVerification />
        <AlertsCard />
      </main>
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-links">
            <a href="https://t.me/+CjOtzipvBHllMWYy" target="_blank" rel="noopener noreferrer" className="footer-link">
              Reach Out To Support
            </a>
            <span className="footer-separator">•</span>
            <a href="https://forum.polkadot.network/t/asset-hub-migration-2025/11129/53" target="_blank" rel="noopener noreferrer" className="footer-link">
              About
            </a>
          </div>
          <div className="footer-copyright">
            © 2025 Parity Technologies
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App; 