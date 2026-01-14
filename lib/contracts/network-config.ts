// Network configuration for Cronos chain
// Updated for USDC token on Cronos networks

import type { EthereumNetwork } from "@/lib/db/schema";

// USDC token addresses for Cronos networks
// Testnet uses devUSDC.e which supports EIP-3009 transferWithAuthorization for x402
export const USDC_ADDRESSES: Record<EthereumNetwork, string> = {
  cronos_mainnet: "0xc21223249CA28397B4B6541dfFaEcC539BfF0c59", // Circle USDC.e on Cronos
  cronos_testnet: "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0", // devUSDC.e on Cronos Testnet
} as const;

export const CHAIN_IDS: Record<EthereumNetwork, bigint> = {
  cronos_mainnet: 25n,
  cronos_testnet: 338n,
} as const;

export const CHAIN_HEX_IDS: Record<EthereumNetwork, string> = {
  cronos_mainnet: "0x19",
  cronos_testnet: "0x152",
} as const;

export const BLOCK_EXPLORERS: Record<EthereumNetwork, string> = {
  cronos_mainnet: "https://explorer.cronos.org",
  cronos_testnet: "https://explorer.cronos.org/testnet",
} as const;

export const RPC_URLS: Record<EthereumNetwork, string> = {
  cronos_mainnet: "https://evm.cronos.org",
  cronos_testnet: "https://evm-t3.cronos.org",
} as const;

// Networks that support server-side deployment with developer account
export const SERVER_DEPLOY_NETWORKS: EthereumNetwork[] = ["cronos_testnet", "cronos_mainnet"] as const;

export function getUsdcAddress(network: EthereumNetwork): string {
  return USDC_ADDRESSES[network];
}

// Get the appropriate token address based on network (USDC for all Cronos networks)
export function getTokenAddress(network: EthereumNetwork): string {
  return USDC_ADDRESSES[network];
}

// Get token decimals (USDC has 6 decimals)
export function getTokenDecimals(_network: EthereumNetwork): number {
  return 6;
}

// Get token symbol
export function getTokenSymbol(_network: EthereumNetwork): string {
  return "USDC";
}

export function getChainId(network: EthereumNetwork): bigint {
  return CHAIN_IDS[network];
}

export function getBlockExplorerUrl(network: EthereumNetwork, address: string): string {
  return `${BLOCK_EXPLORERS[network]}/address/${address}`;
}

export function getBlockExplorerTxUrl(network: EthereumNetwork, txHash: string): string {
  return `${BLOCK_EXPLORERS[network]}/tx/${txHash}`;
}

export function getNetworkDisplayName(network: EthereumNetwork): string {
  switch (network) {
    case "cronos_mainnet":
      return "Cronos Mainnet";
    case "cronos_testnet":
      return "Cronos Testnet";
    default:
      return network;
  }
}

export function isServerDeployNetwork(network: EthereumNetwork): boolean {
  return SERVER_DEPLOY_NETWORKS.includes(network);
}

// Legacy function for backward compatibility - returns USDC address
export function getMneeAddress(network: EthereumNetwork): string {
  return USDC_ADDRESSES[network];
}
