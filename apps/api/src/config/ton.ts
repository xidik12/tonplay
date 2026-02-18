import { env } from './env.js';

export interface TonConfig {
  network: 'mainnet' | 'testnet';
  apiUrl: string;
  apiKey: string | undefined;
  explorerUrl: string;
  tplayJettonAddress: string | undefined;
  masterWalletMnemonic: string | undefined;
}

const TON_NETWORKS = {
  mainnet: {
    apiUrl: 'https://toncenter.com/api/v2',
    explorerUrl: 'https://tonviewer.com',
  },
  testnet: {
    apiUrl: 'https://testnet.toncenter.com/api/v2',
    explorerUrl: 'https://testnet.tonviewer.com',
  },
} as const;

const networkConfig = TON_NETWORKS[env.TON_NETWORK];

export const tonConfig: TonConfig = {
  network: env.TON_NETWORK,
  apiUrl: networkConfig.apiUrl,
  apiKey: process.env.TON_API_KEY,
  explorerUrl: networkConfig.explorerUrl,
  tplayJettonAddress: process.env.TPLAY_JETTON_ADDRESS,
  masterWalletMnemonic: process.env.TON_MASTER_WALLET_MNEMONIC,
};

/**
 * Returns the TON explorer URL for a given transaction hash.
 */
export function getExplorerTxUrl(txHash: string): string {
  return `${tonConfig.explorerUrl}/transaction/${txHash}`;
}

/**
 * Returns the TON explorer URL for a given address.
 */
export function getExplorerAddressUrl(address: string): string {
  return `${tonConfig.explorerUrl}/${address}`;
}
