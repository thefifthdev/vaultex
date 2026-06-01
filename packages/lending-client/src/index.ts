import { Buffer } from 'buffer';
import { Address } from '@stellar/stellar-sdk';
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from '@stellar/stellar-sdk/contract';
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from '@stellar/stellar-sdk/contract';
export * from '@stellar/stellar-sdk';
export * as contract from '@stellar/stellar-sdk/contract';
export * as rpc from '@stellar/stellar-sdk/rpc';

if (typeof window !== 'undefined') {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}

export const networks = {
  testnet: {
    networkPassphrase: 'Test SDF Network ; September 2015',
    contractId: 'CBAPGTVW3IUEIGUEE4JPB35GLBTBRMJS7ZBYO7H75CFSOONIPF4TGG7T',
  },
} as const;

/**
 * Errors returned by the Vaultex lending pool.
 */
export const Errors = {
  /**
   * Contract has already been initialized.
   */
  1: { message: 'AlreadyInitialized' },
  /**
   * Contract has not been initialized.
   */
  2: { message: 'NotInitialized' },
  /**
   * Amount must be strictly greater than zero.
   */
  3: { message: 'InvalidAmount' },
  /**
   * A configuration parameter (e.g. LTV / threshold / APR) is out of range.
   */
  4: { message: 'InvalidConfig' },
  /**
   * Not enough free liquidity in the pool to satisfy the request.
   */
  5: { message: 'InsufficientLiquidity' },
  /**
   * The borrower has no position.
   */
  6: { message: 'NoPosition' },
  /**
   * The lender has no shares.
   */
  7: { message: 'NoShares' },
  /**
   * The requested action would push the position above its borrow limit.
   */
  8: { message: 'Undercollateralized' },
  /**
   * The position is healthy and cannot be liquidated.
   */
  9: { message: 'NotLiquidatable' },
  /**
   * Repay/withdraw amount exceeds the outstanding balance.
   */
  10: { message: 'AmountTooHigh' },
};

/**
 * Aggregate pool accounting (instance storage).
 */
export interface Pool {
  /**
   * Total outstanding borrowed principal.
   */
  total_borrowed: i128;
  /**
   * Total underlying borrow-token backing LP shares (grows with interest).
   */
  total_deposited: i128;
  /**
   * Total LP shares issued.
   */
  total_shares: i128;
}

/**
 * Pool configuration, set once at construction.
 *
 * For MVP simplicity the borrow and collateral tokens are assumed to be valued
 * 1:1 (e.g. two stablecoins), so no price oracle is required — matching the
 * "no oracle dependency for stablecoin pairs" design.
 */
export interface Config {
  /**
   * Fixed borrow APR in basis points (e.g. 1000 = 10%/yr).
   */
  apr_bps: u32;
  /**
   * The asset lenders deposit and borrowers borrow.
   */
  borrow_token: string;
  /**
   * The asset borrowers post as collateral.
   */
  collateral_token: string;
  /**
   * Liquidation bonus in basis points (e.g. 1000 = 10%).
   */
  liquidation_bonus_bps: u32;
  /**
   * Liquidation threshold in basis points (e.g. 8500 = 85%).
   */
  liquidation_threshold_bps: u32;
  /**
   * Max loan-to-value in basis points (e.g. 7500 = 75%).
   */
  ltv_bps: u32;
}

/**
 * Storage keys.
 */
export type DataKey =
  | { tag: 'Config'; values: void }
  | { tag: 'Pool'; values: void }
  | { tag: 'Shares'; values: readonly [string] }
  | { tag: 'Position'; values: readonly [string] };

/**
 * A borrower's position (persistent, keyed by address).
 */
export interface Position {
  /**
   * Interest accrued but not yet repaid.
   */
  accrued_interest: i128;
  /**
   * Collateral posted, in collateral-token units.
   */
  collateral: i128;
  /**
   * Ledger timestamp of the last interest accrual.
   */
  last_accrual: u64;
  /**
   * Outstanding borrowed principal, in borrow-token units.
   */
  principal: i128;
}

