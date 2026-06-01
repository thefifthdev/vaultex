#![no_std]
//! # Vaultex Lending Pool
//!
//! A non-custodial, single-market money market on Soroban. Lenders deposit the
//! borrow asset and receive pool shares that appreciate as borrowers pay
//! interest. Borrowers post collateral and borrow up to an LTV limit; positions
//! that fall below the liquidation threshold can be liquidated for a bonus.
//!
//! For MVP simplicity the borrow and collateral assets are valued 1:1 (a
//! stablecoin pair), so no price oracle is required.

mod error;
mod storage;
mod types;

#[cfg(test)]
mod test;

pub use error::Error;
pub use types::{Config, DataKey, Pool, Position};

use soroban_sdk::{contract, contractimpl, panic_with_error, symbol_short, token, Address, Env};

const BPS: i128 = 10_000;
const SECONDS_PER_YEAR: i128 = 31_536_000;

#[contract]
pub struct LendingPool;

#[contractimpl]
impl LendingPool {
    /// Initialize the pool. Called once, at deploy time.
    #[allow(clippy::too_many_arguments)]
    pub fn __constructor(
        env: Env,
        borrow_token: Address,
        collateral_token: Address,
        ltv_bps: u32,
        liquidation_threshold_bps: u32,
        liquidation_bonus_bps: u32,
        apr_bps: u32,
    ) {
        if storage::has_config(&env) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        // LTV must be ≤ liquidation threshold ≤ 100%; bonus and APR bounded.
        if ltv_bps > liquidation_threshold_bps
            || liquidation_threshold_bps > BPS as u32
            || liquidation_bonus_bps > 5_000
            || apr_bps > 10_000
        {
            panic_with_error!(&env, Error::InvalidConfig);
        }
        storage::set_config(
            &env,
            &Config {
                borrow_token,
                collateral_token,
                ltv_bps,
                liquidation_threshold_bps,
                liquidation_bonus_bps,
                apr_bps,
            },
        );
        storage::extend_instance(&env);
    }

    // ---- Lender side -----------------------------------------------------

    /// Deposit the borrow asset and receive LP shares. Returns shares minted.
    pub fn deposit(env: Env, lender: Address, amount: i128) -> Result<i128, Error> {
        lender.require_auth();
        require_positive(&env, amount);
        let config = config(&env);

        token::Client::new(&env, &config.borrow_token).transfer(
            &lender,
            &env.current_contract_address(),
            &amount,
        );

        let mut pool = storage::get_pool(&env);
        let shares = if pool.total_shares == 0 || pool.total_deposited == 0 {
            amount
        } else {
            amount * pool.total_shares / pool.total_deposited
        };
        pool.total_deposited += amount;
        pool.total_shares += shares;
        storage::set_pool(&env, &pool);
        storage::set_shares(&env, &lender, storage::get_shares(&env, &lender) + shares);
        storage::extend_instance(&env);

        env.events()
            .publish((symbol_short!("deposit"), lender), (amount, shares));
        Ok(shares)
    }

    /// Redeem LP shares for the underlying borrow asset. Returns amount withdrawn.
    pub fn withdraw(env: Env, lender: Address, shares: i128) -> Result<i128, Error> {
        lender.require_auth();
        require_positive(&env, shares);

        let user_shares = storage::get_shares(&env, &lender);
        if user_shares == 0 {
            return Err(Error::NoShares);
        }
        if shares > user_shares {
            return Err(Error::AmountTooHigh);
        }

        let mut pool = storage::get_pool(&env);
        let amount = shares * pool.total_deposited / pool.total_shares;
        let available = pool.total_deposited - pool.total_borrowed;
        if amount > available {
            return Err(Error::InsufficientLiquidity);
        }

        pool.total_deposited -= amount;
        pool.total_shares -= shares;
        storage::set_pool(&env, &pool);
        storage::set_shares(&env, &lender, user_shares - shares);
        storage::extend_instance(&env);

        let config = config(&env);
        token::Client::new(&env, &config.borrow_token).transfer(
            &env.current_contract_address(),
            &lender,
            &amount,
        );

        env.events()
            .publish((symbol_short!("withdraw"), lender), (shares, amount));
        Ok(amount)
    }

