import React, { useState, useEffect } from 'react';
import './KusamaMigrationStats.css';

interface PolkadotMigrationStatsProps {
  onBack: () => void;
}

const PolkadotMigrationStats: React.FC<PolkadotMigrationStatsProps> = ({ onBack }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('migration-stats-theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('migration-stats-theme', newTheme);
  };
  // Hardcoded Polkadot migration data - replace TBD with actual values
  const stats = {
    overview: {
      totalDuration: '8h 39m 24s',
      totalPallets: 23,
      totalItemsMigrated: '2,103,186',
      totalAccountsMigrated: '1,526,324',
      startBlock: '28,490,502',
      endBlock: '28,495,696',
    },
    xcm: {
      dmpMessagesSent: '7405',
      dmpMessagesProcessed: '7405',
      dmpMessagesFailed: '0',
      umpMessagesSent: '7405',
      umpMessagesProcessed: '7405',
      umpMessagesFailed: '0',
      totalBytesTransferred: '283.21 MB',
    },
    balances: {
      totalMigrated: '1,633,347,181.86 DOT',
      totalKept: '150,134.15 DOT',
      checkingAccount: '0.01 DOT',
      totalIssuanceBefore: '11,303,377.67',
    },
    pallets: [
      { name: 'Accounts', duration: '5h 12m 49s', items: '1,526,324' },
      { name: 'Multisig', duration: '0s', items: '0' },
      { name: 'Claims', duration: '29s', items: '993' },
      { name: 'Proxy', duration: '11s', items: '2,101' },
      { name: 'Preimage', duration: '57s', items: '1,068' },
      { name: 'NomPools', duration: '3m 59s', items: '47,270' },
      { name: 'Vesting', duration: '3s', items: '863' },
      { name: 'DelegatedStaking', duration: '2m 18s', items: '36,686' },
      { name: 'Indices', duration: '41s', items: '3,396' },
      { name: 'Referenda', duration: '48s', items: '1,783' },
      { name: 'BagsList', duration: '2m 7s', items: '30,469' },
      { name: 'Scheduler', duration: '24s', items: '21' },
      { name: 'ConvictionVoting', duration: '3m 34s', items: '54,883' },
      { name: 'Bounties', duration: '8s', items: '48' },
      { name: 'ChildBounties', duration: '20s', items: '87' },
      { name: 'AssetRate', duration: '11s', items: '6' },
      { name: 'Crowdloan', duration: '29s', items: '2,484' },
      { name: 'Treasury', duration: '16s', items: '212' },
      { name: 'Staking', duration: '44m 33s', items: '394,492' },
    ],
  };

  return (
    <div className="kusama-stats-page" data-theme={theme}>
      <div className="stats-header">
        <button className="back-button" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Dashboard
        </button>
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === 'light' ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
              Dark Mode
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
              Light Mode
            </>
          )}
        </button>
        <h1 className="stats-title">Polkadot Asset Hub Migration Statistics</h1>
        <p className="stats-subtitle">Complete overview of the migration process and results</p>
      </div>

      {/* Overview Section */}
      <section className="stats-section">
        <h2 className="section-title">Migration Overview</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Duration</div>
            <div className="stat-value">{stats.overview.totalDuration}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Pallets Migrated</div>
            <div className="stat-value">{stats.overview.totalPallets}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Items Migrated</div>
            <div className="stat-value">{typeof stats.overview.totalItemsMigrated === 'number' ? stats.overview.totalItemsMigrated.toLocaleString() : stats.overview.totalItemsMigrated}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Accounts Migrated</div>
            <div className="stat-value">{typeof stats.overview.totalAccountsMigrated === 'number' ? stats.overview.totalAccountsMigrated.toLocaleString() : stats.overview.totalAccountsMigrated}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Start Block</div>
            <div className="stat-value">{typeof stats.overview.startBlock === 'number' ? stats.overview.startBlock.toLocaleString() : stats.overview.startBlock}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">End Block</div>
            <div className="stat-value">{typeof stats.overview.endBlock === 'number' ? stats.overview.endBlock.toLocaleString() : stats.overview.endBlock}</div>
          </div>
        </div>
      </section>

      {/* XCM Metrics Section */}
      <section className="stats-section">
        <h2 className="section-title">XCM Message Statistics</h2>
        <div className="xcm-stats-container">
          <div className="xcm-column">
            <h3 className="xcm-column-title">DMP (Relay → Asset Hub)</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Messages Sent</div>
                <div className="stat-value">{typeof stats.xcm.dmpMessagesSent === 'number' ? stats.xcm.dmpMessagesSent.toLocaleString() : stats.xcm.dmpMessagesSent}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Messages Processed</div>
                <div className="stat-value">{typeof stats.xcm.dmpMessagesProcessed === 'number' ? stats.xcm.dmpMessagesProcessed.toLocaleString() : stats.xcm.dmpMessagesProcessed}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Messages Failed</div>
                <div className="stat-value stat-success">{stats.xcm.dmpMessagesFailed}</div>
              </div>
            </div>
          </div>
          <div className="xcm-column">
            <h3 className="xcm-column-title">UMP (Asset Hub → Relay)</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Messages Sent</div>
                <div className="stat-value">{typeof stats.xcm.umpMessagesSent === 'number' ? stats.xcm.umpMessagesSent.toLocaleString() : stats.xcm.umpMessagesSent}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Messages Processed</div>
                <div className="stat-value">{typeof stats.xcm.umpMessagesProcessed === 'number' ? stats.xcm.umpMessagesProcessed.toLocaleString() : stats.xcm.umpMessagesProcessed}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Messages Failed</div>
                <div className="stat-value stat-success">{stats.xcm.umpMessagesFailed}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Bytes Transferred</div>
            <div className="stat-value">{stats.xcm.totalBytesTransferred}</div>
          </div>
        </div>
      </section>

      {/* Balance Verification Section */}
      <section className="stats-section">
        <h2 className="section-title">Balance Verification</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Migrated (RC)</div>
            <div className="stat-value">{stats.balances.totalMigrated}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Kept (RC)</div>
            <div className="stat-value">{stats.balances.totalKept}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Checking Account (AH)</div>
            <div className="stat-value">{stats.balances.checkingAccount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Issuance Before (AH)</div>
            <div className="stat-value">{stats.balances.totalIssuanceBefore}</div>
          </div>
        </div>
      </section>

      {/* Per-Pallet Statistics */}
      <section className="stats-section">
        <h2 className="section-title">Per-Pallet Migration Details</h2>
        <div className="pallet-stats-table">
          <table>
            <thead>
              <tr>
                <th>Pallet Name</th>
                <th>Duration</th>
                <th>Items Migrated</th>
              </tr>
            </thead>
            <tbody>
              {stats.pallets.map((pallet, index) => (
                <tr key={index}>
                  <td className="pallet-name">{pallet.name}</td>
                  <td>{pallet.duration}</td>
                  <td>{typeof pallet.items === 'number' ? pallet.items.toLocaleString() : pallet.items}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default PolkadotMigrationStats;
