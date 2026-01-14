"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Rocket, Wallet, AlertCircle, RefreshCw, Server, Package } from "lucide-react";
import type { EthereumNetwork, ContractTemplate } from "@/lib/db/schema";
import { isServerDeployNetwork, getNetworkDisplayName } from "@/lib/contracts/network-config";
import {
  isMetaMaskInstalled,
  connectWallet,
  getCurrentNetwork,
  switchNetwork,
  deployContract,
  getWalletAddress,
  type DeploymentResult,
} from "@/lib/contracts/web3-service";

interface DeployButtonProps {
  abi: object[] | null;
  bytecode: string | null;
  constructorArgs: unknown[];
  targetNetwork: EthereumNetwork;
  onDeploySuccess: (result: DeploymentResult) => void;
  onDeployError: (error: string) => void;
  disabled?: boolean;
  // Multi-file bundle deployment props
  template?: ContractTemplate;
  userParams?: Record<string, unknown>;
  onBundleDeploySuccess?: (result: BundleDeploymentResult) => void;
}

export interface BundleDeploymentResult {
  bundleId: string;
  contracts: Array<{
    filename: string;
    contractName: string;
    address: string;
    transactionHash: string;
    role: string;
  }>;
  deployerAddress: string;
}

type DeployState = "idle" | "connecting" | "switching" | "deploying";

