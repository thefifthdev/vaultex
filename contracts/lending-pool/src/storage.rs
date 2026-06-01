use soroban_sdk::{Address, Env};

use crate::types::{Config, DataKey, Pool, Position};

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP_AMOUNT: u32 = 14 * DAY_IN_LEDGERS;
const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - DAY_IN_LEDGERS;
const ENTRY_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const ENTRY_LIFETIME_THRESHOLD: u32 = ENTRY_BUMP_AMOUNT - DAY_IN_LEDGERS;

pub fn extend_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

pub fn has_config(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Config)
}

pub fn get_config(env: &Env) -> Option<Config> {
    env.storage().instance().get(&DataKey::Config)
}

pub fn set_config(env: &Env, config: &Config) {
    env.storage().instance().set(&DataKey::Config, config);
}

pub fn get_pool(env: &Env) -> Pool {
    env.storage()
        .instance()
        .get(&DataKey::Pool)
        .unwrap_or_default()
}

pub fn set_pool(env: &Env, pool: &Pool) {
    env.storage().instance().set(&DataKey::Pool, pool);
}

pub fn get_shares(env: &Env, who: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Shares(who.clone()))
        .unwrap_or(0)
}

pub fn set_shares(env: &Env, who: &Address, shares: i128) {
    let key = DataKey::Shares(who.clone());
    env.storage().persistent().set(&key, &shares);
    env.storage()
        .persistent()
        .extend_ttl(&key, ENTRY_LIFETIME_THRESHOLD, ENTRY_BUMP_AMOUNT);
}

pub fn get_position(env: &Env, who: &Address) -> Option<Position> {
    let key = DataKey::Position(who.clone());
    let pos = env.storage().persistent().get::<_, Position>(&key);
    if pos.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, ENTRY_LIFETIME_THRESHOLD, ENTRY_BUMP_AMOUNT);
    }
    pos
}

pub fn set_position(env: &Env, who: &Address, pos: &Position) {
    let key = DataKey::Position(who.clone());
    env.storage().persistent().set(&key, pos);
    env.storage()
        .persistent()
        .extend_ttl(&key, ENTRY_LIFETIME_THRESHOLD, ENTRY_BUMP_AMOUNT);
}
