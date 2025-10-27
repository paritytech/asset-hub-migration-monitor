// Migration pallets in order (updated for Polkadot)
// Note: PureProxyCandidates is excluded as it's an internal initialization stage, not a tracked migration
// Note: Recovery and Society pallets removed for Polkadot (were only in Kusama)
export const MIGRATION_PALLETS = [
  'Accounts',
  'Multisig',
  'Claims',
  'Proxy',
  'Preimage',
  'NomPools',
  'Vesting',
  'DelegatedStaking',
  'Indices',
  'Referenda',
  'BagsList',
  'Scheduler',
  'ConvictionVoting',
  'Bounties',
  'ChildBounties',
  'AssetRate',
  'Crowdloan',
  'Treasury',
  'Staking'
]; 