import type { Enum, Struct, Option, u32, u16, u64, Null, u128 } from '@polkadot/types';
import type { H256, AccountId32 } from '@polkadot/types/interfaces/runtime';
import type {
  FrameSupportScheduleDispatchTime,
  PolkadotRuntimeCommonImplsVersionedLocatableAsset,
} from '@polkadot/types/lookup';
import type { U8aFixed } from '@polkadot/types-codec';
import type { ITuple } from '@polkadot/types-codec/types';

/** @name PalletRcMigratorCall (440) */
interface PalletRcMigratorCall extends Enum {
  readonly isForceSetStage: boolean;
  readonly asForceSetStage: {
    readonly stage: PalletRcMigratorMigrationStage;
  } & Struct;
  readonly isScheduleMigration: boolean;
  readonly asScheduleMigration: {
    readonly startMoment: FrameSupportScheduleDispatchTime;
  } & Struct;
  readonly isStartDataMigration: boolean;
  readonly isUpdateAhMsgProcessedCount: boolean;
  readonly asUpdateAhMsgProcessedCount: {
    readonly count: u32;
  } & Struct;
  readonly type:
    | 'ForceSetStage'
    | 'ScheduleMigration'
    | 'StartDataMigration'
    | 'UpdateAhMsgProcessedCount';
}

export interface PalletRcMigratorAccountsMigratedBalances extends Struct {
  readonly kept: u128;
  readonly migrated: u128;
}

  /** @name PalletRcMigratorQueuePriority (552) */
export interface PalletRcMigratorQueuePriority extends Enum {
  readonly isConfig: boolean;
  readonly isOverrideConfig: boolean;
  readonly asOverrideConfig: ITuple<[u32, u32]>;
  readonly isDisabled: boolean;
  readonly type: 'Config' | 'OverrideConfig' | 'Disabled';
}

