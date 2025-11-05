import React, { useState, useCallback, useEffect } from 'react';
import KusamaMigrationStats from './components/KusamaMigrationStats';
import PolkadotMigrationStats from './components/PolkadotMigrationStats';
import './App.css';
import polkadotLogo from './assets/Polkadot_Token_Pink.png';

function App() {
  const [currentRoute, setCurrentRoute] = useState<string>(window.location.hash || '#/');

  // Handle hash change for routing
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentRoute(window.location.hash || '#/');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigateBack = useCallback(() => {
    window.location.hash = '#/';
  }, []);

  // Render Kusama stats page
  if (currentRoute === '#/kusama') {
    return (
      <div className="app">
        <KusamaMigrationStats onBack={handleNavigateBack} />
      </div>
    );
  }

  // Render Polkadot stats page
  if (currentRoute === '#/polkadot') {
    return (
      <div className="app">
        <PolkadotMigrationStats onBack={handleNavigateBack} />
      </div>
    );
  }

  // Render landing page with network selection
  return (
    <div className="app">
      <header>
        <div className="logo">
          <img src={polkadotLogo} alt="Polkadot Logo" />
          <h1>Asset Hub Migration Monitor</h1>
        </div>
      </header>
      <main className="landing-main">
        <div className="landing-container">
          <h2 className="landing-title">Select Network</h2>
          <p className="landing-subtitle">View migration statistics for Kusama or Polkadot Asset Hub</p>

          <div className="success-banner">
            <svg className="success-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <div className="success-content">
              <h3 className="success-title">Migration Successfully Completed!</h3>
              <p className="success-message">The Polkadot Asset Hub migration has been successfully completed. View detailed statistics for both networks below.</p>
            </div>
          </div>

          <div className="network-cards">
            <a href="#/kusama" className="network-card kusama-card">
              <div className="network-card-header">
                <h3>Kusama</h3>
                <span className="network-badge">Completed</span>
              </div>
              <p className="network-description">View complete migration statistics for Kusama Asset Hub</p>
              <div className="network-stats">
                <div className="network-stat">
                  <span className="stat-label">Pallets Migrated</span>
                  <span className="stat-value">25</span>
                </div>
                <div className="network-stat">
                  <span className="stat-label">Total Items</span>
                  <span className="stat-value">841,219</span>
                </div>
              </div>
            </a>

            <a href="#/polkadot" className="network-card polkadot-card">
              <div className="network-card-header">
                <h3>Polkadot</h3>
                <span className="network-badge">Completed</span>
              </div>
              <p className="network-description">View complete migration statistics for Polkadot Asset Hub</p>
              <div className="network-stats">
                <div className="network-stat">
                  <span className="stat-label">Pallets Migrated</span>
                  <span className="stat-value">19</span>
                </div>
                <div className="network-stat">
                  <span className="stat-label">Total Items</span>
                  <span className="stat-value">2,103,186</span>
                </div>
              </div>
            </a>
          </div>
        </div>
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