export interface Client {
  /**
   * Construct and simulate a repay transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Repay outstanding debt (interest first, then principal). Returns amount paid.
   */
  repay: (
    { borrower, amount }: { borrower: string; amount: i128 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /**
   * Construct and simulate a borrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Borrow the underlying asset against posted collateral.
   */
  borrow: (
    { borrower, amount }: { borrower: string; amount: i128 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deposit the borrow asset and receive LP shares. Returns shares minted.
   */
  deposit: (
    { lender, amount }: { lender: string; amount: i128 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /**
   * Construct and simulate a get_pool transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_pool: (options?: MethodOptions) => Promise<AssembledTransaction<Pool>>;

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Redeem LP shares for the underlying borrow asset. Returns amount withdrawn.
   */
  withdraw: (
    { lender, shares }: { lender: string; shares: i128 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /**
   * Construct and simulate a liquidate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Liquidate an unhealthy position: the liquidator repays up to `repay_amount`
   * of debt and seizes collateral at a bonus.
   */
  liquidate: (
    {
      liquidator,
      borrower,
      repay_amount,
    }: { liquidator: string; borrower: string; repay_amount: i128 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a shares_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  shares_of: (
    { lender }: { lender: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<Result<Config>>>;

  /**
   * Construct and simulate a current_debt transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Current total debt (principal + interest accrued to now) for a borrower.
   */
  current_debt: (
    { borrower }: { borrower: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a get_position transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_position: (
    { borrower }: { borrower: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<Position>>>;

  /**
   * Construct and simulate a supply_collateral transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Post collateral to back future borrows.
   */
  supply_collateral: (
    { borrower, amount }: { borrower: string; amount: i128 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a withdraw_collateral transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw collateral, provided the position stays within its LTV limit.
   */
  withdraw_collateral: (
    { borrower, amount }: { borrower: string; amount: i128 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;
}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    {
      borrow_token,
      collateral_token,
      ltv_bps,
      liquidation_threshold_bps,
      liquidation_bonus_bps,
      apr_bps,
    }: {
      borrow_token: string;
      collateral_token: string;
      ltv_bps: u32;
      liquidation_threshold_bps: u32;
      liquidation_bonus_bps: u32;
      apr_bps: u32;
    },
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, 'contractId'> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: 'hex' | 'base64';
      },
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(
      {
        borrow_token,
        collateral_token,
        ltv_bps,
        liquidation_threshold_bps,
        liquidation_bonus_bps,
        apr_bps,
      },
      options,
    );
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([
        'AAAAAAAAAE1SZXBheSBvdXRzdGFuZGluZyBkZWJ0IChpbnRlcmVzdCBmaXJzdCwgdGhlbiBwcmluY2lwYWwpLiBSZXR1cm5zIGFtb3VudCBwYWlkLgAAAAAAAAVyZXBheQAAAAAAAAIAAAAAAAAACGJvcnJvd2VyAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAALAAAAAw==',
        'AAAAAAAAADZCb3Jyb3cgdGhlIHVuZGVybHlpbmcgYXNzZXQgYWdhaW5zdCBwb3N0ZWQgY29sbGF0ZXJhbC4AAAAAAAZib3Jyb3cAAAAAAAIAAAAAAAAACGJvcnJvd2VyAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAPtAAAAAAAAAAM=',
        'AAAAAAAAAEZEZXBvc2l0IHRoZSBib3Jyb3cgYXNzZXQgYW5kIHJlY2VpdmUgTFAgc2hhcmVzLiBSZXR1cm5zIHNoYXJlcyBtaW50ZWQuAAAAAAAHZGVwb3NpdAAAAAACAAAAAAAAAAZsZW5kZXIAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAACwAAAAM=',
        'AAAAAAAAAAAAAAAIZ2V0X3Bvb2wAAAAAAAAAAQAAB9AAAAAEUG9vbA==',
        'AAAAAAAAAEtSZWRlZW0gTFAgc2hhcmVzIGZvciB0aGUgdW5kZXJseWluZyBib3Jyb3cgYXNzZXQuIFJldHVybnMgYW1vdW50IHdpdGhkcmF3bi4AAAAACHdpdGhkcmF3AAAAAgAAAAAAAAAGbGVuZGVyAAAAAAATAAAAAAAAAAZzaGFyZXMAAAAAAAsAAAABAAAD6QAAAAsAAAAD',
        'AAAAAAAAAHVMaXF1aWRhdGUgYW4gdW5oZWFsdGh5IHBvc2l0aW9uOiB0aGUgbGlxdWlkYXRvciByZXBheXMgdXAgdG8gYHJlcGF5X2Ftb3VudGAKb2YgZGVidCBhbmQgc2VpemVzIGNvbGxhdGVyYWwgYXQgYSBib251cy4AAAAAAAAJbGlxdWlkYXRlAAAAAAAAAwAAAAAAAAAKbGlxdWlkYXRvcgAAAAAAEwAAAAAAAAAIYm9ycm93ZXIAAAATAAAAAAAAAAxyZXBheV9hbW91bnQAAAALAAAAAQAAA+kAAAPtAAAAAAAAAAM=',
        'AAAAAAAAAAAAAAAJc2hhcmVzX29mAAAAAAAAAQAAAAAAAAAGbGVuZGVyAAAAAAATAAAAAQAAAAs=',
        'AAAAAAAAAAAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAPpAAAH0AAAAAZDb25maWcAAAAAAAM=',
        'AAAAAAAAAEhDdXJyZW50IHRvdGFsIGRlYnQgKHByaW5jaXBhbCArIGludGVyZXN0IGFjY3J1ZWQgdG8gbm93KSBmb3IgYSBib3Jyb3dlci4AAAAMY3VycmVudF9kZWJ0AAAAAQAAAAAAAAAIYm9ycm93ZXIAAAATAAAAAQAAAAs=',
        'AAAAAAAAAAAAAAAMZ2V0X3Bvc2l0aW9uAAAAAQAAAAAAAAAIYm9ycm93ZXIAAAATAAAAAQAAA+kAAAfQAAAACFBvc2l0aW9uAAAAAw==',
        'AAAAAAAAADFJbml0aWFsaXplIHRoZSBwb29sLiBDYWxsZWQgb25jZSwgYXQgZGVwbG95IHRpbWUuAAAAAAAADV9fY29uc3RydWN0b3IAAAAAAAAGAAAAAAAAAAxib3Jyb3dfdG9rZW4AAAATAAAAAAAAABBjb2xsYXRlcmFsX3Rva2VuAAAAEwAAAAAAAAAHbHR2X2JwcwAAAAAEAAAAAAAAABlsaXF1aWRhdGlvbl90aHJlc2hvbGRfYnBzAAAAAAAABAAAAAAAAAAVbGlxdWlkYXRpb25fYm9udXNfYnBzAAAAAAAABAAAAAAAAAAHYXByX2JwcwAAAAAEAAAAAA==',
        'AAAAAAAAACdQb3N0IGNvbGxhdGVyYWwgdG8gYmFjayBmdXR1cmUgYm9ycm93cy4AAAAAEXN1cHBseV9jb2xsYXRlcmFsAAAAAAAAAgAAAAAAAAAIYm9ycm93ZXIAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAD6QAAA+0AAAAAAAAAAw==',
        'AAAAAAAAAEZXaXRoZHJhdyBjb2xsYXRlcmFsLCBwcm92aWRlZCB0aGUgcG9zaXRpb24gc3RheXMgd2l0aGluIGl0cyBMVFYgbGltaXQuAAAAAAATd2l0aGRyYXdfY29sbGF0ZXJhbAAAAAACAAAAAAAAAAhib3Jyb3dlcgAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAD7QAAAAAAAAAD',
        'AAAABAAAACxFcnJvcnMgcmV0dXJuZWQgYnkgdGhlIFZhdWx0ZXggbGVuZGluZyBwb29sLgAAAAAAAAAFRXJyb3IAAAAAAAAKAAAAJkNvbnRyYWN0IGhhcyBhbHJlYWR5IGJlZW4gaW5pdGlhbGl6ZWQuAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAIkNvbnRyYWN0IGhhcyBub3QgYmVlbiBpbml0aWFsaXplZC4AAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAACpBbW91bnQgbXVzdCBiZSBzdHJpY3RseSBncmVhdGVyIHRoYW4gemVyby4AAAAAAA1JbnZhbGlkQW1vdW50AAAAAAAAAwAAAEdBIGNvbmZpZ3VyYXRpb24gcGFyYW1ldGVyIChlLmcuIExUViAvIHRocmVzaG9sZCAvIEFQUikgaXMgb3V0IG9mIHJhbmdlLgAAAAANSW52YWxpZENvbmZpZwAAAAAAAAQAAAA9Tm90IGVub3VnaCBmcmVlIGxpcXVpZGl0eSBpbiB0aGUgcG9vbCB0byBzYXRpc2Z5IHRoZSByZXF1ZXN0LgAAAAAAABVJbnN1ZmZpY2llbnRMaXF1aWRpdHkAAAAAAAAFAAAAHVRoZSBib3Jyb3dlciBoYXMgbm8gcG9zaXRpb24uAAAAAAAACk5vUG9zaXRpb24AAAAAAAYAAAAZVGhlIGxlbmRlciBoYXMgbm8gc2hhcmVzLgAAAAAAAAhOb1NoYXJlcwAAAAcAAABEVGhlIHJlcXVlc3RlZCBhY3Rpb24gd291bGQgcHVzaCB0aGUgcG9zaXRpb24gYWJvdmUgaXRzIGJvcnJvdyBsaW1pdC4AAAATVW5kZXJjb2xsYXRlcmFsaXplZAAAAAAIAAAAMVRoZSBwb3NpdGlvbiBpcyBoZWFsdGh5IGFuZCBjYW5ub3QgYmUgbGlxdWlkYXRlZC4AAAAAAAAPTm90TGlxdWlkYXRhYmxlAAAAAAkAAAA2UmVwYXkvd2l0aGRyYXcgYW1vdW50IGV4Y2VlZHMgdGhlIG91dHN0YW5kaW5nIGJhbGFuY2UuAAAAAAANQW1vdW50VG9vSGlnaAAAAAAAAAo=',
        'AAAAAQAAAC1BZ2dyZWdhdGUgcG9vbCBhY2NvdW50aW5nIChpbnN0YW5jZSBzdG9yYWdlKS4AAAAAAAAAAAAABFBvb2wAAAADAAAAJVRvdGFsIG91dHN0YW5kaW5nIGJvcnJvd2VkIHByaW5jaXBhbC4AAAAAAAAOdG90YWxfYm9ycm93ZWQAAAAAAAsAAABGVG90YWwgdW5kZXJseWluZyBib3Jyb3ctdG9rZW4gYmFja2luZyBMUCBzaGFyZXMgKGdyb3dzIHdpdGggaW50ZXJlc3QpLgAAAAAAD3RvdGFsX2RlcG9zaXRlZAAAAAALAAAAF1RvdGFsIExQIHNoYXJlcyBpc3N1ZWQuAAAAAAx0b3RhbF9zaGFyZXMAAAAL',
        'AAAAAQAAAPtQb29sIGNvbmZpZ3VyYXRpb24sIHNldCBvbmNlIGF0IGNvbnN0cnVjdGlvbi4KCkZvciBNVlAgc2ltcGxpY2l0eSB0aGUgYm9ycm93IGFuZCBjb2xsYXRlcmFsIHRva2VucyBhcmUgYXNzdW1lZCB0byBiZSB2YWx1ZWQKMToxIChlLmcuIHR3byBzdGFibGVjb2lucyksIHNvIG5vIHByaWNlIG9yYWNsZSBpcyByZXF1aXJlZCDigJQgbWF0Y2hpbmcgdGhlCiJubyBvcmFjbGUgZGVwZW5kZW5jeSBmb3Igc3RhYmxlY29pbiBwYWlycyIgZGVzaWduLgAAAAAAAAAABkNvbmZpZwAAAAAABgAAADZGaXhlZCBib3Jyb3cgQVBSIGluIGJhc2lzIHBvaW50cyAoZS5nLiAxMDAwID0gMTAlL3lyKS4AAAAAAAdhcHJfYnBzAAAAAAQAAAAvVGhlIGFzc2V0IGxlbmRlcnMgZGVwb3NpdCBhbmQgYm9ycm93ZXJzIGJvcnJvdy4AAAAADGJvcnJvd190b2tlbgAAABMAAAAnVGhlIGFzc2V0IGJvcnJvd2VycyBwb3N0IGFzIGNvbGxhdGVyYWwuAAAAABBjb2xsYXRlcmFsX3Rva2VuAAAAEwAAADRMaXF1aWRhdGlvbiBib251cyBpbiBiYXNpcyBwb2ludHMgKGUuZy4gMTAwMCA9IDEwJSkuAAAAFWxpcXVpZGF0aW9uX2JvbnVzX2JwcwAAAAAAAAQAAAA4TGlxdWlkYXRpb24gdGhyZXNob2xkIGluIGJhc2lzIHBvaW50cyAoZS5nLiA4NTAwID0gODUlKS4AAAAZbGlxdWlkYXRpb25fdGhyZXNob2xkX2JwcwAAAAAAAAQAAAA0TWF4IGxvYW4tdG8tdmFsdWUgaW4gYmFzaXMgcG9pbnRzIChlLmcuIDc1MDAgPSA3NSUpLgAAAAdsdHZfYnBzAAAAAAQ=',
        'AAAAAgAAAA1TdG9yYWdlIGtleXMuAAAAAAAAAAAAAAdEYXRhS2V5AAAAAAQAAAAAAAAAAAAAAAZDb25maWcAAAAAAAAAAAAAAAAABFBvb2wAAAABAAAAHkxQIHNoYXJlIGJhbGFuY2UgZm9yIGEgbGVuZGVyLgAAAAAABlNoYXJlcwAAAAAAAQAAABMAAAABAAAAH0JvcnJvdyBwb3NpdGlvbiBmb3IgYSBib3Jyb3dlci4AAAAACFBvc2l0aW9uAAAAAQAAABM=',
        'AAAAAQAAADVBIGJvcnJvd2VyJ3MgcG9zaXRpb24gKHBlcnNpc3RlbnQsIGtleWVkIGJ5IGFkZHJlc3MpLgAAAAAAAAAAAAAIUG9zaXRpb24AAAAEAAAAJEludGVyZXN0IGFjY3J1ZWQgYnV0IG5vdCB5ZXQgcmVwYWlkLgAAABBhY2NydWVkX2ludGVyZXN0AAAACwAAAC1Db2xsYXRlcmFsIHBvc3RlZCwgaW4gY29sbGF0ZXJhbC10b2tlbiB1bml0cy4AAAAAAAAKY29sbGF0ZXJhbAAAAAAACwAAAC5MZWRnZXIgdGltZXN0YW1wIG9mIHRoZSBsYXN0IGludGVyZXN0IGFjY3J1YWwuAAAAAAAMbGFzdF9hY2NydWFsAAAABgAAADZPdXRzdGFuZGluZyBib3Jyb3dlZCBwcmluY2lwYWwsIGluIGJvcnJvdy10b2tlbiB1bml0cy4AAAAAAAlwcmluY2lwYWwAAAAAAAAL',
      ]),
      options,
    );
  }
  public readonly fromJSON = {
    repay: this.txFromJSON<Result<i128>>,
    borrow: this.txFromJSON<Result<void>>,
    deposit: this.txFromJSON<Result<i128>>,
    get_pool: this.txFromJSON<Pool>,
    withdraw: this.txFromJSON<Result<i128>>,
    liquidate: this.txFromJSON<Result<void>>,
    shares_of: this.txFromJSON<i128>,
    get_config: this.txFromJSON<Result<Config>>,
    current_debt: this.txFromJSON<i128>,
    get_position: this.txFromJSON<Result<Position>>,
    supply_collateral: this.txFromJSON<Result<void>>,
    withdraw_collateral: this.txFromJSON<Result<void>>,
  };
}