/** @name PalletRcMigratorMigrationStage (503) */
 export interface PalletRcMigratorMigrationStage extends Enum {
    readonly isPending: boolean;
    readonly isMigrationPaused: boolean;
    readonly isScheduled: boolean;
    readonly asScheduled: {
      readonly start: u32;
    } & Struct;
    readonly isWaitingForAh: boolean;
    readonly isWarmUp: boolean;
    readonly asWarmUp: {
      readonly endAt: u32;
    } & Struct;
    readonly isStarting: boolean;
    readonly isPureProxyCandidatesMigrationInit: boolean;
    readonly isAccountsMigrationInit: boolean;
    readonly isAccountsMigrationOngoing: boolean;
    readonly asAccountsMigrationOngoing: {
      readonly lastKey: Option<AccountId32>;
    } & Struct;
    readonly isAccountsMigrationDone: boolean;
    readonly isMultisigMigrationInit: boolean;
    readonly isMultisigMigrationOngoing: boolean;
    readonly asMultisigMigrationOngoing: {
      readonly lastKey: Option<ITuple<[AccountId32, U8aFixed]>>;
    } & Struct;
    readonly isMultisigMigrationDone: boolean;
    readonly isClaimsMigrationInit: boolean;
    readonly isClaimsMigrationOngoing: boolean;
    readonly asClaimsMigrationOngoing: {
      readonly currentKey: Option<PalletRcMigratorClaimsClaimsStage>;
    } & Struct;
    readonly isClaimsMigrationDone: boolean;
    readonly isProxyMigrationInit: boolean;
    readonly isProxyMigrationProxies: boolean;
    readonly asProxyMigrationProxies: {
      readonly lastKey: Option<AccountId32>;
    } & Struct;
    readonly isProxyMigrationAnnouncements: boolean;
    readonly asProxyMigrationAnnouncements: {
      readonly lastKey: Option<AccountId32>;
    } & Struct;
    readonly isProxyMigrationDone: boolean;
    readonly isPreimageMigrationInit: boolean;
    readonly isPreimageMigrationChunksOngoing: boolean;
    readonly asPreimageMigrationChunksOngoing: {
      readonly lastKey: Option<ITuple<[ITuple<[H256, u32]>, u32]>>;
    } & Struct;
    readonly isPreimageMigrationChunksDone: boolean;
    readonly isPreimageMigrationRequestStatusOngoing: boolean;
    readonly asPreimageMigrationRequestStatusOngoing: {
      readonly nextKey: Option<H256>;
    } & Struct;
    readonly isPreimageMigrationRequestStatusDone: boolean;
    readonly isPreimageMigrationLegacyRequestStatusInit: boolean;
    readonly isPreimageMigrationLegacyRequestStatusOngoing: boolean;
    readonly asPreimageMigrationLegacyRequestStatusOngoing: {
      readonly nextKey: Option<H256>;
    } & Struct;
    readonly isPreimageMigrationLegacyRequestStatusDone: boolean;
    readonly isPreimageMigrationDone: boolean;
    readonly isNomPoolsMigrationInit: boolean;
    readonly isNomPoolsMigrationOngoing: boolean;
    readonly asNomPoolsMigrationOngoing: {
      readonly nextKey: Option<PalletRcMigratorStakingNomPoolsNomPoolsStage>;
    } & Struct;
    readonly isNomPoolsMigrationDone: boolean;
    readonly isVestingMigrationInit: boolean;
    readonly isVestingMigrationOngoing: boolean;
    readonly asVestingMigrationOngoing: {
      readonly nextKey: Option<AccountId32>;
    } & Struct;
    readonly isVestingMigrationDone: boolean;
    readonly isDelegatedStakingMigrationInit: boolean;
    readonly isDelegatedStakingMigrationOngoing: boolean;
    readonly asDelegatedStakingMigrationOngoing: {
      readonly nextKey: Option<PalletRcMigratorStakingDelegatedStakingDelegatedStakingStage>;
    } & Struct;
    readonly isDelegatedStakingMigrationDone: boolean;
    readonly isIndicesMigrationInit: boolean;
    readonly isIndicesMigrationOngoing: boolean;
    readonly asIndicesMigrationOngoing: {
      readonly nextKey: Option<Null>;
    } & Struct;
    readonly isIndicesMigrationDone: boolean;
    readonly isReferendaMigrationInit: boolean;
    readonly isReferendaMigrationOngoing: boolean;
    readonly asReferendaMigrationOngoing: {
      readonly lastKey: Option<PalletRcMigratorReferendaReferendaStage>;
    } & Struct;
    readonly isReferendaMigrationDone: boolean;
    readonly isBagsListMigrationInit: boolean;
    readonly isBagsListMigrationOngoing: boolean;
    readonly asBagsListMigrationOngoing: {
      readonly nextKey: Option<PalletRcMigratorStakingBagsListBagsListStage>;
    } & Struct;
    readonly isBagsListMigrationDone: boolean;
    readonly isSchedulerMigrationInit: boolean;
    readonly isSchedulerMigrationOngoing: boolean;
    readonly asSchedulerMigrationOngoing: {
      readonly lastKey: Option<PalletRcMigratorSchedulerSchedulerStage>;
    } & Struct;
    readonly isSchedulerAgendaMigrationOngoing: boolean;
    readonly asSchedulerAgendaMigrationOngoing: {
      readonly lastKey: Option<u32>;
    } & Struct;
    readonly isSchedulerMigrationDone: boolean;
    readonly isConvictionVotingMigrationInit: boolean;
    readonly isConvictionVotingMigrationOngoing: boolean;
    readonly asConvictionVotingMigrationOngoing: {
      readonly lastKey: Option<PalletRcMigratorConvictionVotingConvictionVotingStage>;
    } & Struct;
    readonly isConvictionVotingMigrationDone: boolean;
    readonly isBountiesMigrationInit: boolean;
    readonly isBountiesMigrationOngoing: boolean;
    readonly asBountiesMigrationOngoing: {
      readonly lastKey: Option<PalletRcMigratorBountiesBountiesStage>;
    } & Struct;
    readonly isBountiesMigrationDone: boolean;
    readonly isChildBountiesMigrationInit: boolean;
    readonly isChildBountiesMigrationOngoing: boolean;
    readonly asChildBountiesMigrationOngoing: {
      readonly lastKey: Option<PalletRcMigratorChildBountiesChildBountiesStage>;
    } & Struct;
    readonly isChildBountiesMigrationDone: boolean;
    readonly isAssetRateMigrationInit: boolean;
    readonly isAssetRateMigrationOngoing: boolean;
    readonly asAssetRateMigrationOngoing: {
      readonly lastKey: Option<PolkadotRuntimeCommonImplsVersionedLocatableAsset>;
    } & Struct;
    readonly isAssetRateMigrationDone: boolean;
    readonly isCrowdloanMigrationInit: boolean;
    readonly isCrowdloanMigrationOngoing: boolean;
    readonly asCrowdloanMigrationOngoing: {
      readonly lastKey: Option<PalletRcMigratorCrowdloanCrowdloanStage>;
    } & Struct;
    readonly isCrowdloanMigrationDone: boolean;
    readonly isTreasuryMigrationInit: boolean;
    readonly isTreasuryMigrationOngoing: boolean;
    readonly asTreasuryMigrationOngoing: {
      readonly lastKey: Option<PalletRcMigratorTreasuryTreasuryStage>;
    } & Struct;
    readonly isTreasuryMigrationDone: boolean;
    readonly isRecoveryMigrationInit: boolean;
    readonly isRecoveryMigrationOngoing: boolean;
    readonly asRecoveryMigrationOngoing: {
      readonly lastKey: Option<PalletRcMigratorRecoveryRecoveryStage>;
    } & Struct;
    readonly isRecoveryMigrationDone: boolean;
    readonly isSocietyMigrationInit: boolean;
    readonly isSocietyMigrationOngoing: boolean;
    readonly asSocietyMigrationOngoing: {
      readonly lastKey: Option<PalletRcMigratorSocietySocietyStage>;
    } & Struct;
    readonly isSocietyMigrationDone: boolean;
    readonly isStakingMigrationInit: boolean;
    readonly isStakingMigrationOngoing: boolean;
    readonly asStakingMigrationOngoing: {
      readonly nextKey: Option<PalletRcMigratorStakingStakingStage>;
    } & Struct;
    readonly isStakingMigrationDone: boolean;
    readonly isCoolOff: boolean;
    readonly asCoolOff: {
      readonly endAt: u32;
    } & Struct;
    readonly isSignalMigrationFinish: boolean;
    readonly isMigrationDone: boolean;
    readonly type: 'Pending' | 'MigrationPaused' | 'Scheduled' | 'WaitingForAh' | 'WarmUp' | 'Starting' | 'PureProxyCandidatesMigrationInit' | 'AccountsMigrationInit' | 'AccountsMigrationOngoing' | 'AccountsMigrationDone' | 'MultisigMigrationInit' | 'MultisigMigrationOngoing' | 'MultisigMigrationDone' | 'ClaimsMigrationInit' | 'ClaimsMigrationOngoing' | 'ClaimsMigrationDone' | 'ProxyMigrationInit' | 'ProxyMigrationProxies' | 'ProxyMigrationAnnouncements' | 'ProxyMigrationDone' | 'PreimageMigrationInit' | 'PreimageMigrationChunksOngoing' | 'PreimageMigrationChunksDone' | 'PreimageMigrationRequestStatusOngoing' | 'PreimageMigrationRequestStatusDone' | 'PreimageMigrationLegacyRequestStatusInit' | 'PreimageMigrationLegacyRequestStatusOngoing' | 'PreimageMigrationLegacyRequestStatusDone' | 'PreimageMigrationDone' | 'NomPoolsMigrationInit' | 'NomPoolsMigrationOngoing' | 'NomPoolsMigrationDone' | 'VestingMigrationInit' | 'VestingMigrationOngoing' | 'VestingMigrationDone' | 'DelegatedStakingMigrationInit' | 'DelegatedStakingMigrationOngoing' | 'DelegatedStakingMigrationDone' | 'IndicesMigrationInit' | 'IndicesMigrationOngoing' | 'IndicesMigrationDone' | 'ReferendaMigrationInit' | 'ReferendaMigrationOngoing' | 'ReferendaMigrationDone' | 'BagsListMigrationInit' | 'BagsListMigrationOngoing' | 'BagsListMigrationDone' | 'SchedulerMigrationInit' | 'SchedulerMigrationOngoing' | 'SchedulerAgendaMigrationOngoing' | 'SchedulerMigrationDone' | 'ConvictionVotingMigrationInit' | 'ConvictionVotingMigrationOngoing' | 'ConvictionVotingMigrationDone' | 'BountiesMigrationInit' | 'BountiesMigrationOngoing' | 'BountiesMigrationDone' | 'ChildBountiesMigrationInit' | 'ChildBountiesMigrationOngoing' | 'ChildBountiesMigrationDone' | 'AssetRateMigrationInit' | 'AssetRateMigrationOngoing' | 'AssetRateMigrationDone' | 'CrowdloanMigrationInit' | 'CrowdloanMigrationOngoing' | 'CrowdloanMigrationDone' | 'TreasuryMigrationInit' | 'TreasuryMigrationOngoing' | 'TreasuryMigrationDone' | 'RecoveryMigrationInit' | 'RecoveryMigrationOngoing' | 'RecoveryMigrationDone' | 'SocietyMigrationInit' | 'SocietyMigrationOngoing' | 'SocietyMigrationDone' | 'StakingMigrationInit' | 'StakingMigrationOngoing' | 'StakingMigrationDone' | 'CoolOff' | 'SignalMigrationFinish' | 'MigrationDone';
  }

