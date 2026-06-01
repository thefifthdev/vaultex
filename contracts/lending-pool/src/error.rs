use soroban_sdk::contracterror;

/// Errors returned by the Vaultex lending pool.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// Contract has already been initialized.
    AlreadyInitialized = 1,
    /// Contract has not been initialized.
    NotInitialized = 2,
    /// Amount must be strictly greater than zero.
    InvalidAmount = 3,
    /// A configuration parameter (e.g. LTV / threshold / APR) is out of range.
    InvalidConfig = 4,
    /// Not enough free liquidity in the pool to satisfy the request.
    InsufficientLiquidity = 5,
    /// The borrower has no position.
    NoPosition = 6,
    /// The lender has no shares.
    NoShares = 7,
    /// The requested action would push the position above its borrow limit.
    Undercollateralized = 8,
    /// The position is healthy and cannot be liquidated.
    NotLiquidatable = 9,
    /// Repay/withdraw amount exceeds the outstanding balance.
    AmountTooHigh = 10,
}
