"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Wallet, Server, ChevronDown, Loader2, LogOut } from "lucide-react";
import { useSigningMode, type SigningMode } from "@/lib/x402/signing-mode-context";
import { useWallet } from "@/lib/contracts/wallet-context";
import { cn } from "@/lib/utils";

interface X402SigningToggleProps {
  className?: string;
}

export function X402SigningToggle({ className }: X402SigningToggleProps) {
  const {
    mode,
    setMode,
    isDeveloperWalletConfigured,
    developerWalletAddress,
    isLoading: isLoadingSigningMode,
  } = useSigningMode();

  const {
    address: connectedAddress,
    isConnecting,
    connect,
    disconnect,
  } = useWallet();

  const isLoading = isLoadingSigningMode || isConnecting;

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled className={className}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  const devShortAddress = developerWalletAddress
    ? `${developerWalletAddress.slice(0, 6)}...${developerWalletAddress.slice(-4)}`
    : null;

  const connectedShortAddress = connectedAddress
    ? `${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}`
    : null;

  const handleModeChange = async (newMode: SigningMode) => {
    if (newMode === "connected-wallet" && !connectedAddress) {
      // Connect wallet when selecting connected wallet mode
      try {
        await connect("cronos_testnet");
        setMode(newMode);
      } catch (err) {
        console.error("Failed to connect wallet:", err);
      }
    } else {
      setMode(newMode);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    // Switch to developer wallet if available, otherwise stay on connected wallet mode
    if (isDeveloperWalletConfigured) {
      setMode("developer-wallet");
    }
  };

  // Determine display based on mode and connection status
  const getDisplayInfo = () => {
    if (mode === "connected-wallet") {
      if (connectedAddress) {
        return {
          icon: <Wallet className="h-4 w-4" />,
          label: connectedShortAddress,
          variant: "default" as const,
        };
      }
      return {
        icon: <Wallet className="h-4 w-4" />,
        label: "Connect",
        variant: "outline" as const,
      };
    }
    return {
      icon: <Server className="h-4 w-4" />,
      label: "Dev",
      variant: "outline" as const,
    };
  };

  const displayInfo = getDisplayInfo();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", className)}>
          {displayInfo.icon}
          <span className="hidden sm:inline">{displayInfo.label}</span>
          <Badge variant="secondary" className="text-xs">
            X402
          </Badge>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5 text-sm font-medium">X402 Signing Mode</div>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => handleModeChange("connected-wallet")}
          className="flex items-center gap-2"
        >
          <Wallet className="h-4 w-4" />
          <div className="flex-1">
            <div className="font-medium">Connected Wallet</div>
            <div className="text-xs text-muted-foreground">
              {connectedAddress
                ? `Connected: ${connectedShortAddress}`
                : "Click to connect your wallet"}
            </div>
          </div>
          {mode === "connected-wallet" && (
            <span className="text-primary">✓</span>
          )}
        </DropdownMenuItem>

        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <DropdownMenuItem
                onClick={() => handleModeChange("developer-wallet")}
                disabled={!isDeveloperWalletConfigured}
                className="flex items-center gap-2"
              >
                <Server className="h-4 w-4" />
                <div className="flex-1">
                  <div className="font-medium">Developer Wallet</div>
                  <div className="text-xs text-muted-foreground">
                    {isDeveloperWalletConfigured
                      ? `Sign with ${devShortAddress}`
                      : "Not configured"}
                  </div>
                </div>
                {mode === "developer-wallet" && (
                  <span className="text-primary">✓</span>
                )}
              </DropdownMenuItem>
            </div>
          </TooltipTrigger>
          {!isDeveloperWalletConfigured && (
            <TooltipContent>
              <p>Set CRONOS_DEVELOPER_PRIVATE_KEY in .env.local</p>
            </TooltipContent>
          )}
        </Tooltip>

        {/* Show connected wallet info and disconnect option */}
        {mode === "connected-wallet" && connectedAddress && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <div className="text-xs text-muted-foreground">Connected Wallet</div>
              <div className="font-mono text-xs break-all">
                {connectedAddress}
              </div>
            </div>
            <DropdownMenuItem onClick={handleDisconnect} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Disconnect Wallet
            </DropdownMenuItem>
          </>
        )}

        {/* Show developer wallet info */}
        {mode === "developer-wallet" && developerWalletAddress && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <div className="text-xs text-muted-foreground">Developer Wallet</div>
              <div className="font-mono text-xs break-all">
                {developerWalletAddress}
              </div>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
