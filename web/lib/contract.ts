'use client';

import { Client, networks, type Config, type Pool, type Position } from '@vaultex/lending-client';
import { RPC_URL } from './config';
import { signTransaction } from './wallet';

const base = {
  ...networks.testnet,
  rpcUrl: RPC_URL,
  allowHttp: RPC_URL.startsWith('http://'),
};

export function readClient(): Client {
  return new Client(base);
}

export function writeClient(publicKey: string): Client {
  return new Client({ ...base, publicKey, signTransaction });
}

// ---- reads --------------------------------------------------------------

export async function getPool(): Promise<Pool> {
  return (await readClient().get_pool()).result;
}

export async function getConfig(): Promise<Config> {
  return unwrap((await readClient().get_config()).result);
}

export async function sharesOf(address: string): Promise<bigint> {
  return (await readClient().shares_of({ lender: address })).result;
}

export async function getPosition(address: string): Promise<Position | null> {
  try {
    return unwrap((await readClient().get_position({ borrower: address })).result);
  } catch {
    return null;
  }
}

export async function currentDebt(address: string): Promise<bigint> {
  return (await readClient().current_debt({ borrower: address })).result;
}

// ---- writes -------------------------------------------------------------

export async function deposit(address: string, amount: bigint): Promise<void> {
  unwrap(
    (await (await writeClient(address).deposit({ lender: address, amount })).signAndSend()).result,
  );
}

export async function withdraw(address: string, shares: bigint): Promise<void> {
  unwrap(
    (await (await writeClient(address).withdraw({ lender: address, shares })).signAndSend()).result,
  );
}

export async function supplyCollateral(address: string, amount: bigint): Promise<void> {
  unwrap(
    (
      await (
        await writeClient(address).supply_collateral({ borrower: address, amount })
      ).signAndSend()
    ).result,
  );
}

export async function withdrawCollateral(address: string, amount: bigint): Promise<void> {
  unwrap(
    (
      await (
        await writeClient(address).withdraw_collateral({ borrower: address, amount })
      ).signAndSend()
    ).result,
  );
}

export async function borrow(address: string, amount: bigint): Promise<void> {
  unwrap(
    (await (await writeClient(address).borrow({ borrower: address, amount })).signAndSend()).result,
  );
}

export async function repay(address: string, amount: bigint): Promise<void> {
  unwrap(
    (await (await writeClient(address).repay({ borrower: address, amount })).signAndSend()).result,
  );
}

function unwrap<T>(result: T | { unwrap: () => T }): T {
  if (result && typeof result === 'object' && 'unwrap' in result) {
    return (result as { unwrap: () => T }).unwrap();
  }
  return result as T;
}
