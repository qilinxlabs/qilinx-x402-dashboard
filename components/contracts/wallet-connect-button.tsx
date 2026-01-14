"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wallet, Loader2, ChevronDown, LogOut, RefreshCw } from "lucide-react";
import { useWallet, useWalletDisplay } from "@/lib/contracts/wallet-context";
import type { EthereumNetwork } from "@/lib/db/schema";
import { getNetworkDisplayName } from "@/lib/contracts/network-config";

interface WalletConnectButtonProps {
  targetNetwork?: EthereumNetwork;
  className?: string;
}

export function WalletConnectButton({ targetNetwork = "cronos_testnet", className }: WalletConnectButtonProps) {
  const { address, network, isConnecting, error, connect, disconnect, switchToNetwork } = useWallet();
  const { shortAddress, networkName } = useWalletDisplay();
  const [localError, setLocalError] = useState<string | null>(null);

  const handleConnect = async () => {
    setLocalError(null);
    try {
      await connect(targetNetwork);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to connect");
    }
  };

  const handleSwitchNetwork = async (newNetwork: EthereumNetwork) => {
    await switchToNetwork(newNetwork);
  };

  const isCorrectNetwork = network === targetNetwork;

  if (!address) {
    return (
      <div className={className}>
        <Button onClick={handleConnect} disabled={isConnecting} variant="outline">
          {isConnecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Wallet className="mr-2 h-4 w-4" />
              Connect Wallet
            </>
          )}
        </Button>
        {(localError || error) && (
          <p className="text-xs text-destructive mt-1">{localError || error}</p>
        )}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={className}>
          <Wallet className="mr-2 h-4 w-4" />
          <span className="font-mono">{shortAddress}</span>
          <Badge 
            variant={isCorrectNetwork ? "secondary" : "destructive"} 
            className="ml-2 text-xs"
          >
            {networkName}
          </Badge>
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-sm font-medium">Connected Wallet</div>
        <div className="px-2 py-1 text-xs text-muted-foreground font-mono">
          {address}
        </div>
        <DropdownMenuSeparator />
        
        {!isCorrectNetwork && (
          <>
            <DropdownMenuItem onClick={() => handleSwitchNetwork(targetNetwork)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Switch to {getNetworkDisplayName(targetNetwork)}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        <DropdownMenuItem onClick={() => handleSwitchNetwork("cronos_testnet")}>
          Cronos Testnet
          {network === "cronos_testnet" && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSwitchNetwork("cronos_mainnet")}>
          Cronos Mainnet
          {network === "cronos_mainnet" && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={disconnect} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