/** @name PalletRcMigratorChildBountiesChildBountiesStage (531) */
interface PalletRcMigratorChildBountiesChildBountiesStage extends Enum {
    readonly isChildBountyCount: boolean;
    readonly isParentChildBounties: boolean;
    readonly asParentChildBounties: {
      readonly parentId: Option<u32>;
    } & Struct;
    readonly isParentTotalChildBounties: boolean;
    readonly asParentTotalChildBounties: {
      readonly parentId: Option<u32>;
    } & Struct;
    readonly isChildBounties: boolean;
    readonly asChildBounties: {
      readonly ids: Option<ITuple<[u32, u32]>>;
    } & Struct;
    readonly isChildBountyDescriptionsV1: boolean;
    readonly asChildBountyDescriptionsV1: {
      readonly ids: Option<ITuple<[u32, u32]>>;
    } & Struct;
    readonly isV0ToV1ChildBountyIds: boolean;
    readonly asV0ToV1ChildBountyIds: {
      readonly childId: Option<u32>;
    } & Struct;
    readonly isChildrenCuratorFees: boolean;
    readonly asChildrenCuratorFees: {
      readonly childId: Option<u32>;
    } & Struct;
    readonly isFinished: boolean;
    readonly type: 'ChildBountyCount' | 'ParentChildBounties' | 'ParentTotalChildBounties' | 'ChildBounties' | 'ChildBountyDescriptionsV1' | 'V0ToV1ChildBountyIds' | 'ChildrenCuratorFees' | 'Finished';
  }

