import React from 'react';
import './KusamaMigrationStats.css';

interface KusamaMigrationStatsProps {
  onBack: () => void;
}

const KusamaMigrationStats: React.FC<KusamaMigrationStatsProps> = ({ onBack }) => {
  // Mock data - you can replace these with actual values
  const stats = {
    overview: {
      totalDuration: '3h 13m 18s',
      totalPallets: 25,
      totalItemsMigrated: 841219,
      totalAccountsMigrated: 348210,
      startBlock: 30423691,
      endBlock: 30425590,
    },
    xcm: {
      dmpMessagesSent: 3043,
      dmpMessagesProcessed: 3043,
      dmpMessagesFailed: 0,
      umpMessagesSent: 3067,
      umpMessagesProcessed: 3067,
      umpMessagesFailed: 0,
      totalBytesTransferred: '117.96 MB',
    },
    balances: {
      totalMigrated: '1,234,567.89 KSM',
      totalKept: '20,350.77 KSM',
      checkingAccount: '17,127,445.02 KSM',
      totalIssuanceBefore: '163,847.79 KSM',
    },
    pallets: [
      { name: 'Accounts', duration: 'Coming Soon', items: 348210 },
      { name: 'MultiSig', duration: 'Coming Soon', items: 124 },
      { name: 'Claims', duration: 'Coming Soon', items: 877 },
      { name: 'Proxy', duration: 'Coming Soon', items: 1819 },
      { name: 'Preimage', duration: 'Coming Soon', items: 443 },
      { name: 'NomPools', duration: 'Coming Soon', items: 5191 },
      { name: 'Vesting', duration: 'Coming Soon', items: 8 },
      { name: 'DelegatedStaking', duration: 'Coming Soon', items: 3381 },
      { name: 'Indices', duration: 'Coming Soon', items: 1189 },
      { name: 'Referenda', duration: 'Coming Soon', items: 606 },
      { name: 'BagsList', duration: 'Coming Soon', items: 15598 },
      { name: 'Scheduler', duration: 'Coming Soon', items: 21 },
      { name: 'ConvictionVoting', duration: 'Coming Soon', items: 31562 },
      { name: 'Bounties', duration: 'Coming Soon', items: 26 },
      { name: 'ChildBounties', duration: 'Coming Soon', items: 38 },
      { name: 'AssetRate', duration: 'Coming Soon', items: 3 },
      { name: 'Treasury', duration: 'Coming Soon', items: 12 },
      { name: 'Recovery', duration: 'Coming Soon', items: 148 },
      { name: 'Society', duration: 'Coming Soon', items: 1560 },
      { name: 'Staking', duration: 'Coming Soon', items: 430501 },
    ],
  };

  return (
    <div className="kusama-stats-page">
      <div className="stats-header">
        <button className="back-button" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Dashboard
        </button>
        <h1 className="stats-title">Kusama Asset Hub Migration Statistics</h1>
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
            <div className="stat-value">{stats.overview.totalItemsMigrated.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Accounts Migrated</div>
            <div className="stat-value">{stats.overview.totalAccountsMigrated.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Start Block</div>
            <div className="stat-value">{stats.overview.startBlock.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">End Block</div>
            <div className="stat-value">{stats.overview.endBlock.toLocaleString()}</div>
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
                <div className="stat-value">{stats.xcm.dmpMessagesSent.toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Messages Processed</div>
                <div className="stat-value">{stats.xcm.dmpMessagesProcessed.toLocaleString()}</div>
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
                <div className="stat-value">{stats.xcm.umpMessagesSent.toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Messages Processed</div>
                <div className="stat-value">{stats.xcm.umpMessagesProcessed.toLocaleString()}</div>
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
                  <td>{pallet.items.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default KusamaMigrationStats;
