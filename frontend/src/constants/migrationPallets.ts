// Migration pallets in order (updated for Kusama)
// Note: PureProxyCandidates is excluded as it's an internal initialization stage, not a tracked migration
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
  'Recovery',
  'Society',
  'Staking'
]; 