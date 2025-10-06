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
  liquidAccounts: number;
  nonLiquidAccounts: number;
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

  // Subscribe to account migration events
  useEventSource(['accountMigration'], useCallback((eventType: EventType, data: AccountMigration) => {
    if (eventType === 'accountMigration') {
      setAccountMigration(data);
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
              <div className="balance-metric-label">Total Migrated</div>
              <div className="balance-metric-value">
                {accountMigration?.totalAccounts.toLocaleString() || '0'}
              </div>
            </div>

            <div className="balance-metric">
              <div className="balance-metric-label">Liquid</div>
              <div className="balance-metric-value">
                {accountMigration?.liquidAccounts.toLocaleString() || '0'}
              </div>
            </div>

            <div className="balance-metric">
              <div className="balance-metric-label">Non-Liquid</div>
              <div className="balance-metric-value">
                {accountMigration?.nonLiquidAccounts.toLocaleString() || '0'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Verification Status */}
      <div className={`verification-status verification-${verification.status}`}>
        <div className="verification-icon">
          {verification.status === 'verified' && '✓'}
          {verification.status === 'failed' && '✗'}
          {verification.status === 'pending' && '⋯'}
        </div>
        <div className="verification-message">{verification.message}</div>
      </div>
    </section>
  );
};

export default BalanceVerification;