/** @name PalletRcMigratorStakingDelegatedStakingDelegatedStakingStage (515) */
interface PalletRcMigratorStakingDelegatedStakingDelegatedStakingStage extends Enum {
    readonly isDelegators: boolean;
    readonly asDelegators: Option<AccountId32>;
    readonly isAgents: boolean;
    readonly asAgents: Option<AccountId32>;
    readonly isFinished: boolean;
    readonly type: 'Delegators' | 'Agents' | 'Finished';
  }

/** @name PalletRcMigratorSocietySocietyStage (543) */
interface PalletRcMigratorSocietySocietyStage extends Enum {
    readonly isValues: boolean;
    readonly isMembers: boolean;
    readonly asMembers: Option<AccountId32>;
    readonly isPayouts: boolean;
    readonly asPayouts: Option<AccountId32>;
    readonly isMemberByIndex: boolean;
    readonly asMemberByIndex: Option<u32>;
    readonly isSuspendedMembers: boolean;
    readonly asSuspendedMembers: Option<AccountId32>;
    readonly isCandidates: boolean;
    readonly asCandidates: Option<AccountId32>;
    readonly isVotes: boolean;
    readonly asVotes: Option<ITuple<[AccountId32, AccountId32]>>;
    readonly isVoteClearCursor: boolean;
    readonly asVoteClearCursor: Option<AccountId32>;
    readonly isDefenderVotes: boolean;
    readonly asDefenderVotes: Option<ITuple<[u32, AccountId32]>>;
    readonly isFinished: boolean;
    readonly type: 'Values' | 'Members' | 'Payouts' | 'MemberByIndex' | 'SuspendedMembers' | 'Candidates' | 'Votes' | 'VoteClearCursor' | 'DefenderVotes' | 'Finished';
  }