    // ---- Borrower side ---------------------------------------------------

    /// Post collateral to back future borrows.
    pub fn supply_collateral(env: Env, borrower: Address, amount: i128) -> Result<(), Error> {
        borrower.require_auth();
        require_positive(&env, amount);
        let config = config(&env);

        token::Client::new(&env, &config.collateral_token).transfer(
            &borrower,
            &env.current_contract_address(),
            &amount,
        );

        let mut pos = position_or_new(&env, &borrower);
        accrue(&env, &config, &mut pos);
        pos.collateral += amount;
        storage::set_position(&env, &borrower, &pos);
        storage::extend_instance(&env);

        env.events()
            .publish((symbol_short!("supply"), borrower), amount);
        Ok(())
    }

    /// Withdraw collateral, provided the position stays within its LTV limit.
    pub fn withdraw_collateral(env: Env, borrower: Address, amount: i128) -> Result<(), Error> {
        borrower.require_auth();
        require_positive(&env, amount);
        let config = config(&env);

        let mut pos = storage::get_position(&env, &borrower).ok_or(Error::NoPosition)?;
        accrue(&env, &config, &mut pos);
        if amount > pos.collateral {
            return Err(Error::AmountTooHigh);
        }
        let new_collateral = pos.collateral - amount;
        if debt(&pos) > borrow_limit(new_collateral, config.ltv_bps) {
            return Err(Error::Undercollateralized);
        }
        pos.collateral = new_collateral;
        storage::set_position(&env, &borrower, &pos);
        storage::extend_instance(&env);

        token::Client::new(&env, &config.collateral_token).transfer(
            &env.current_contract_address(),
            &borrower,
            &amount,
        );
        env.events()
            .publish((symbol_short!("wcollat"), borrower), amount);
        Ok(())
    }

    /// Borrow the underlying asset against posted collateral.
    pub fn borrow(env: Env, borrower: Address, amount: i128) -> Result<(), Error> {
        borrower.require_auth();
        require_positive(&env, amount);
        let config = config(&env);

        let mut pos = storage::get_position(&env, &borrower).ok_or(Error::NoPosition)?;
        accrue(&env, &config, &mut pos);
        let new_debt = debt(&pos) + amount;
        if new_debt > borrow_limit(pos.collateral, config.ltv_bps) {
            return Err(Error::Undercollateralized);
        }

        let mut pool = storage::get_pool(&env);
        if amount > pool.total_deposited - pool.total_borrowed {
            return Err(Error::InsufficientLiquidity);
        }
        pos.principal += amount;
        pool.total_borrowed += amount;
        storage::set_position(&env, &borrower, &pos);
        storage::set_pool(&env, &pool);
        storage::extend_instance(&env);

        token::Client::new(&env, &config.borrow_token).transfer(
            &env.current_contract_address(),
            &borrower,
            &amount,
        );
        env.events()
            .publish((symbol_short!("borrow"), borrower), amount);
        Ok(())
    }

    /// Repay outstanding debt (interest first, then principal). Returns amount paid.
    pub fn repay(env: Env, borrower: Address, amount: i128) -> Result<i128, Error> {
        borrower.require_auth();
        require_positive(&env, amount);
        let config = config(&env);

        let mut pos = storage::get_position(&env, &borrower).ok_or(Error::NoPosition)?;
        accrue(&env, &config, &mut pos);
        let pay = min(amount, debt(&pos));
        if pay == 0 {
            return Err(Error::AmountTooHigh);
        }

        token::Client::new(&env, &config.borrow_token).transfer(
            &borrower,
            &env.current_contract_address(),
            &pay,
        );

        let mut pool = storage::get_pool(&env);
        apply_repayment(&mut pos, &mut pool, pay);
        storage::set_position(&env, &borrower, &pos);
        storage::set_pool(&env, &pool);
        storage::extend_instance(&env);

        env.events()
            .publish((symbol_short!("repay"), borrower), pay);
        Ok(pay)
    }

