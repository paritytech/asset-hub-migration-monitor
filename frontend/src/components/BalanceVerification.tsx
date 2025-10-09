import React, { useState, useCallback } from 'react';
import { useEventSource } from '../hooks/useEventSource';
import type { EventType } from '../hooks/useEventSource';
import './BalanceVerification.css';

interface RcBalanceMigration {
  kept: string;
  migrated: string;
  timestamp: string;
}

interface AhBalancesBefore {
  checkingAccount: string;
  totalIssuance: string;
  timestamp: string;
}

interface AccountMigration {
  totalAccounts: number;
  timestamp: string;
}

const BalanceVerification: React.FC = () => {
  const [rcBalance, setRcBalance] = useState<RcBalanceMigration | null>(null);
  const [ahBalances, setAhBalances] = useState<AhBalancesBefore | null>(null);
  const [accountMigration, setAccountMigration] = useState<AccountMigration | null>(null);

  // Subscribe to RC balance migration events
  useEventSource(['rcBalanceMigration'], useCallback((eventType: EventType, data: RcBalanceMigration) => {
    if (eventType === 'rcBalanceMigration') {
      setRcBalance(data);
    }
  }, []));

  // Subscribe to AH balances before events
  useEventSource(['ahBalancesBefore'], useCallback((eventType: EventType, data: AhBalancesBefore) => {
    if (eventType === 'ahBalancesBefore') {
      setAhBalances(data);
    }
  }, []));

  // Subscribe to pallet migration update events for Accounts pallet
  useEventSource(['palletMigrationUpdate'], useCallback((eventType: EventType, data: any) => {
    if (eventType === 'palletMigrationUpdate' && data.palletName === 'Accounts') {
      setAccountMigration({
        totalAccounts: data.totalItemsProcessed || 0,
        timestamp: data.lastUpdated,
      });
    }
  }, []));

  // Subscribe to pallet migration summary for initial state
  useEventSource(['palletMigrationSummary'], useCallback((eventType: EventType, data: any) => {
    if (eventType === 'palletMigrationSummary' && data.pallets) {
      const accountsPallet = data.pallets.find((p: any) => p.palletName === 'Accounts');
      if (accountsPallet) {
        setAccountMigration({
          totalAccounts: accountsPallet.totalItemsProcessed || 0,
          timestamp: accountsPallet.lastUpdated,
        });
      }
    }
  }, []));

  // Format balance for display (assumes balance is in planck, convert to KSM)
  const formatBalance = (balance: string | null): string => {
    if (!balance) return '-';
    try {
      const num = BigInt(balance);
      const ksm = Number(num) / 1e12;
      return ksm.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }) + ' KSM';
    } catch {
      return 'Invalid';
    }
  };

  // Verify balances match
  const getVerificationStatus = (): { status: 'verified' | 'failed' | 'pending'; message: string } => {
    if (!rcBalance || !ahBalances) {
      return { status: 'pending', message: 'Waiting for balance data...' };
    }

    // For now, we don't have "after" balances from AH
    // This will be updated when we add that storage query
    // The verification would be: (AH After - AH Before) === RC Migrated

    return { status: 'pending', message: 'Balance verification will be available after migration completes' };
  };

  const verification = getVerificationStatus();

  return (
    <section className="card balance-verification">
      <div className="card-header">
        <h2 className="card-title">Balance Verification</h2>
      </div>

      <div className="balance-sections">
        {/* Relay Chain Section */}
        <div className="balance-section">
          <h3 className="balance-section-title">Relay Chain</h3>

          <div className="balance-metrics">
            <div className="balance-metric">
              <div className="balance-metric-label">Kept</div>
              <div className="balance-metric-value">
                {formatBalance(rcBalance?.kept || null)}
              </div>
            </div>

            <div className="balance-metric">
              <div className="balance-metric-label">Migrated</div>
              <div className="balance-metric-value balance-metric-highlight">
                {formatBalance(rcBalance?.migrated || null)}
              </div>
            </div>
          </div>
        </div>

        <div className="balance-divider"></div>

        {/* Asset Hub Section */}
        <div className="balance-section">
          <h3 className="balance-section-title">Asset Hub</h3>

          <div className="balance-metrics">
            <div className="balance-metric">
              <div className="balance-metric-label">Total Issuance Before Migration</div>
              <div className="balance-metric-value">
                {formatBalance(ahBalances?.totalIssuance || null)}
              </div>
            </div>

            <div className="balance-metric">
              <div className="balance-metric-label">Checking Account</div>
              <div className="balance-metric-value">
                {formatBalance(ahBalances?.checkingAccount || null)}
              </div>
            </div>
          </div>
        </div>

        <div className="balance-divider"></div>

        {/* Account Migration Section */}
        <div className="balance-section">
          <h3 className="balance-section-title">Account Migration</h3>

          <div className="balance-metrics">
            <div className="balance-metric">
              <div className="balance-metric-label">Total Accounts Migrated</div>
              <div className="balance-metric-value">
                {accountMigration?.totalAccounts.toLocaleString() || '0'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BalanceVerification;
