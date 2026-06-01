use soroban_sdk::{contracttype, Address};

/// Pool configuration, set once at construction.
///
/// For MVP simplicity the borrow and collateral tokens are assumed to be valued
/// 1:1 (e.g. two stablecoins), so no price oracle is required — matching the
/// "no oracle dependency for stablecoin pairs" design.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Config {
    /// The asset lenders deposit and borrowers borrow.
    pub borrow_token: Address,
    /// The asset borrowers post as collateral.
    pub collateral_token: Address,
    /// Max loan-to-value in basis points (e.g. 7500 = 75%).
    pub ltv_bps: u32,
    /// Liquidation threshold in basis points (e.g. 8500 = 85%).
    pub liquidation_threshold_bps: u32,
    /// Liquidation bonus in basis points (e.g. 1000 = 10%).
    pub liquidation_bonus_bps: u32,
    /// Fixed borrow APR in basis points (e.g. 1000 = 10%/yr).
    pub apr_bps: u32,
}

/// Aggregate pool accounting (instance storage).
#[contracttype]
#[derive(Clone, Debug, Default)]
pub struct Pool {
    /// Total underlying borrow-token backing LP shares (grows with interest).
    pub total_deposited: i128,
    /// Total outstanding borrowed principal.
    pub total_borrowed: i128,
    /// Total LP shares issued.
    pub total_shares: i128,
}

/// A borrower's position (persistent, keyed by address).
#[contracttype]
#[derive(Clone, Debug)]
pub struct Position {
    /// Collateral posted, in collateral-token units.
    pub collateral: i128,
    /// Outstanding borrowed principal, in borrow-token units.
    pub principal: i128,
    /// Interest accrued but not yet repaid.
    pub accrued_interest: i128,
    /// Ledger timestamp of the last interest accrual.
    pub last_accrual: u64,
}

/// Storage keys.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Config,
    Pool,
    /// LP share balance for a lender.
    Shares(Address),
    /// Borrow position for a borrower.
    Position(Address),
}
