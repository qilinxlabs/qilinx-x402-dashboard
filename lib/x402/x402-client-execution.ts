"use client";

import { ethers } from "ethers";
import type { X402Service } from "@/hooks/use-x402-services";
import {
  SETTLEMENT_ROUTER_ABI,
  generateSalt,
} from "./x402-service";

// Cronos Testnet chain ID
const CRONOS_TESTNET_CHAIN_ID = 338;

export interface X402ProgressEvent {
  type: "progress" | "success" | "error";
  message: string;
  timestamp: number;
  data?: {
    service?: {
      id: string;
      title: string;
      hookType: string;
    };
    transaction?: {
      hash: string;
      blockNumber: number;
      from: string;
      payTo: string;
      amount: string;
      explorerUrl: string;
    };
    splits?: Array<{
      recipient: string;
      percentage: string;
    }>;
  };
}

export interface ExecuteWithConnectedWalletParams {
  service: X402Service;
  splits?: Array<{ recipient: string; bips: number }> | null;
  onProgress: (event: X402ProgressEvent) => void;
}

export interface ExecuteWithConnectedWalletResult {
  success: boolean;
  transactionHash?: string;
  explorerUrl?: string;
  error?: string;
}

/**
 * Encode hook data based on service type
 */
export function encodeHookData(
  service: X402Service,
  splits?: Array<{ recipient: string; bips: number }> | null
): string {
  const abiCoder = new ethers.AbiCoder();

  switch (service.hookType) {
    case "nft-mint":
      return abiCoder.encode(
        ["tuple(address)"],
        [[service.supportingContracts?.nftContract || ethers.ZeroAddress]]
      );
    case "reward-points":
      return abiCoder.encode(
        ["tuple(address)"],
        [[service.supportingContracts?.rewardToken || ethers.ZeroAddress]]
      );
    case "transfer-split":
      if (!splits || splits.length === 0) {
        return "0x"; // Empty for simple transfer
      }
      return abiCoder.encode(
        ["tuple(address recipient, uint16 bips)[]"],
        [splits.map((s) => ({ recipient: s.recipient, bips: s.bips }))]
      );
    default:
      return "0x";
  }
}

/**
 * Check if wallet is on the correct network
 */
export async function checkNetwork(
  provider: ethers.BrowserProvider
): Promise<{ isCorrect: boolean; currentChainId: number }> {
  const network = await provider.getNetwork();
  const currentChainId = Number(network.chainId);
  return {
    isCorrect: currentChainId === CRONOS_TESTNET_CHAIN_ID,
    currentChainId,
  };
}

/**
 * Request network switch to Cronos Testnet
 */
export async function switchToCronosTestnet(): Promise<boolean> {
  if (typeof window === "undefined" || !window.ethereum) {
    return false;
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${CRONOS_TESTNET_CHAIN_ID.toString(16)}` }],
    });
    return true;
  } catch (switchError: unknown) {
    // Chain not added, try to add it
    if ((switchError as { code?: number })?.code === 4902) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${CRONOS_TESTNET_CHAIN_ID.toString(16)}`,
              chainName: "Cronos Testnet",
              nativeCurrency: {
                name: "TCRO",
                symbol: "TCRO",
                decimals: 18,
              },
              rpcUrls: ["https://evm-t3.cronos.org"],
              blockExplorerUrls: ["https://explorer.cronos.org/testnet"],
            },
          ],
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

/**
 * Execute X402 service with connected wallet
 */