/** @name PalletRcMigratorRecoveryRecoveryStage (539) */
interface PalletRcMigratorRecoveryRecoveryStage extends Enum {
    readonly isRecoverable: boolean;
    readonly asRecoverable: Option<AccountId32>;
    readonly isActiveRecoveries: boolean;
    readonly asActiveRecoveries: Option<ITuple<[AccountId32, AccountId32]>>;
    readonly isProxy: boolean;
    readonly asProxy: Option<AccountId32>;
    readonly isFinished: boolean;
    readonly type: 'Recoverable' | 'ActiveRecoveries' | 'Proxy' | 'Finished';
  }

interface PalletRcMigratorStakingStakingStage extends Enum {
  readonly isValues: boolean;
  readonly isInvulnerables: boolean;
  readonly isBonded: boolean;
  readonly asBonded: Option<AccountId32>;
  readonly isLedger: boolean;
  readonly asLedger: Option<AccountId32>;
  readonly isPayee: boolean;
  readonly asPayee: Option<AccountId32>;
  readonly isValidators: boolean;
  readonly asValidators: Option<AccountId32>;
  readonly isNominators: boolean;
  readonly asNominators: Option<AccountId32>;
  readonly isVirtualStakers: boolean;
  readonly asVirtualStakers: Option<AccountId32>;
  readonly isErasStakersOverview: boolean;
  readonly asErasStakersOverview: Option<ITuple<[u32, AccountId32]>>;
  readonly isErasStakersPaged: boolean;
  readonly asErasStakersPaged: Option<ITuple<[u32, AccountId32, u32]>>;
  readonly isClaimedRewards: boolean;
  readonly asClaimedRewards: Option<ITuple<[u32, AccountId32]>>;
  readonly isErasValidatorPrefs: boolean;
  readonly asErasValidatorPrefs: Option<ITuple<[u32, AccountId32]>>;
  readonly isErasValidatorReward: boolean;
  readonly asErasValidatorReward: Option<u32>;
  readonly isErasRewardPoints: boolean;
  readonly asErasRewardPoints: Option<u32>;
  readonly isErasTotalStake: boolean;
  readonly asErasTotalStake: Option<u32>;
  readonly isUnappliedSlashes: boolean;
  readonly asUnappliedSlashes: Option<u32>;
  readonly isBondedEras: boolean;
  readonly isValidatorSlashInEra: boolean;
  readonly asValidatorSlashInEra: Option<ITuple<[u32, AccountId32]>>;
  readonly isNominatorSlashInEra: boolean;
  readonly asNominatorSlashInEra: Option<ITuple<[u32, AccountId32]>>;
  readonly isFinished: boolean;
  readonly type:
    | 'Values'
    | 'Invulnerables'
    | 'Bonded'
    | 'Ledger'
    | 'Payee'
    | 'Validators'
    | 'Nominators'
    | 'VirtualStakers'
    | 'ErasStakersOverview'
    | 'ErasStakersPaged'
    | 'ClaimedRewards'
    | 'ErasValidatorPrefs'
    | 'ErasValidatorReward'
    | 'ErasRewardPoints'
    | 'ErasTotalStake'
    | 'UnappliedSlashes'
    | 'BondedEras'
    | 'ValidatorSlashInEra'
    | 'NominatorSlashInEra'
    | 'Finished';
}