    /// Liquidate an unhealthy position: the liquidator repays up to `repay_amount`
    /// of debt and seizes collateral at a bonus.
    pub fn liquidate(
        env: Env,
        liquidator: Address,
        borrower: Address,
        repay_amount: i128,
    ) -> Result<(), Error> {
        liquidator.require_auth();
        require_positive(&env, repay_amount);
        let config = config(&env);

        let mut pos = storage::get_position(&env, &borrower).ok_or(Error::NoPosition)?;
        accrue(&env, &config, &mut pos);
        if debt(&pos) <= borrow_limit(pos.collateral, config.liquidation_threshold_bps) {
            return Err(Error::NotLiquidatable);
        }

        let pay = min(repay_amount, debt(&pos));
        let mut seize = pay * (BPS + config.liquidation_bonus_bps as i128) / BPS;
        if seize > pos.collateral {
            seize = pos.collateral;
        }

        let token_b = token::Client::new(&env, &config.borrow_token);
        token_b.transfer(&liquidator, &env.current_contract_address(), &pay);

        let mut pool = storage::get_pool(&env);
        apply_repayment(&mut pos, &mut pool, pay);
        pos.collateral -= seize;
        storage::set_position(&env, &borrower, &pos);
        storage::set_pool(&env, &pool);
        storage::extend_instance(&env);

        token::Client::new(&env, &config.collateral_token).transfer(
            &env.current_contract_address(),
            &liquidator,
            &seize,
        );
        env.events()
            .publish((symbol_short!("liquidate"), borrower), (pay, seize));
        Ok(())
    }

    // ---- Views -----------------------------------------------------------

    pub fn get_config(env: Env) -> Result<Config, Error> {
        storage::get_config(&env).ok_or(Error::NotInitialized)
    }

    pub fn get_pool(env: Env) -> Pool {
        storage::get_pool(&env)
    }

    pub fn shares_of(env: Env, lender: Address) -> i128 {
        storage::get_shares(&env, &lender)
    }

    pub fn get_position(env: Env, borrower: Address) -> Result<Position, Error> {
        storage::get_position(&env, &borrower).ok_or(Error::NoPosition)
    }

    /// Current total debt (principal + interest accrued to now) for a borrower.
    pub fn current_debt(env: Env, borrower: Address) -> i128 {
        let config = match storage::get_config(&env) {
            Some(c) => c,
            None => return 0,
        };
        match storage::get_position(&env, &borrower) {
            Some(mut pos) => {
                accrue(&env, &config, &mut pos);
                debt(&pos)
            }
            None => 0,
        }
    }
}

// ---- helpers ------------------------------------------------------------

fn config(env: &Env) -> Config {
    match storage::get_config(env) {
        Some(c) => c,
        None => panic_with_error!(env, Error::NotInitialized),
    }
}

fn require_positive(env: &Env, amount: i128) {
    if amount <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
}

fn position_or_new(env: &Env, who: &Address) -> Position {
    storage::get_position(env, who).unwrap_or(Position {
        collateral: 0,
        principal: 0,
        accrued_interest: 0,
        last_accrual: env.ledger().timestamp(),
    })
}

fn debt(pos: &Position) -> i128 {
    pos.principal + pos.accrued_interest
}

fn borrow_limit(collateral: i128, bps: u32) -> i128 {
    collateral * (bps as i128) / BPS
}

/// Accrue linear interest on the outstanding principal since the last accrual.
fn accrue(env: &Env, config: &Config, pos: &mut Position) {
    let now = env.ledger().timestamp();
    if pos.principal > 0 && now > pos.last_accrual {
        let dt = (now - pos.last_accrual) as i128;
        let interest = pos.principal * (config.apr_bps as i128) * dt / (BPS * SECONDS_PER_YEAR);
        pos.accrued_interest += interest;
    }
    pos.last_accrual = now;
}

/// Apply a repayment to interest first, then principal; interest accrues to LPs.
fn apply_repayment(pos: &mut Position, pool: &mut Pool, pay: i128) {
    let interest_paid = min(pay, pos.accrued_interest);
    pos.accrued_interest -= interest_paid;
    let principal_paid = pay - interest_paid;
    pos.principal -= principal_paid;
    pool.total_borrowed -= principal_paid;
    // Interest paid stays in the pool, increasing the value backing LP shares.
    pool.total_deposited += interest_paid;
}

fn min(a: i128, b: i128) -> i128 {
    if a < b {
        a
    } else {
        b
    }
}
