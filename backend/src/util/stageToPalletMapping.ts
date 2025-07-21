// Mapping from migration stages to pallet names
export const STAGE_TO_PALLET_MAP: Record<string, string> = {
  // Account-related stages
  AccountsMigrationInit: 'Accounts',
  AccountsMigrationOngoing: 'Accounts',
  AccountsMigrationDone: 'Accounts',

  // Multisig stages
  MultisigMigrationInit: 'Multisig',
  MultisigMigrationOngoing: 'Multisig',
  MultisigMigrationDone: 'Multisig',

  // Claims stages
  ClaimsMigrationDone: 'Claims',

  // Proxy stages
  ProxyMigrationInit: 'Proxy',
  ProxyMigrationOngoing: 'Proxy',
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

  // Fast Unstake stages
  FastUnstakeMigrationInit: 'FastUnstake',
  FastUnstakeMigrationOngoing: 'FastUnstake',
  FastUnstakeMigrationDone: 'FastUnstake',

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
  BountiesMigrationDone: 'Bounties',

  // Asset Rate stages
  AssetRateMigrationInit: 'AssetRate',
  AssetRateMigrationOngoing: 'AssetRate',
  AssetRateMigrationDone: 'AssetRate',

  // Crowdloan stages
  CrowdloanMigrationDone: 'Crowdloan',

  // Treasury stages
  TreasuryMigrationDone: 'Treasury',

  // Staking stages
  StakingMigrationInit: 'Staking',
  StakingMigrationOngoing: 'Staking',
  StakingMigrationDone: 'Staking',
};

// Reverse mapping from pallet names to stage names
export const PALLET_TO_STAGE_MAP: Record<string, string[]> = {
  Balances: ['AccountsMigrationInit', 'AccountsMigrationOngoing', 'AccountsMigrationDone'],
  Accounts: ['AccountsMigrationInit', 'AccountsMigrationOngoing', 'AccountsMigrationDone'],
  Multisig: ['MultisigMigrationInit', 'MultisigMigrationOngoing', 'MultisigMigrationDone'],
  Claims: ['ClaimsMigrationDone'],
  Proxy: [
    'ProxyMigrationInit',
    'ProxyMigrationOngoing',
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
  FastUnstake: [
    'FastUnstakeMigrationInit',
    'FastUnstakeMigrationOngoing',
    'FastUnstakeMigrationDone',
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
  Bounties: ['BountiesMigrationDone'],
  AssetRate: ['AssetRateMigrationInit', 'AssetRateMigrationOngoing', 'AssetRateMigrationDone'],
  Crowdloan: ['CrowdloanMigrationDone'],
  Treasury: ['TreasuryMigrationDone'],
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