/** @name PalletRcMigratorClaimsClaimsStage (445) */
interface PalletRcMigratorClaimsClaimsStage extends Enum {
  readonly isStorageValues: boolean;
  readonly isClaims: boolean;
  readonly asClaims: Option<PalletRcMigratorClaimsAliasEthereumAddress>;
  readonly isVesting: boolean;
  readonly asVesting: Option<PalletRcMigratorClaimsAliasEthereumAddress>;
  readonly isSigning: boolean;
  readonly asSigning: Option<PalletRcMigratorClaimsAliasEthereumAddress>;
  readonly isPreclaims: boolean;
  readonly asPreclaims: Option<AccountId32>;
  readonly isFinished: boolean;
  readonly type: 'StorageValues' | 'Claims' | 'Vesting' | 'Signing' | 'Preclaims' | 'Finished';
}

/** @name PalletRcMigratorClaimsAliasEthereumAddress (447) */
interface PalletRcMigratorClaimsAliasEthereumAddress extends U8aFixed {}

/** @name PalletRcMigratorStakingNomPoolsNomPoolsStage (452) */
interface PalletRcMigratorStakingNomPoolsNomPoolsStage extends Enum {
  readonly isStorageValues: boolean;
  readonly isPoolMembers: boolean;
  readonly asPoolMembers: Option<AccountId32>;
  readonly isBondedPools: boolean;
  readonly asBondedPools: Option<u32>;
  readonly isRewardPools: boolean;
  readonly asRewardPools: Option<u32>;
  readonly isSubPoolsStorage: boolean;
  readonly asSubPoolsStorage: Option<u32>;
  readonly isMetadata: boolean;
  readonly asMetadata: Option<u32>;
  readonly isReversePoolIdLookup: boolean;
  readonly asReversePoolIdLookup: Option<AccountId32>;
  readonly isClaimPermissions: boolean;
  readonly asClaimPermissions: Option<AccountId32>;
  readonly isFinished: boolean;
  readonly type:
    | 'StorageValues'
    | 'PoolMembers'
    | 'BondedPools'
    | 'RewardPools'
    | 'SubPoolsStorage'
    | 'Metadata'
    | 'ReversePoolIdLookup'
    | 'ClaimPermissions'
    | 'Finished';
}

/** @name PalletRcMigratorStakingFastUnstakeFastUnstakeStage (454) */
interface PalletRcMigratorStakingFastUnstakeFastUnstakeStage extends Enum {
  readonly isStorageValues: boolean;
  readonly isQueue: boolean;
  readonly asQueue: Option<AccountId32>;
  readonly isFinished: boolean;
  readonly type: 'StorageValues' | 'Queue' | 'Finished';
}

/** @name PalletRcMigratorReferendaReferendaStage (457) */
interface PalletRcMigratorReferendaReferendaStage extends Enum {
  readonly isStorageValues: boolean;
  readonly isMetadata: boolean;
  readonly asMetadata: Option<u32>;
  readonly isReferendumInfo: boolean;
  readonly asReferendumInfo: Option<u32>;
  readonly type: 'StorageValues' | 'Metadata' | 'ReferendumInfo';
}

