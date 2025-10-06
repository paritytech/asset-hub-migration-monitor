// Mapping from migration stages to pallet names (updated for Kusama)
export const STAGE_TO_PALLET_MAP: Record<string, string> = {
  // Pure Proxy Candidates - Internal initialization stage, not tracked for migration progress
  // PureProxyCandidatesMigrationInit: 'PureProxyCandidates', // Excluded from tracking

  // Account-related stages
  AccountsMigrationInit: 'Accounts',
  AccountsMigrationOngoing: 'Accounts',
  AccountsMigrationDone: 'Accounts',

  // Multisig stages
  MultisigMigrationInit: 'Multisig',
  MultisigMigrationOngoing: 'Multisig',
  MultisigMigrationDone: 'Multisig',

  // Claims stages
  ClaimsMigrationInit: 'Claims',
  ClaimsMigrationOngoing: 'Claims',
  ClaimsMigrationDone: 'Claims',

  // Proxy stages
  ProxyMigrationInit: 'Proxy',
  ProxyMigrationProxies: 'Proxy',
  ProxyMigrationAnnouncements: 'Proxy',
  ProxyMigrationDone: 'Proxy',

  // Preimage stages
  PreimageMigrationInit: 'Preimage',
  PreimageMigrationChunksOngoing: 'Preimage',
  PreimageMigrationChunksDone: 'Preimage',
  PreimageMigrationRequestStatusOngoing: 'Preimage',
  PreimageMigrationRequestStatusDone: 'Preimage',
  PreimageMigrationLegacyRequestStatusInit: 'Preimage',
  PreimageMigrationLegacyRequestStatusOngoing: 'Preimage',
  PreimageMigrationLegacyRequestStatusDone: 'Preimage',
  PreimageMigrationDone: 'Preimage',

  // Nomination Pools stages
  NomPoolsMigrationInit: 'NomPools',
  NomPoolsMigrationOngoing: 'NomPools',
  NomPoolsMigrationDone: 'NomPools',

  // Vesting stages
  VestingMigrationInit: 'Vesting',
  VestingMigrationOngoing: 'Vesting',
  VestingMigrationDone: 'Vesting',

  // Delegated Staking stages
  DelegatedStakingMigrationInit: 'DelegatedStaking',
  DelegatedStakingMigrationOngoing: 'DelegatedStaking',
  DelegatedStakingMigrationDone: 'DelegatedStaking',

  // Indices stages
  IndicesMigrationInit: 'Indices',
  IndicesMigrationOngoing: 'Indices',
  IndicesMigrationDone: 'Indices',

  // Referenda stages
  ReferendaMigrationInit: 'Referenda',
  ReferendaMigrationOngoing: 'Referenda',
  ReferendaMigrationDone: 'Referenda',

  // Bags List stages
  BagsListMigrationInit: 'BagsList',
  BagsListMigrationOngoing: 'BagsList',
  BagsListMigrationDone: 'BagsList',

  // Scheduler stages
  SchedulerMigrationInit: 'Scheduler',
  SchedulerMigrationOngoing: 'Scheduler',
  SchedulerAgendaMigrationOngoing: 'Scheduler',
  SchedulerMigrationDone: 'Scheduler',

  // Conviction Voting stages
  ConvictionVotingMigrationInit: 'ConvictionVoting',
  ConvictionVotingMigrationOngoing: 'ConvictionVoting',
  ConvictionVotingMigrationDone: 'ConvictionVoting',

  // Bounties stages
  BountiesMigrationInit: 'Bounties',
  BountiesMigrationOngoing: 'Bounties',
  BountiesMigrationDone: 'Bounties',

  // Child Bounties stages
  ChildBountiesMigrationInit: 'ChildBounties',
  ChildBountiesMigrationOngoing: 'ChildBounties',
  ChildBountiesMigrationDone: 'ChildBounties',

  // Asset Rate stages
  AssetRateMigrationInit: 'AssetRate',
  AssetRateMigrationOngoing: 'AssetRate',
  AssetRateMigrationDone: 'AssetRate',

  // Crowdloan stages
  CrowdloanMigrationInit: 'Crowdloan',
  CrowdloanMigrationOngoing: 'Crowdloan',
  CrowdloanMigrationDone: 'Crowdloan',

  // Treasury stages
  TreasuryMigrationInit: 'Treasury',
  TreasuryMigrationOngoing: 'Treasury',
  TreasuryMigrationDone: 'Treasury',

  // Recovery stages
  RecoveryMigrationInit: 'Recovery',
  RecoveryMigrationOngoing: 'Recovery',
  RecoveryMigrationDone: 'Recovery',

  // Society stages
  SocietyMigrationInit: 'Society',
  SocietyMigrationOngoing: 'Society',
  SocietyMigrationDone: 'Society',

  // Staking stages
  StakingMigrationInit: 'Staking',
  StakingMigrationOngoing: 'Staking',
  StakingMigrationDone: 'Staking',
};

