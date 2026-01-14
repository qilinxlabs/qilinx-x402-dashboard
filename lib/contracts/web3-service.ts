"use client";

import { BrowserProvider, ContractFactory, Contract, JsonRpcProvider } from "ethers";
import { DeFiWeb3Connector } from "@deficonnect/web3-connector";
import type { EthereumNetwork } from "@/lib/db/schema";
import { CHAIN_IDS, CHAIN_HEX_IDS, RPC_URLS } from "./network-config";

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
}

let defiConnector: DeFiWeb3Connector | null = null;
let connectedProvider: BrowserProvider | null = null;

function getWindowEthereum(): Eip1193Provider | undefined {
  if (typeof window !== "undefined") {
    return (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  }
  return undefined;
}

export interface DeploymentResult {
  success: boolean;
  contractAddress?: string;
  transactionHash?: string;
  error?: string;
}

export interface WriteResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

function getConnector(network: EthereumNetwork = "cronos_testnet"): DeFiWeb3Connector {
  if (!defiConnector) {
    const chainId = network === "cronos_mainnet" ? 25 : 338;
    defiConnector = new DeFiWeb3Connector({
      supportedChainIds: [25, 338],
      appName: "QilinX Contracts",
      chainType: "eth",
      chainId: String(chainId),
      rpcUrls: { 25: "https://evm.cronos.org", 338: "https://evm-t3.cronos.org" },
    });
  }
  return defiConnector;
}

export function isWalletInstalled(): boolean {
  return !!getWindowEthereum();
}

export const isMetaMaskInstalled = isWalletInstalled;

export async function connectWallet(network: EthereumNetwork = "cronos_testnet"): Promise<string> {
  try {
    const connector = getConnector(network);
    const provider = await connector.activate();
    if (!provider) throw new Error("Failed to connect wallet");
    connectedProvider = new BrowserProvider(provider as unknown as Eip1193Provider);
    const accounts = await connectedProvider.send("eth_requestAccounts", []);
    if (!accounts || accounts.length === 0) throw new Error("No accounts found");
    return accounts[0];
  } catch (error) {
    if (isWalletInstalled()) {
      const ethereum = getWindowEthereum()!;
      const provider = new BrowserProvider(ethereum);
      connectedProvider = provider;
      const accounts = await provider.send("eth_requestAccounts", []);
      return accounts[0];
    }
    throw new Error("No wallet detected. Please install a Cronos-compatible wallet.");
  }
}

export async function disconnectWallet(): Promise<void> {
  if (defiConnector) {
    defiConnector.deactivate();
    defiConnector = null;
    connectedProvider = null;
  }
}

export async function switchWallet(): Promise<string> {
  await disconnectWallet();
  return connectWallet();
}

export function onAccountsChanged(callback: (accounts: string[]) => void): () => void {
  const ethereum = getWindowEthereum();
  if (!ethereum) return () => {};
  const handler = (accounts: unknown) => callback(accounts as string[]);
  ethereum.on("accountsChanged", handler);
  return () => ethereum.removeListener("accountsChanged", handler);
}

export function onChainChanged(callback: (chainId: string) => void): () => void {
  const ethereum = getWindowEthereum();
  if (!ethereum) return () => {};
  const handler = (chainId: unknown) => callback(chainId as string);
  ethereum.on("chainChanged", handler);
  return () => ethereum.removeListener("chainChanged", handler);
}

export async function getCurrentNetwork(): Promise<EthereumNetwork | null> {
  try {
    const ethereum = getWindowEthereum();
    const provider = connectedProvider || (ethereum ? new BrowserProvider(ethereum) : null);
    if (!provider) return null;
    const network = await provider.getNetwork();
    if (network.chainId === CHAIN_IDS.cronos_mainnet) return "cronos_mainnet";
    if (network.chainId === CHAIN_IDS.cronos_testnet) return "cronos_testnet";
    return null;
  } catch { return null; }
}

export async function switchNetwork(network: EthereumNetwork): Promise<boolean> {
  const ethereum = getWindowEthereum();
  if (!ethereum) return false;
  const chainId = CHAIN_HEX_IDS[network];
  try {
    await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
    return true;
  } catch (error: unknown) {
    if ((error as { code?: number })?.code === 4902) {
      try {
        const configs: Record<string, { chainName: string; nativeCurrency: { name: string; symbol: string; decimals: number }; rpcUrls: string[]; blockExplorerUrls: string[] }> = {
          cronos_mainnet: { chainName: "Cronos Mainnet", nativeCurrency: { name: "Cronos", symbol: "CRO", decimals: 18 }, rpcUrls: ["https://evm.cronos.org"], blockExplorerUrls: ["https://explorer.cronos.org"] },
          cronos_testnet: { chainName: "Cronos Testnet", nativeCurrency: { name: "Test CRO", symbol: "TCRO", decimals: 18 }, rpcUrls: ["https://evm-t3.cronos.org"], blockExplorerUrls: ["https://explorer.cronos.org/testnet"] },
        };
        const config = configs[network];
        if (config) {
          await ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId, ...config }] });
          return true;
        }
        return false;
      } catch { return false; }
    }
    return false;
  }
}

