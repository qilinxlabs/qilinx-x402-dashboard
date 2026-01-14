import { CronosNetwork } from '@crypto.com/facilitator-client';

export interface CronosNetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  symbol: string;
  explorerUrl: string;
  network: 'mainnet' | 'testnet';
  cronosNetwork: CronosNetwork;
}

export const CRONOS_MAINNET: CronosNetworkConfig = {
  name: 'Cronos',
  chainId: 25,
  rpcUrl: 'https://evm.cronos.org',
  symbol: 'CRO',
  explorerUrl: 'https://explorer.cronos.org',
  network: 'mainnet',
  cronosNetwork: CronosNetwork.CronosMainnet,
};

export const CRONOS_TESTNET: CronosNetworkConfig = {
  name: 'Cronos Testnet',
  chainId: 338,
  rpcUrl: 'https://evm-t3.cronos.org',
  symbol: 'tCRO',
  explorerUrl: 'https://explorer.cronos.org/testnet',
  network: 'testnet',
  cronosNetwork: CronosNetwork.CronosTestnet,
};

export const NETWORKS: Record<'mainnet' | 'testnet', CronosNetworkConfig> = {
  mainnet: CRONOS_MAINNET,
  testnet: CRONOS_TESTNET,
};

export function getNetworkConfig(network: 'mainnet' | 'testnet'): CronosNetworkConfig {
  return NETWORKS[network];
}

export function getExplorerTxUrl(network: 'mainnet' | 'testnet', txHash: string): string {
  const config = getNetworkConfig(network);
  return `${config.explorerUrl}/tx/${txHash}`;
}

export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isValidAmount(amount: string): boolean {
  const parsed = Number.parseFloat(amount);
  return !Number.isNaN(parsed) && parsed > 0;
}

// USDCe has 6 decimals
export const USDCE_DECIMALS = 6;

export function toBaseUnits(amount: string): string {
  const parsed = Number.parseFloat(amount);
  if (Number.isNaN(parsed)) return '0';
  return Math.floor(parsed * 10 ** USDCE_DECIMALS).toString();
}

export function fromBaseUnits(baseUnits: string): string {
  const parsed = Number.parseInt(baseUnits, 10);
  if (Number.isNaN(parsed)) return '0';
  return (parsed / 10 ** USDCE_DECIMALS).toFixed(USDCE_DECIMALS);
}