// Reverse mapping from pallet names to stage names (updated for Kusama)
export const PALLET_TO_STAGE_MAP: Record<string, string[]> = {
  // PureProxyCandidates excluded - internal initialization stage only
  Accounts: ['AccountsMigrationInit', 'AccountsMigrationOngoing', 'AccountsMigrationDone'],
  Multisig: ['MultisigMigrationInit', 'MultisigMigrationOngoing', 'MultisigMigrationDone'],
  Claims: ['ClaimsMigrationInit', 'ClaimsMigrationOngoing', 'ClaimsMigrationDone'],
  Proxy: [
    'ProxyMigrationInit',
    'ProxyMigrationProxies',
    'ProxyMigrationAnnouncements',
    'ProxyMigrationDone',
  ],
  Preimage: [
    'PreimageMigrationInit',
    'PreimageMigrationChunksOngoing',
    'PreimageMigrationChunksDone',
    'PreimageMigrationRequestStatusOngoing',
    'PreimageMigrationRequestStatusDone',
    'PreimageMigrationLegacyRequestStatusInit',
    'PreimageMigrationLegacyRequestStatusOngoing',
    'PreimageMigrationLegacyRequestStatusDone',
    'PreimageMigrationDone',
  ],
  NomPools: ['NomPoolsMigrationInit', 'NomPoolsMigrationOngoing', 'NomPoolsMigrationDone'],
  Vesting: ['VestingMigrationInit', 'VestingMigrationOngoing', 'VestingMigrationDone'],
  DelegatedStaking: [
    'DelegatedStakingMigrationInit',
    'DelegatedStakingMigrationOngoing',
    'DelegatedStakingMigrationDone',
  ],
  Indices: ['IndicesMigrationInit', 'IndicesMigrationOngoing', 'IndicesMigrationDone'],
  Referenda: ['ReferendaMigrationInit', 'ReferendaMigrationOngoing', 'ReferendaMigrationDone'],
  BagsList: ['BagsListMigrationInit', 'BagsListMigrationOngoing', 'BagsListMigrationDone'],
  Scheduler: [
    'SchedulerMigrationInit',
    'SchedulerMigrationOngoing',
    'SchedulerAgendaMigrationOngoing',
    'SchedulerMigrationDone',
  ],
  ConvictionVoting: [
    'ConvictionVotingMigrationInit',
    'ConvictionVotingMigrationOngoing',
    'ConvictionVotingMigrationDone',
  ],
  Bounties: ['BountiesMigrationInit', 'BountiesMigrationOngoing', 'BountiesMigrationDone'],
  ChildBounties: [
    'ChildBountiesMigrationInit',
    'ChildBountiesMigrationOngoing',
    'ChildBountiesMigrationDone',
  ],
  AssetRate: ['AssetRateMigrationInit', 'AssetRateMigrationOngoing', 'AssetRateMigrationDone'],
  Crowdloan: ['CrowdloanMigrationInit', 'CrowdloanMigrationOngoing', 'CrowdloanMigrationDone'],
  Treasury: ['TreasuryMigrationInit', 'TreasuryMigrationOngoing', 'TreasuryMigrationDone'],
  Recovery: ['RecoveryMigrationInit', 'RecoveryMigrationOngoing', 'RecoveryMigrationDone'],
  Society: ['SocietyMigrationInit', 'SocietyMigrationOngoing', 'SocietyMigrationDone'],
  Staking: ['StakingMigrationInit', 'StakingMigrationOngoing', 'StakingMigrationDone'],
};

// Helper function to get pallet name from stage
export function getPalletFromStage(stage: string): string | null {
  return STAGE_TO_PALLET_MAP[stage] || null;
}

// Helper function to get stage names from pallet name
export function getStagesFromPallet(pallet: string): string[] {
  return PALLET_TO_STAGE_MAP[pallet] || [];
}

// Helper function to get the current active stage for a pallet
export function getCurrentStageForPallet(pallet: string): string | null {
  const stages = getStagesFromPallet(pallet);
  if (stages.length === 0) return null;

  // Return the first ongoing stage, or the last stage if no ongoing stages
  const ongoingStage = stages.find(stage => stage.includes('Ongoing'));
  if (ongoingStage) return ongoingStage;

  return stages[stages.length - 1];
}

// Helper function to check if a stage is an Init stage
export function isInitStage(stage: string): boolean {
  return stage.includes('Init');
}

// Helper function to check if a stage is an Ongoing stage
export function isOngoingStage(stage: string): boolean {
  return stage.includes('Ongoing');
}

// Helper function to check if a stage is a Done stage
export function isDoneStage(stage: string): boolean {
  return stage.includes('Done') || stage.includes('Finish');
}

// Helper function to check if a stage is active (ongoing)
export function isStageActive(stage: string): boolean {
  return isOngoingStage(stage) || isInitStage(stage);
}

// Helper function to check if a stage is completed
export function isStageCompleted(stage: string): boolean {
  return isDoneStage(stage);
}

// Helper function to get the Init stage name for a pallet
export function getInitStageForPallet(pallet: string): string {
  return `${pallet}MigrationInit`;
}

// Helper function to get the Done stage name for a pallet
export function getDoneStageForPallet(pallet: string): string {
  return `${pallet}MigrationDone`;
}

// Mapping from on-chain event pallet names to our internal pallet names
const EVENT_PALLET_NAME_MAP: Record<string, string> = {
  // Direct mappings
  'Balances': 'Accounts',

  // Proxy sub-pallets - all map to single Proxy pallet
  'Proxy': 'Proxy',
  'ProxyProxies': 'Proxy',
  'ProxyAnnouncements': 'Proxy',

  // Preimage sub-pallets - all map to single Preimage pallet
  'Preimage': 'Preimage',
  'PreimageLegacyStatus': 'Preimage',
  'PreimageRequestStatus': 'Preimage',
  'PreimageChunk': 'Preimage',

  // Referenda sub-pallets - all map to single Referenda pallet
  'Referenda': 'Referenda',
  'ReferendaReferendums': 'Referenda',
  'ReferendaValues': 'Referenda',

  // AssetRate variants - all map to AssetRate pallet
  'AssetRate': 'AssetRate',
  'AssetRates': 'AssetRate',

  // Scheduler variants - all map to Scheduler pallet
  'Scheduler': 'Scheduler',
  'SchedulerAgenda': 'Scheduler',
};

// Helper function to normalize event pallet names to internal pallet names
export function normalizeEventPalletName(eventPalletName: string): string {
  return EVENT_PALLET_NAME_MAP[eventPalletName] || eventPalletName;
}