async function getProvider(): Promise<BrowserProvider> {
  if (connectedProvider) return connectedProvider;
  const ethereum = getWindowEthereum();
  if (ethereum) return new BrowserProvider(ethereum);
  throw new Error("No wallet connected.");
}

export async function deployContract(abi: object[], bytecode: string, constructorArgs: unknown[]): Promise<DeploymentResult> {
  try {
    const provider = await getProvider();
    const signer = await provider.getSigner();
    const factory = new ContractFactory(abi, bytecode, signer);
    const contract = await factory.deploy(...constructorArgs);
    const receipt = await contract.deploymentTransaction()?.wait();
    return { success: true, contractAddress: await contract.getAddress(), transactionHash: receipt?.hash };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Deployment failed";
    if (message.includes("user rejected") || message.includes("User denied")) return { success: false, error: "Transaction rejected" };
    return { success: false, error: message };
  }
}

export async function getWalletAddress(): Promise<string | null> {
  try {
    const ethereum = getWindowEthereum();
    const provider = connectedProvider || (ethereum ? new BrowserProvider(ethereum) : null);
    if (!provider) return null;
    const accounts = await provider.send("eth_accounts", []);
    return accounts[0] ?? null;
  } catch { return null; }
}

export async function readContract(contractAddress: string, abi: object[], functionName: string, args: unknown[], network: EthereumNetwork): Promise<unknown> {
  const ethereum = getWindowEthereum();
  if (connectedProvider || ethereum) {
    try {
      const currentNetwork = await getCurrentNetwork();
      if (currentNetwork === network) {
        const provider = connectedProvider || new BrowserProvider(ethereum!);
        const contract = new Contract(contractAddress, abi, provider);
        return await contract[functionName](...args);
      }
    } catch (e) { console.warn("Wallet read failed:", e); }
  }
  const timeoutId = setTimeout(() => {}, 10000);
  try {
    const provider = new JsonRpcProvider(RPC_URLS[network], undefined, { staticNetwork: true });
    const contract = new Contract(contractAddress, abi, provider);
    const result = await contract[functionName](...args);
    clearTimeout(timeoutId);
    return result;
  } catch (error) { clearTimeout(timeoutId); throw error; }
}

export async function writeContract(contractAddress: string, abi: object[], functionName: string, args: unknown[]): Promise<WriteResult> {
  try {
    const provider = await getProvider();
    const signer = await provider.getSigner();
    const contract = new Contract(contractAddress, abi, signer);
    const tx = await contract[functionName](...args);
    const receipt = await tx.wait();
    return { success: true, transactionHash: receipt?.hash || tx.hash };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Transaction failed";
    if (message.includes("user rejected") || message.includes("User denied")) return { success: false, error: "Transaction rejected" };
    return { success: false, error: message };
  }
}
