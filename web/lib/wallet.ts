'use client';

import {
  StellarWalletsKit,
  WalletNetwork,
  FREIGHTER_ID,
  allowAllModules,
} from '@creit.tech/stellar-wallets-kit';

let kit: StellarWalletsKit | null = null;

/** Lazily create the wallet kit (browser-only). */
export function getKit(): StellarWalletsKit {
  if (!kit) {
    kit = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: FREIGHTER_ID,
      modules: allowAllModules(),
    });
  }
  return kit;
}

/** Open the wallet picker and return the chosen account's public key. */
export async function connectWallet(): Promise<string> {
  const k = getKit();
  return new Promise<string>((resolve, reject) => {
    k.openModal({
      onWalletSelected: async (option) => {
        try {
          k.setWallet(option.id);
          const { address } = await k.getAddress();
          resolve(address);
        } catch (e) {
          reject(e);
        }
      },
      onClosed: () => reject(new Error('Wallet selection cancelled')),
    });
  });
}

/**
 * Signing adapter passed to the contract client. Matches the SDK's
 * `signTransaction` signature.
 */
export async function signTransaction(
  xdr: string,
  opts?: { networkPassphrase?: string; address?: string },
): Promise<{ signedTxXdr: string; signerAddress?: string }> {
  const k = getKit();
  const { signedTxXdr, signerAddress } = await k.signTransaction(xdr, {
    address: opts?.address,
    networkPassphrase: opts?.networkPassphrase,
  });
  return { signedTxXdr, signerAddress };
}
