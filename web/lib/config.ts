// Public configuration. All values are safe to expose in the browser bundle.
// Defaults point at the live testnet deployment so the app works out of the box.

export const CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRACT_ID ?? 'CBAPGTVW3IUEIGUEE4JPB35GLBTBRMJS7ZBYO7H75CFSOONIPF4TGG7T';

export const NETWORK = process.env.NEXT_PUBLIC_NETWORK ?? 'testnet';

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://soroban-testnet.stellar.org';

export const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

// The pool market: borrow a test stablecoin (USDV) against XLM collateral.
export const BORROW_TOKEN =
  process.env.NEXT_PUBLIC_BORROW_TOKEN ??
  'CC4KELHGFX6EGZAI6SG6N5KOU22AFCKBNOJOQI4A2Y4ZS2N3ZVR2BNRV';
export const COLLATERAL_TOKEN =
  process.env.NEXT_PUBLIC_COLLATERAL_TOKEN ??
  'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

export const BORROW_SYMBOL = 'USDV';
export const COLLATERAL_SYMBOL = 'XLM';

export const EXPLORER_CONTRACT = `https://stellar.expert/explorer/${NETWORK}/contract/${CONTRACT_ID}`;