/** @name PalletRcMigratorStakingBagsListBagsListStage (459) */
interface PalletRcMigratorStakingBagsListBagsListStage extends Enum {
  readonly isListNodes: boolean;
  readonly asListNodes: Option<AccountId32>;
  readonly isListBags: boolean;
  readonly asListBags: Option<u64>;
  readonly isFinished: boolean;
  readonly type: 'ListNodes' | 'ListBags' | 'Finished';
}

/** @name PalletRcMigratorSchedulerSchedulerStage (462) */
interface PalletRcMigratorSchedulerSchedulerStage extends Enum {
  readonly isIncompleteSince: boolean;
  readonly isRetries: boolean;
  readonly asRetries: Option<ITuple<[u32, u32]>>;
  readonly isLookup: boolean;
  readonly asLookup: Option<U8aFixed>;
  readonly isFinished: boolean;
  readonly type: 'IncompleteSince' | 'Retries' | 'Lookup' | 'Finished';
}

/** @name PalletRcMigratorConvictionVotingConvictionVotingStage (464) */
interface PalletRcMigratorConvictionVotingConvictionVotingStage extends Enum {
  readonly isVotingFor: boolean;
  readonly asVotingFor: Option<ITuple<[AccountId32, u16]>>;
  readonly isClassLocksFor: boolean;
  readonly asClassLocksFor: Option<AccountId32>;
  readonly isFinished: boolean;
  readonly type: 'VotingFor' | 'ClassLocksFor' | 'Finished';
}

/** @name PalletRcMigratorBountiesBountiesStage (468) */
interface PalletRcMigratorBountiesBountiesStage extends Enum {
  readonly isBountyCount: boolean;
  readonly isBountyApprovals: boolean;
  readonly isBountyDescriptions: boolean;
  readonly asBountyDescriptions: {
    readonly lastKey: Option<u32>;
  } & Struct;
  readonly isBounties: boolean;
  readonly asBounties: {
    readonly lastKey: Option<u32>;
  } & Struct;
  readonly isFinished: boolean;
  readonly type: 'BountyCount' | 'BountyApprovals' | 'BountyDescriptions' | 'Bounties' | 'Finished';
}

/** @name PalletRcMigratorCrowdloanCrowdloanStage (471) */
interface PalletRcMigratorCrowdloanCrowdloanStage extends Enum {
  readonly isSetup: boolean;
  readonly isLeaseReserve: boolean;
  readonly asLeaseReserve: {
    readonly lastKey: Option<u32>;
  } & Struct;
  readonly isCrowdloanContribution: boolean;
  readonly asCrowdloanContribution: {
    readonly lastKey: Option<u32>;
  } & Struct;
  readonly isCrowdloanReserve: boolean;
  readonly isFinished: boolean;
  readonly type:
    | 'Setup'
    | 'LeaseReserve'
    | 'CrowdloanContribution'
    | 'CrowdloanReserve'
    | 'Finished';
}

/** @name PalletRcMigratorTreasuryTreasuryStage (474) */
interface PalletRcMigratorTreasuryTreasuryStage extends Enum {
  readonly isProposalCount: boolean;
  readonly isProposals: boolean;
  readonly asProposals: Option<u32>;
  readonly isApprovals: boolean;
  readonly isSpendCount: boolean;
  readonly isSpends: boolean;
  readonly asSpends: Option<u32>;
  readonly isFunds: boolean;
  readonly isFinished: boolean;
  readonly type:
    | 'ProposalCount'
    | 'Proposals'
    | 'Approvals'
    | 'SpendCount'
    | 'Spends'
    | 'Funds'
    | 'Finished';
}

export interface PalletRcMigratorAccountsMigratedBalances extends Struct {
  readonly kept: u128;
  readonly migrated: u128;
}
