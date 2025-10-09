import React from 'react';
import './KusamaMigrationBanner.css';

interface KusamaMigrationBannerProps {
  onNavigate: () => void;
}

const KusamaMigrationBanner: React.FC<KusamaMigrationBannerProps> = ({ onNavigate }) => {
  return (
    <div className="kusama-migration-banner">
      <div className="banner-content">
        <div className="banner-icon">✅</div>
        <div className="banner-text">
          <h3 className="banner-title">Kusama Asset Hub Migration Complete!</h3>
          <p className="banner-subtitle">View detailed statistics and metrics from the successful migration</p>
        </div>
        <button className="banner-button" onClick={onNavigate}>
          View Stats
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default KusamaMigrationBanner;
