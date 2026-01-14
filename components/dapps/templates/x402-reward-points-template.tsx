"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wallet, ExternalLink, ArrowRightLeft, Gift, Star, TrendingUp, Info } from "lucide-react";
import type { TemplateProps } from "./types";
import { getBlockExplorerUrl, getNetworkDisplayName } from "@/lib/contracts/network-config";
import {
  connectWallet,
  switchWallet,
  getCurrentNetwork,
  switchNetwork,
  getWalletAddress,
  isMetaMaskInstalled,
  onAccountsChanged,
  onChainChanged,
} from "@/lib/contracts/web3-service";
import { ethers, BrowserProvider, JsonRpcProvider } from "ethers";
import { RPC_URLS } from "@/lib/contracts/network-config";
import type { EthereumNetwork } from "@/lib/db/schema";

// x402 constants
const CHAIN_IDS: Record<EthereumNetwork, number> = {
  cronos_testnet: 338,
  cronos_mainnet: 25,
};

const USDC_ADDRESSES: Record<EthereumNetwork, string> = {
  cronos_testnet: "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0",
  cronos_mainnet: "0xc21223249CA28397B4B6541dfFaEcC539BfF0c59",
};

const DEFAULT_SETTLEMENT_ROUTER = "0x80e941858065dfD4875030A7a30DfbfeE8c7742a";

function getReadProvider(network: EthereumNetwork): JsonRpcProvider {
  return new JsonRpcProvider(RPC_URLS[network], undefined, { staticNetwork: true });
}

async function getBrowserSigner() {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("No wallet connected");
  }
  const provider = new BrowserProvider((window as any).ethereum);
  return provider.getSigner();
}

