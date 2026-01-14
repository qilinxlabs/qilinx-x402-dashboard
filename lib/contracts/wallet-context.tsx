"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { EthereumNetwork } from "@/lib/db/schema";
import { 
  connectWallet as connectWalletService, 
  disconnectWallet as disconnectWalletService,
  getWalletAddress, 
  getCurrentNetwork, 
  switchNetwork,
  onAccountsChanged,
  onChainChanged
} from "./web3-service";
import { getNetworkDisplayName } from "./network-config";

interface WalletContextType {
  address: string | null;
  network: EthereumNetwork | null;
  isConnecting: boolean;
  error: string | null;
  connect: (targetNetwork?: EthereumNetwork) => Promise<void>;
  disconnect: () => Promise<void>;
  switchToNetwork: (network: EthereumNetwork) => Promise<boolean>;
  isCorrectNetwork: (targetNetwork: EthereumNetwork) => boolean;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<EthereumNetwork | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for existing wallet connection on mount
  useEffect(() => {
    const checkExistingConnection = async () => {
      try {
        const existingAddress = await getWalletAddress();
        if (existingAddress) {
          setAddress(existingAddress);
          const currentNetwork = await getCurrentNetwork();
          setNetwork(currentNetwork);
        }
      } catch (err) {
        console.warn("Failed to check existing wallet connection:", err);
      }
    };
    checkExistingConnection();
  }, []);

  // Listen for account and chain changes
  useEffect(() => {
    const unsubAccounts = onAccountsChanged((accounts) => {
      if (accounts.length === 0) {
        setAddress(null);
        setNetwork(null);
      } else {
        setAddress(accounts[0]);
      }
    });

    const unsubChain = onChainChanged(async () => {
      const currentNetwork = await getCurrentNetwork();
      setNetwork(currentNetwork);
    });

    return () => {
      unsubAccounts();
      unsubChain();
    };
  }, []);


  const connect = useCallback(async (targetNetwork: EthereumNetwork = "cronos_testnet") => {
    setIsConnecting(true);
    setError(null);
    try {
      const walletAddress = await connectWalletService(targetNetwork);
      setAddress(walletAddress);
      
      const currentNetwork = await getCurrentNetwork();
      setNetwork(currentNetwork);
      
      // If connected but wrong network, try to switch
      if (currentNetwork !== targetNetwork) {
        const switched = await switchNetwork(targetNetwork);
        if (switched) {
          setNetwork(targetNetwork);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect wallet";
      setError(message);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectWalletService();
    setAddress(null);
    setNetwork(null);
    setError(null);
  }, []);

  const switchToNetwork = useCallback(async (targetNetwork: EthereumNetwork): Promise<boolean> => {
    try {
      const switched = await switchNetwork(targetNetwork);
      if (switched) {
        setNetwork(targetNetwork);
      }
      return switched;
    } catch {
      return false;
    }
  }, []);

  const isCorrectNetwork = useCallback((targetNetwork: EthereumNetwork): boolean => {
    return network === targetNetwork;
  }, [network]);

  return (
    <WalletContext.Provider
      value={{
        address,
        network,
        isConnecting,
        error,
        connect,
        disconnect,
        switchToNetwork,
        isCorrectNetwork,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}

// Helper hook to get wallet display info
export function useWalletDisplay() {
  const { address, network } = useWallet();
  
  return {
    shortAddress: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null,
    networkName: network ? getNetworkDisplayName(network) : null,
    isConnected: !!address,
  };
}