export async function executeWithConnectedWallet({
  service,
  splits,
  onProgress,
}: ExecuteWithConnectedWalletParams): Promise<ExecuteWithConnectedWalletResult> {
  const emitProgress = (
    type: X402ProgressEvent["type"],
    message: string,
    data?: X402ProgressEvent["data"]
  ) => {
    onProgress({ type, message, timestamp: Date.now(), data });
  };

  try {
    // Check for wallet
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("No wallet detected. Please install MetaMask or another Web3 wallet.");
    }

    emitProgress("progress", "Connecting to wallet...");

    const provider = new ethers.BrowserProvider(window.ethereum);

    // Check network
    emitProgress("progress", "Checking network...");
    const { isCorrect, currentChainId } = await checkNetwork(provider);

    if (!isCorrect) {
      emitProgress(
        "progress",
        `Wrong network (${currentChainId}). Switching to Cronos Testnet...`
      );
      const switched = await switchToCronosTestnet();
      if (!switched) {
        throw new Error("Failed to switch to Cronos Testnet. Please switch manually.");
      }
      emitProgress("progress", "Switched to Cronos Testnet");
    }

    // Get signer
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();

    emitProgress("progress", `Connected: ${signerAddress.slice(0, 6)}...${signerAddress.slice(-4)}`);

    // Check USDC balance
    emitProgress("progress", "Checking USDC balance...");
    const paymentAmount = service.defaults?.paymentAmount || "0.1";
    const requiredAmount = ethers.parseUnits(paymentAmount, 6);
    
    const usdcContract = new ethers.Contract(
      service.usdcAddress,
      ["function balanceOf(address) view returns (uint256)"],
      provider
    );
    const balance = await usdcContract.balanceOf(signerAddress);
    
    if (balance < requiredAmount) {
      const balanceFormatted = ethers.formatUnits(balance, 6);
      throw new Error(
        `Insufficient USDC balance. Required: ${paymentAmount} USDC, Available: ${balanceFormatted} USDC`
      );
    }

    // Log splits info if present
    if (splits && splits.length > 0) {
      emitProgress("progress", `Split payment to ${splits.length} recipients`);
    }

    emitProgress("progress", `Matched service: ${service.title}`, {
      service: {
        id: service.id,
        title: service.title,
        hookType: service.hookType,
      },
    });

    // Prepare transaction parameters
    emitProgress("progress", "Preparing transaction...");

    // Encode hook data with splits for transfer-split service
    const hookData = encodeHookData(service, splits);
    const salt = generateSalt();
    const validAfter = 0;
    const validBefore = Math.floor(Date.now() / 1000) + 3600; // 1 hour

    // Parse amounts (reuse paymentAmount from balance check)
    const value = ethers.parseUnits(paymentAmount, 6);
    const facilitatorFee = ethers.parseUnits(service.defaults?.facilitatorFee || "0", 6);
    const payTo = service.defaults?.payTo || ethers.ZeroAddress;

    // Calculate commitment (nonce)
    emitProgress("progress", "Calculating commitment...");

    const router = new ethers.Contract(
      service.settlementRouter,
      SETTLEMENT_ROUTER_ABI,
      provider
    );

    const nonce = await router.calculateCommitment(
      service.usdcAddress,
      signerAddress,
      value,
      validAfter,
      validBefore,
      salt,
      payTo,
      facilitatorFee,
      service.hookAddress,
      hookData
    );

    // Build EIP-712 domain - get actual chainId from provider
    const network = await provider.getNetwork();
    const actualChainId = Number(network.chainId);

    // Verify we're on the correct network
    if (actualChainId !== service.chainId) {
      throw new Error(`Please switch to the correct network. Current chainId: ${actualChainId}, expected: ${service.chainId}`);
    }

    // Query USDC contract for EIP-712 domain name and version
    const usdcForDomain = new ethers.Contract(service.usdcAddress, [
      "function name() view returns (string)",
      "function version() view returns (string)",
    ], provider);
    
    let tokenName = "USD Coin";
    let tokenVersion = "2";
    try {
      tokenName = await usdcForDomain.name();
      try {
        tokenVersion = await usdcForDomain.version();
      } catch {}
    } catch (e) {
      console.warn("Could not fetch USDC name:", e);
    }

    const message = {
      from: signerAddress,
      to: service.settlementRouter,
      value: value.toString(),
      validAfter: validAfter.toString(),
      validBefore: validBefore.toString(),
      nonce,
    };

    // Sign the typed data using eth_signTypedData_v4 (same as working dapp)
    emitProgress("progress", "Signing transaction... (check your wallet)");

    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      },
      primaryType: "TransferWithAuthorization",
      domain: {
        name: tokenName,
        version: tokenVersion,
        chainId: actualChainId,
        verifyingContract: service.usdcAddress,
      },
      message,
    };

    let signature: string;
    try {
      signature = await window.ethereum.request({
        method: "eth_signTypedData_v4",
        params: [signerAddress, JSON.stringify(typedData)],
      });
    } catch (signError: unknown) {
      if ((signError as { code?: number })?.code === 4001 || 
          (signError as { code?: string })?.code === "ACTION_REJECTED") {
        throw new Error("Transaction cancelled by user");
      }
      throw signError;
    }

    emitProgress("progress", "Transaction signed");

    // Submit transaction
    emitProgress("progress", "Submitting to blockchain...");

    const routerWithSigner = new ethers.Contract(
      service.settlementRouter,
      SETTLEMENT_ROUTER_ABI,
      signer
    );

    const tx = await routerWithSigner.settleAndExecute(
      service.usdcAddress,
      signerAddress,
      value,
      validAfter,
      validBefore,
      nonce,
      signature,
      salt,
      payTo,
      facilitatorFee,
      service.hookAddress,
      hookData
    );

    emitProgress("progress", `Transaction submitted: ${tx.hash}`);
    emitProgress("progress", "Waiting for confirmation...");

    const receipt = await tx.wait();
    const explorerUrl = `https://explorer.cronos.org/testnet/tx/${receipt.hash}`;

    // Build success message with splits info
    const successMessage = splits && splits.length > 0
      ? `Split payment confirmed to ${splits.length} recipients!`
      : "Transaction confirmed!";

    emitProgress("success", successMessage, {
      service: {
        id: service.id,
        title: service.title,
        hookType: service.hookType,
      },
      transaction: {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        from: signerAddress,
        payTo,
        amount: `${paymentAmount} USDC`,
        explorerUrl,
      },
      splits: splits?.map((s) => ({
        recipient: s.recipient,
        percentage: `${s.bips / 100}%`,
      })),
    });

    return {
      success: true,
      transactionHash: receipt.hash,
      explorerUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    emitProgress("error", message);
    return {
      success: false,
      error: message,
    };
  }
}