export function X402RewardPointsTemplate({ config, contract }: TemplateProps) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [rewardBalance, setRewardBalance] = useState<string>("0");
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "signing" | "executing">("idle");
  const [lastEarned, setLastEarned] = useState<string | null>(null);

  const { theme, branding, features, x402Config, sections } = config;
  const networkName = getNetworkDisplayName(contract.network);
  const chainId = CHAIN_IDS[contract.network];
  const usdcAddress = USDC_ADDRESSES[contract.network];
  const paymentAmount = sections?.paymentButton?.amount || x402Config?.defaultPaymentAmount || "0.1";
  const paymentAmountWei = BigInt(Math.floor(parseFloat(paymentAmount) * 1_000_000));

  // Get addresses from config
  const settlementRouterAddress = x402Config?.settlementRouterAddress || DEFAULT_SETTLEMENT_ROUTER;
  const hookAddress = contract.address;
  const rewardTokenAddress = x402Config?.rewardTokenAddress || "";
  const merchantAddress = x402Config?.merchantAddress || "";
  const facilitatorFee = BigInt(x402Config?.facilitatorFee || "0");

  useEffect(() => {
    checkWallet();
    const cleanupAccounts = onAccountsChanged((accounts) => {
      if (accounts.length === 0) {
        setWalletAddress(null);
        setRewardBalance("0");
      } else {
        setWalletAddress(accounts[0]);
        getCurrentNetwork().then((network) => {
          setWrongNetwork(network !== contract.network);
        });
        loadBalances(accounts[0]);
      }
    });
    const cleanupChain = onChainChanged(() => window.location.reload());
    return () => { cleanupAccounts(); cleanupChain(); };
  }, []);

  const checkWallet = async () => {
    const addr = await getWalletAddress();
    if (addr) {
      setWalletAddress(addr);
      const currentNetwork = await getCurrentNetwork();
      setWrongNetwork(currentNetwork !== contract.network);
      loadBalances(addr);
    }
  };

  const loadBalances = async (address: string) => {
    if (!address) return;
    
    // Load USDC balance
    try {
      const provider = getReadProvider(contract.network);
      const usdc = new ethers.Contract(usdcAddress, [
        "function balanceOf(address) view returns (uint256)",
      ], provider);
      const balance = await usdc.balanceOf(address);
      setUsdcBalance((Number(balance) / 1_000_000).toFixed(2));
    } catch (err) {
      console.warn("Failed to load USDC balance:", err);
    }
    
    // Load reward token balance
    if (rewardTokenAddress) {
      try {
        console.log("Loading reward balance for:", address, "from token:", rewardTokenAddress);
        const provider = getReadProvider(contract.network);
        const rewardToken = new ethers.Contract(rewardTokenAddress, [
          "function balanceOf(address) view returns (uint256)",
          "function decimals() view returns (uint8)",
        ], provider);
        const balance = await rewardToken.balanceOf(address);
        console.log("Raw balance:", balance.toString());
        const decimals = Number(await rewardToken.decimals().catch(() => 18));
        console.log("Decimals:", decimals);
        const formatted = (Number(balance) / Math.pow(10, decimals)).toFixed(2);
        console.log("Formatted balance:", formatted);
        setRewardBalance(formatted);
      } catch (err) {
        console.warn("Failed to load reward balance:", err);
      }
    } else {
      console.log("No rewardTokenAddress configured");
    }
  };

  const handleConnect = async () => {
    if (!isMetaMaskInstalled()) {
      setError("Please install MetaMask to continue");
      return;
    }
    setLoading("connect");
    setError(null);
    try {
      const currentNetwork = await getCurrentNetwork();
      if (currentNetwork !== contract.network) {
        const switched = await switchNetwork(contract.network);
        if (!switched) {
          setWrongNetwork(true);
          throw new Error(`Please switch to ${networkName} in MetaMask`);
        }
      }
      setWrongNetwork(false);
      const addr = await connectWallet();
      setWalletAddress(addr);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setLoading(null);
    }
  };

  const handleSwitchNetwork = async () => {
    setLoading("switch");
    try {
      const switched = await switchNetwork(contract.network);
      if (switched) setWrongNetwork(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch network");
    } finally {
      setLoading(null);
    }
  };

  const handlePayAndEarn = async () => {
    if (!walletAddress || !rewardTokenAddress) {
      setError("Missing configuration. Please ensure Reward Token address is set.");
      return;
    }

    setLoading("earn");
    setError(null);
    setTxHash(null);
    setLastEarned(null);
    setStep("signing");

    try {
      const signer = await getBrowserSigner();
      if (!signer) throw new Error("No signer available");

      // Generate salt
      const salt = ethers.hexlify(ethers.randomBytes(32));
      
      // Encode hookData for RewardHook: struct RewardConfig { address rewardToken; }
      const abiCoder = new ethers.AbiCoder();
      const hookData = abiCoder.encode(["tuple(address)"], [[rewardTokenAddress]]);

      // Time bounds
      const validAfter = 0;
      const validBefore = Math.floor(Date.now() / 1000) + 3600;

      // Calculate commitment hash
      const router = new ethers.Contract(settlementRouterAddress, [
        "function calculateCommitment(address token, address from, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 salt, address payTo, uint256 facilitatorFee, address hook, bytes calldata hookData) view returns (bytes32)",
        "function settleAndExecute(address token, address from, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes calldata signature, bytes32 salt, address payTo, uint256 facilitatorFee, address hook, bytes calldata hookData) external",
      ], signer);

      const payTo = merchantAddress || walletAddress;
      
      const nonce = await router.calculateCommitment(
        usdcAddress,
        walletAddress,
        paymentAmountWei,
        validAfter,
        validBefore,
        salt,
        payTo,
        facilitatorFee,
        hookAddress,
        hookData
      );

      // Query USDC contract for EIP-712 domain
      const usdcContract = new ethers.Contract(usdcAddress, [
        "function name() view returns (string)",
        "function version() view returns (string)",
      ], signer);
      
      let tokenName = "USD Coin";
      let tokenVersion = "2";
      try {
        tokenName = await usdcContract.name();
        try {
          tokenVersion = await usdcContract.version();
        } catch {}
      } catch (e) {
        console.warn("Could not fetch USDC name:", e);
      }

      const provider = new BrowserProvider((window as any).ethereum);
      const network = await provider.getNetwork();
      const actualChainId = Number(network.chainId);

      if (actualChainId !== chainId) {
        throw new Error(`Please switch to ${networkName}. Current chainId: ${actualChainId}, expected: ${chainId}`);
      }

      const message = {
        from: walletAddress,
        to: settlementRouterAddress,
        value: paymentAmountWei.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      };

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
          verifyingContract: usdcAddress,
        },
        message,
      };

      console.log("EIP-712 Domain:", typedData.domain);

      const signature = await (window as any).ethereum.request({
        method: "eth_signTypedData_v4",
        params: [walletAddress, JSON.stringify(typedData)],
      });

      setStep("executing");

      const tx = await router.settleAndExecute(
        usdcAddress,
        walletAddress,
        paymentAmountWei,
        validAfter,
        validBefore,
        nonce,
        signature,
        salt,
        payTo,
        facilitatorFee,
        hookAddress,
        hookData
      );

      setTxHash(tx.hash);
      
      const receipt = await tx.wait();
      
      // Try to parse reward amount from logs
      try {
        console.log("Receipt logs:", receipt.logs.length);
        const rewardEvent = receipt.logs.find((log: any) => {
          try {
            const iface = new ethers.Interface([
              "event RewardDistributed(bytes32 indexed contextKey, address indexed payer, address indexed payTo, address rewardToken, uint256 paymentAmount, uint256 rewardPoints)"
            ]);
            iface.parseLog({ topics: log.topics, data: log.data });
            return true;
          } catch { return false; }
        });
        
        console.log("Found rewardEvent:", !!rewardEvent);
        if (rewardEvent) {
          const iface = new ethers.Interface([
            "event RewardDistributed(bytes32 indexed contextKey, address indexed payer, address indexed payTo, address rewardToken, uint256 paymentAmount, uint256 rewardPoints)"
          ]);
          const parsed = iface.parseLog({ topics: rewardEvent.topics, data: rewardEvent.data });
          console.log("Parsed args:", parsed?.args);
          console.log("rewardPoints raw:", parsed?.args.rewardPoints?.toString());
          const points = Number(parsed?.args.rewardPoints || 0) / 1e18;
          console.log("Points calculated:", points);
          setLastEarned(points.toFixed(2));
        }
      } catch (e) {
        console.warn("Could not parse reward event:", e);
      }
      
      loadBalances(walletAddress);

    } catch (err: any) {
      console.error("Earn failed:", err);
      if (err.code === "ACTION_REJECTED" || err.code === 4001) {
        setError("Transaction cancelled by user");
      } else if (err.message?.includes("insufficient")) {
        setError("Insufficient USDC balance");
      } else {
        setError(err.message || "Transaction failed");
      }
    } finally {
      setLoading(null);
      setStep("idle");
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}>
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logoUrl && <img src={branding.logoUrl} alt="Logo" className="h-8" />}
            <span className="font-bold text-xl" style={{ color: theme.primaryColor }}>{branding.title}</span>
            {features.showNetworkBadge && (
              <Badge variant={contract.network === "cronos_mainnet" ? "default" : "secondary"} className="hidden sm:inline-flex">
                {networkName}
              </Badge>
            )}
          </div>
          
          {!walletAddress ? (
            <Button onClick={handleConnect} disabled={loading === "connect"} style={{ backgroundColor: theme.primaryColor }}>
              {loading === "connect" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
              Connect Wallet
            </Button>
          ) : wrongNetwork ? (
            <Button onClick={handleSwitchNetwork} disabled={loading === "switch"} variant="destructive">
              {loading === "switch" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
              Switch to {networkName}
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              {usdcBalance && (
                <span className="text-sm text-muted-foreground">{usdcBalance} USDC</span>
              )}
              <Button variant="outline" onClick={() => switchWallet()} className="font-mono">
                <Wallet className="mr-2 h-4 w-4" />
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: theme.primaryColor }}>
            {branding.title}
          </h1>
          {branding.subtitle && (
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">{branding.subtitle}</p>
          )}
        </div>

        {/* x402 Info Banner */}
        <Card className="mb-8 border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                <p className="font-medium mb-1">x402 Atomic Payment</p>
                <p className="text-yellow-700 dark:text-yellow-300">
                  Pay {paymentAmount} USDC and earn reward points in a single atomic transaction. 
                  You'll sign an EIP-3009 authorization, then the settlement executes automatically.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Reward Balance Card */}
          <Card className="overflow-hidden">
            <div className="p-6" style={{ background: `linear-gradient(135deg, ${theme.primaryColor}15 0%, transparent 100%)` }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${theme.primaryColor}20` }}>
                  <Star className="h-5 w-5" style={{ color: theme.primaryColor }} />
                </div>
                <span className="text-sm text-muted-foreground">Your Points (X402RP)</span>
              </div>
              <p className="text-3xl font-bold" style={{ color: theme.primaryColor }}>
                {walletAddress ? rewardBalance : "—"}
              </p>
            </div>
          </Card>

          {/* Last Earned Card */}
          <Card className="overflow-hidden">
            <div className="p-6" style={{ background: `linear-gradient(135deg, ${theme.accentColor}15 0%, transparent 100%)` }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${theme.accentColor}20` }}>
                  <TrendingUp className="h-5 w-5" style={{ color: theme.accentColor }} />
                </div>
                <span className="text-sm text-muted-foreground">Last Earned</span>
              </div>
              <p className="text-3xl font-bold" style={{ color: theme.accentColor }}>
                {lastEarned ? `+${lastEarned}` : "—"}
              </p>
            </div>
          </Card>

          {/* Reward Rate Card */}
          <Card className="overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-muted">
                  <Gift className="h-5 w-5 text-muted-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">Reward Rate</span>
              </div>
              <p className="text-3xl font-bold">10x per USDC</p>
              <p className="text-xs text-muted-foreground mt-1">1 USDC = 10 X402RP</p>
            </div>
          </Card>
        </div>

        {/* Earn Card */}
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 space-y-6">
            <div className="text-center">
              <Gift className="h-16 w-16 mx-auto mb-4" style={{ color: theme.primaryColor }} />
              <h2 className="text-2xl font-bold mb-2">Earn Reward Points</h2>
              <p className="text-muted-foreground">
                Pay {paymentAmount} USDC and earn random reward points!
              </p>
            </div>
            
            {!walletAddress ? (
              <Button onClick={handleConnect} disabled={loading === "connect"} className="w-full h-14 text-lg" style={{ backgroundColor: theme.primaryColor }}>
                {loading === "connect" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wallet className="mr-2 h-5 w-5" />}
                Connect to Earn
              </Button>
            ) : wrongNetwork ? (
              <Button onClick={handleSwitchNetwork} disabled={loading === "switch"} className="w-full h-14 text-lg" variant="destructive">
                {loading === "switch" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ArrowRightLeft className="mr-2 h-5 w-5" />}
                Switch Network
              </Button>
            ) : (
              <Button onClick={handlePayAndEarn} disabled={loading === "earn" || !rewardTokenAddress} className="w-full h-14 text-lg" style={{ backgroundColor: theme.primaryColor }}>
                {loading === "earn" ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {step === "signing" ? "Sign in Wallet..." : "Processing..."}
                  </>
                ) : (
                  <><Gift className="mr-2 h-5 w-5" /> {sections?.paymentButton?.title || "Pay & Earn Points"}</>
                )}
              </Button>
            )}

            {!rewardTokenAddress && (
              <p className="text-sm text-amber-600 text-center">
                ⚠️ Reward Token address not configured
              </p>
            )}
          </CardContent>
        </Card>

        {/* Transaction Status */}
        {(txHash || error) && (
          <Card className={`mt-8 max-w-md mx-auto ${error ? "border-destructive" : "border-green-500"}`}>
            <CardContent className="p-4">
              {txHash && (
                <div className="flex items-center justify-between text-green-600">
                  <span className="font-medium">Points Earned!</span>
                  <a
                    href={`${getBlockExplorerUrl(contract.network, txHash).replace("/address/", "/tx/")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm hover:underline flex items-center gap-1"
                  >
                    View TX <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {error && <p className="text-destructive">{error}</p>}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        {features.showContractInfo && (
          <div className="text-center mt-12 pt-8 border-t">
            <a
              href={getBlockExplorerUrl(contract.network, contract.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"
            >
              Contract: {contract.address} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