export function DeployButton({
  abi,
  bytecode,
  constructorArgs,
  targetNetwork,
  onDeploySuccess,
  onDeployError,
  disabled,
  template,
  userParams,
  onBundleDeploySuccess,
}: DeployButtonProps) {
  const [state, setState] = useState<DeployState>("idle");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const useServerDeploy = isServerDeployNetwork(targetNetwork);
  const isMultiFile = !!(template?.sourceFiles && template.sourceFiles.length > 0 && template.deploymentConfig);

  // Check if already connected on mount (only for non-server deploy networks)
  useEffect(() => {
    if (useServerDeploy) return;
    const checkConnection = async () => {
      const address = await getWalletAddress();
      setWalletAddress(address);
    };
    checkConnection();
  }, [useServerDeploy]);

  const handleConnect = async () => {
    if (!isMetaMaskInstalled()) {
      onDeployError("MetaMask is not installed.");
      return;
    }
    setState("connecting");
    try {
      const address = await connectWallet();
      setWalletAddress(address);
    } catch (error) {
      onDeployError(error instanceof Error ? error.message : "Failed to connect");
    } finally {
      setState("idle");
    }
  };

  const handleServerDeploy = async () => {
    if (!abi || !bytecode) {
      onDeployError("Contract must be compiled before deployment");
      return;
    }

    setState("deploying");
    try {
      const res = await fetch("/api/contracts/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          abi,
          bytecode,
          constructorArgs,
          network: targetNetwork,
        }),
      });

      const result = await res.json();
      if (result.success) {
        onDeploySuccess({
          success: true,
          contractAddress: result.contractAddress,
          transactionHash: result.transactionHash,
        });
      } else {
        onDeployError(result.error || "Deployment failed");
      }
    } catch (error) {
      onDeployError(error instanceof Error ? error.message : "Deployment failed");
    } finally {
      setState("idle");
    }
  };

  const handleBundleDeploy = async () => {
    if (!template) {
      onDeployError("Template required for bundle deployment");
      return;
    }

    // Validate external addresses are provided
    const deploymentConfig = template.deploymentConfig;
    if (deploymentConfig) {
      for (const config of Object.values(deploymentConfig.dependencies)) {
        for (const param of config.constructorParams) {
          if (param.externalAddress && !userParams?.[param.paramName]) {
            onDeployError(`Please provide ${param.paramName} address`);
            return;
          }
        }
      }
    }

    setState("deploying");
    try {
      const res = await fetch("/api/contracts/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: template.id,
          network: targetNetwork,
          userParams: userParams || {},
        }),
      });

      const result = await res.json();
      if (result.success) {
        // Call bundle success callback if provided
        if (onBundleDeploySuccess) {
          onBundleDeploySuccess(result as BundleDeploymentResult);
        }
        // Also call single success with main contract info
        const mainContract = result.contracts?.find((c: { role: string }) => c.role === "hook") || result.contracts?.[0];
        if (mainContract) {
          onDeploySuccess({
            success: true,
            contractAddress: mainContract.address,
            transactionHash: mainContract.transactionHash,
          });
        }
      } else {
        onDeployError(result.error || "Bundle deployment failed");
      }
    } catch (error) {
      onDeployError(error instanceof Error ? error.message : "Bundle deployment failed");
    } finally {
      setState("idle");
    }
  };

  const handleMetaMaskDeploy = async () => {
    if (!abi || !bytecode) {
      onDeployError("Contract must be compiled before deployment");
      return;
    }

    if (!isMetaMaskInstalled()) {
      onDeployError("MetaMask is not installed. Please install MetaMask to deploy contracts.");
      return;
    }

    try {
      // Connect wallet if not connected
      if (!walletAddress) {
        setState("connecting");
        const address = await connectWallet();
        setWalletAddress(address);
      }

      // Check network
      const currentNetwork = await getCurrentNetwork();
      if (currentNetwork !== targetNetwork) {
        setState("switching");
        const switched = await switchNetwork(targetNetwork);
        if (!switched) {
          onDeployError(`Please switch to ${getNetworkDisplayName(targetNetwork)} in MetaMask`);
          setState("idle");
          return;
        }
      }

      // Deploy
      setState("deploying");
      const result = await deployContract(abi, bytecode, constructorArgs);

      if (result.success) {
        onDeploySuccess(result);
      } else {
        onDeployError(result.error || "Deployment failed");
      }
    } catch (error) {
      onDeployError(error instanceof Error ? error.message : "Deployment failed");
    } finally {
      setState("idle");
    }
  };

  const handleDeploy = isMultiFile && useServerDeploy 
    ? handleBundleDeploy 
    : useServerDeploy 
      ? handleServerDeploy 
      : handleMetaMaskDeploy;

  const getButtonContent = () => {
    switch (state) {
      case "connecting":
        return (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting Wallet...
          </>
        );
      case "switching":
        return (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Switching Network...
          </>
        );
      case "deploying":
        return (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isMultiFile ? "Deploying Bundle..." : "Deploying..."}
          </>
        );
      default:
        return (
          <>
            {isMultiFile ? (
              <Package className="mr-2 h-4 w-4" />
            ) : useServerDeploy ? (
              <Server className="mr-2 h-4 w-4" />
            ) : (
              <Rocket className="mr-2 h-4 w-4" />
            )}
            {isMultiFile 
              ? `Deploy Bundle to ${getNetworkDisplayName(targetNetwork)}`
              : `Deploy to ${getNetworkDisplayName(targetNetwork)}`
            }
          </>
        );
    }
  };

  // For bundle deployment, we don't need abi/bytecode - the server compiles
  const isDisabled = isMultiFile 
    ? disabled || state !== "idle" || !template
    : disabled || state !== "idle" || !abi || !bytecode;

  return (
    <div className="space-y-2">
      {useServerDeploy ? (
        <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950 rounded-md text-sm text-blue-700 dark:text-blue-300">
          <Server className="h-4 w-4" />
          <span>
            {isMultiFile 
              ? "Deploying all contracts in sequence with developer account"
              : "Deploying with developer account (no wallet needed)"
            }
          </span>
        </div>
      ) : (
        <>
          {walletAddress ? (
            <div className="flex items-center justify-between p-2 bg-muted rounded-md text-sm">
              <span className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleConnect}
                disabled={state !== "idle"}
                title="Change account"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleConnect}
              variant="outline"
              className="w-full"
              disabled={state !== "idle"}
            >
              <Wallet className="mr-2 h-4 w-4" />
              Connect Wallet
            </Button>
          )}
        </>
      )}
      
      <Button
        onClick={handleDeploy}
        disabled={isDisabled}
        className="w-full"
        size="lg"
      >
        {getButtonContent()}
      </Button>
      
      {!isMultiFile && !abi && !bytecode && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Compile the contract first
        </p>
      )}
      {isMultiFile && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Package className="h-3 w-3" />
          Will deploy {template?.deploymentConfig?.deploymentOrder.length || 0} contracts in sequence
        </p>
      )}
    </div>
  );
}
