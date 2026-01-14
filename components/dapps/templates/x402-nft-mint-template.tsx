"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wallet, ExternalLink, ArrowRightLeft, ImageIcon, Sparkles, Info, ChevronDown, ChevronUp } from "lucide-react";
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

// x402 constants - chain IDs for different networks
const CHAIN_IDS: Record<EthereumNetwork, number> = {
  cronos_testnet: 338,
  cronos_mainnet: 25,
};

// USDC addresses per network
// Testnet uses devUSDC.e which supports EIP-3009 transferWithAuthorization
const USDC_ADDRESSES: Record<EthereumNetwork, string> = {
  cronos_testnet: "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0", // devUSDC.e on Cronos Testnet
  cronos_mainnet: "0xc21223249CA28397B4B6541dfFaEcC539BfF0c59", // Circle USDC on Cronos
};

// Default Settlement Router on Cronos Testnet (deploy your own or use this)
const DEFAULT_SETTLEMENT_ROUTER = "0x80e941858065dfD4875030A7a30DfbfeE8c7742a";

// Helper to get read-only provider
function getReadProvider(network: EthereumNetwork): JsonRpcProvider {
  return new JsonRpcProvider(RPC_URLS[network], undefined, { staticNetwork: true });
}

// Helper to get signer from browser wallet
async function getBrowserSigner() {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("No wallet connected");
  }
  const provider = new BrowserProvider((window as any).ethereum);
  return provider.getSigner();
}

export function X402NftMintTemplate({ config, contract }: TemplateProps) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [nftStats, setNftStats] = useState<{ totalSupply: number; maxSupply: number; remaining: number } | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "signing" | "executing">("idle");
  const [userNfts, setUserNfts] = useState<number[]>([]); // Token IDs owned by user
  const [nftMetadata, setNftMetadata] = useState<Record<number, { name?: string; description?: string; image?: string; attributes?: Array<{ trait_type: string; value: string }> }>>({}); // Metadata per token
  const [expandedNft, setExpandedNft] = useState<number | null>(null); // Currently expanded NFT
  const [loadingMetadata, setLoadingMetadata] = useState<number | null>(null);

  const { theme, branding, features, x402Config, sections } = config;
  const networkName = getNetworkDisplayName(contract.network);
  const chainId = CHAIN_IDS[contract.network];
  const usdcAddress = USDC_ADDRESSES[contract.network];
  const paymentAmount = sections?.paymentButton?.amount || x402Config?.defaultPaymentAmount || "0.1";
  const paymentAmountWei = BigInt(Math.floor(parseFloat(paymentAmount) * 1_000_000)); // USDC has 6 decimals

  // Get addresses from config or use defaults
  const settlementRouterAddress = x402Config?.settlementRouterAddress || DEFAULT_SETTLEMENT_ROUTER;
  const hookAddress = contract.address; // The NFTMintHook address
  const nftContractAddress = x402Config?.nftContractAddress || ""; // RandomNFT address
  const merchantAddress = x402Config?.merchantAddress || ""; // Who receives the USDC (empty = use connected wallet)
  const facilitatorFee = BigInt(x402Config?.facilitatorFee || "0"); // Fee in USDC atomic units

  useEffect(() => {
    checkWallet();
    loadNFTStats();
    const cleanupAccounts = onAccountsChanged((accounts) => {
      if (accounts.length === 0) {
        setWalletAddress(null);
        setUserNfts([]);
      } else {
        setWalletAddress(accounts[0]);
        getCurrentNetwork().then((network) => {
          setWrongNetwork(network !== contract.network);
        });
        loadUSDCBalance(accounts[0]);
        loadUserNfts(accounts[0]);
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
      loadUSDCBalance(addr);
      loadUserNfts(addr);
    }
  };

  const loadNFTStats = async () => {
    if (!nftContractAddress) return;
    try {
      const provider = getReadProvider(contract.network);
      const nft = new ethers.Contract(nftContractAddress, [
        "function totalSupply() view returns (uint256)",
        "function MAX_SUPPLY() view returns (uint256)",
      ], provider);
      const [total, max] = await Promise.all([nft.totalSupply(), nft.MAX_SUPPLY()]);
      setNftStats({
        totalSupply: Number(total),
        maxSupply: Number(max),
        remaining: Number(max) - Number(total),
      });
    } catch (err) {
      // Silently fail - NFT contract might not be deployed yet
      console.warn("Failed to load NFT stats:", err);
      setNftStats(null);
    }
  };

  const loadUSDCBalance = async (address: string) => {
    if (!address) return;
    try {
      const provider = getReadProvider(contract.network);
      const usdc = new ethers.Contract(usdcAddress, [
        "function balanceOf(address) view returns (uint256)",
      ], provider);
      const balance = await usdc.balanceOf(address);
      setUsdcBalance((Number(balance) / 1_000_000).toFixed(2));
    } catch (err) {
      // Silently fail - USDC contract might not exist on this network or address invalid
      console.warn("Failed to load USDC balance:", err);
      setUsdcBalance(null);
    }
  };

  const loadUserNfts = async (address: string) => {
    if (!address || !nftContractAddress) {
      console.log("loadUserNfts: missing address or nftContractAddress", { address, nftContractAddress });
      return;
    }
    
    console.log("Loading NFTs for address:", address, "from contract:", nftContractAddress);
    
    try {
      const provider = getReadProvider(contract.network);
      const nft = new ethers.Contract(nftContractAddress, [
        "function balanceOf(address) view returns (uint256)",
        "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
        "function ownerOf(uint256 tokenId) view returns (address)",
        "function totalSupply() view returns (uint256)",
      ], provider);
      
      const balance = await nft.balanceOf(address);
      console.log("NFT balance:", Number(balance));
      
      if (Number(balance) === 0) {
        setUserNfts([]);
        return;
      }
      
      const tokenIds: number[] = [];
      
      // Try ERC721Enumerable first
      let useEnumerable = true;
      try {
        const testTokenId = await nft.tokenOfOwnerByIndex(address, 0);
        console.log("ERC721Enumerable supported, first token:", Number(testTokenId));
      } catch (e) {
        console.log("ERC721Enumerable not supported, falling back to scanning");
        useEnumerable = false;
      }
      
      if (useEnumerable) {
        // Use ERC721Enumerable
        for (let i = 0; i < Number(balance); i++) {
          try {
            const tokenId = await nft.tokenOfOwnerByIndex(address, i);
            tokenIds.push(Number(tokenId));
          } catch (e) {
            console.warn("Failed to get token at index", i, e);
            break;
          }
        }
      } else {
        // Fallback: scan token IDs by checking ownerOf
        // Get total supply and check each token
        try {
          const totalSupply = await nft.totalSupply();
          console.log("Total supply:", Number(totalSupply));
          
          for (let tokenId = 0; tokenId < Number(totalSupply) && tokenIds.length < Number(balance); tokenId++) {
            try {
              const owner = await nft.ownerOf(tokenId);
              if (owner.toLowerCase() === address.toLowerCase()) {
                tokenIds.push(tokenId);
                console.log("Found token owned by user:", tokenId);
              }
            } catch (e) {
              // Token might be burned or not exist
            }
          }
        } catch (e) {
          console.warn("Failed to get total supply, trying event logs");
          
          // Last resort: use Transfer event logs
          const transferFilter = nft.filters.Transfer(null, address);
          const events = await nft.queryFilter(transferFilter, -10000); // Last 10000 blocks
          
          for (const event of events) {
            const tokenId = Number((event as any).args?.tokenId || (event as any).args?.[2]);
            // Verify current owner
            try {
              const currentOwner = await nft.ownerOf(tokenId);
              if (currentOwner.toLowerCase() === address.toLowerCase()) {
                if (!tokenIds.includes(tokenId)) {
                  tokenIds.push(tokenId);
                }
              }
            } catch (e) {
              // Token might have been transferred away
            }
          }
        }
      }
      
      console.log("Found NFTs:", tokenIds);
      setUserNfts(tokenIds);
    } catch (err) {
      console.error("Failed to load user NFTs:", err);
      setUserNfts([]);
    }
  };

  const loadNftMetadata = async (tokenId: number) => {
    if (nftMetadata[tokenId] || !nftContractAddress) return;
    
    setLoadingMetadata(tokenId);
    try {
      const provider = getReadProvider(contract.network);
      const nft = new ethers.Contract(nftContractAddress, [
        "function tokenURI(uint256 tokenId) view returns (string)",
        "function ownerOf(uint256 tokenId) view returns (address)",
      ], provider);
      
      const tokenUri = await nft.tokenURI(tokenId);
      
      // Handle different URI formats
      let metadata: any = { name: `NFT #${tokenId}` };
      
      if (tokenUri) {
        try {
          // Handle base64 encoded JSON (data:application/json;base64,...)
          if (tokenUri.startsWith("data:application/json;base64,")) {
            const base64Data = tokenUri.replace("data:application/json;base64,", "");
            metadata = JSON.parse(atob(base64Data));
          }
          // Handle data:application/json (non-base64)
          else if (tokenUri.startsWith("data:application/json,")) {
            const jsonData = tokenUri.replace("data:application/json,", "");
            metadata = JSON.parse(decodeURIComponent(jsonData));
          }
          // Handle IPFS URIs
          else if (tokenUri.startsWith("ipfs://")) {
            const ipfsUrl = tokenUri.replace("ipfs://", "https://ipfs.io/ipfs/");
            const response = await fetch(ipfsUrl);
            metadata = await response.json();
          }
          // Handle HTTP URIs
          else if (tokenUri.startsWith("http")) {
            const response = await fetch(tokenUri);
            metadata = await response.json();
          }
        } catch (e) {
          console.warn(`Failed to parse metadata for token ${tokenId}:`, e);
          metadata = { name: `NFT #${tokenId}`, tokenUri };
        }
      }
      
      // Convert IPFS image URLs
      if (metadata.image?.startsWith("ipfs://")) {
        metadata.image = metadata.image.replace("ipfs://", "https://ipfs.io/ipfs/");
      }
      
      setNftMetadata(prev => ({ ...prev, [tokenId]: metadata }));
    } catch (err) {
      console.warn(`Failed to load metadata for token ${tokenId}:`, err);
      setNftMetadata(prev => ({ ...prev, [tokenId]: { name: `NFT #${tokenId}`, error: true } as any }));
    } finally {
      setLoadingMetadata(null);
    }
  };

  const toggleNftExpand = (tokenId: number) => {
    if (expandedNft === tokenId) {
      setExpandedNft(null);
    } else {
      setExpandedNft(tokenId);
      loadNftMetadata(tokenId);
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
      loadUSDCBalance(addr);
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

  const handlePayAndMint = async () => {
    if (!walletAddress || !nftContractAddress) {
      setError("Missing configuration. Please ensure NFT contract address is set.");
      return;
    }

    setLoading("mint");
    setError(null);
    setTxHash(null);
    setStep("signing");

    try {
      const signer = await getBrowserSigner();
      if (!signer) throw new Error("No signer available");

      // Generate salt
      const salt = ethers.hexlify(ethers.randomBytes(32));
      
      // Encode hookData for NFTMintHook: struct MintConfig { address nftContract; }
      const abiCoder = new ethers.AbiCoder();
      const hookData = abiCoder.encode(["tuple(address)"], [[nftContractAddress]]);

      // Time bounds
      const validAfter = 0;
      const validBefore = Math.floor(Date.now() / 1000) + 3600; // 1 hour

      // Calculate commitment hash (this becomes the nonce)
      const router = new ethers.Contract(settlementRouterAddress, [
        "function calculateCommitment(address token, address from, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 salt, address payTo, uint256 facilitatorFee, address hook, bytes calldata hookData) view returns (bytes32)",
        "function settleAndExecute(address token, address from, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes calldata signature, bytes32 salt, address payTo, uint256 facilitatorFee, address hook, bytes calldata hookData) external",
      ], signer);

      const payTo = merchantAddress || walletAddress; // If no merchant configured, pay back to self (for testing)
      
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

      // Query the USDC contract for its EIP-712 domain
      // The contract stores the chainId it was deployed with - we need to match it
      const usdcContract = new ethers.Contract(usdcAddress, [
        "function name() view returns (string)",
        "function version() view returns (string)",
        "function DOMAIN_SEPARATOR() view returns (bytes32)",
      ], signer);
      
      let tokenName = "USD Coin";
      let tokenVersion = "2";
      try {
        tokenName = await usdcContract.name();
        try {
          tokenVersion = await usdcContract.version();
        } catch {
          // Default to "2" if version() doesn't exist
        }
      } catch (e) {
        console.warn("Could not fetch USDC name, using default:", e);
      }

      // Get the actual chain ID from the connected wallet
      const provider = new BrowserProvider((window as any).ethereum);
      const network = await provider.getNetwork();
      const actualChainId = Number(network.chainId);
      
      console.log("Wallet connected to chainId:", actualChainId);
      console.log("Contract network:", contract.network);
      console.log("Expected chainId for network:", chainId);

      // Verify wallet is on correct network
      if (actualChainId !== chainId) {
        throw new Error(`Please switch to ${getNetworkDisplayName(contract.network)}. Current chainId: ${actualChainId}, expected: ${chainId}`);
      }

      // Try to get the stored DOMAIN_SEPARATOR to debug
      try {
        const storedDomainSeparator = await usdcContract.DOMAIN_SEPARATOR();
        console.log("Stored DOMAIN_SEPARATOR:", storedDomainSeparator);
        
        // Calculate what we think it should be
        const expectedDomainSeparator = ethers.keccak256(
          ethers.AbiCoder.defaultAbiCoder().encode(
            ["bytes32", "bytes32", "bytes32", "uint256", "address"],
            [
              ethers.keccak256(ethers.toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
              ethers.keccak256(ethers.toUtf8Bytes(tokenName)),
              ethers.keccak256(ethers.toUtf8Bytes(tokenVersion)),
              actualChainId,
              usdcAddress,
            ]
          )
        );
        console.log("Expected DOMAIN_SEPARATOR (chainId=" + actualChainId + "):", expectedDomainSeparator);
        
        // Try with chainId 1 (mainnet) - some test tokens are deployed with mainnet chainId
        const mainnetDomainSeparator = ethers.keccak256(
          ethers.AbiCoder.defaultAbiCoder().encode(
            ["bytes32", "bytes32", "bytes32", "uint256", "address"],
            [
              ethers.keccak256(ethers.toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
              ethers.keccak256(ethers.toUtf8Bytes(tokenName)),
              ethers.keccak256(ethers.toUtf8Bytes(tokenVersion)),
              1,
              usdcAddress,
            ]
          )
        );
        console.log("Expected DOMAIN_SEPARATOR (chainId=1):", mainnetDomainSeparator);
      } catch (e) {
        console.warn("Could not fetch DOMAIN_SEPARATOR:", e);
      }

      // Sign EIP-712 message for USDC transferWithAuthorization
      const domain = {
        name: tokenName,
        version: tokenVersion,
        chainId: actualChainId,
        verifyingContract: usdcAddress,
      };
      
      console.log("EIP-712 Domain:", domain);

      const types = {
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      };

      const message = {
        from: walletAddress,
        to: settlementRouterAddress,
        value: paymentAmountWei.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      };

      // Use eth_signTypedData_v4 directly for better wallet compatibility
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

      console.log("Full typed data for signing:", JSON.stringify(typedData, null, 2));

      // Request signature from user using eth_signTypedData_v4
      const signature = await (window as any).ethereum.request({
        method: "eth_signTypedData_v4",
        params: [walletAddress, JSON.stringify(typedData)],
      });

      setStep("executing");

      // Execute settlement (user acts as facilitator)
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
      
      // Wait for confirmation
      await tx.wait();
      
      // Refresh stats and user NFTs
      loadNFTStats();
      loadUSDCBalance(walletAddress);
      loadUserNfts(walletAddress);

    } catch (err: any) {
      console.error("Mint failed:", err);
      if (err.code === "ACTION_REJECTED" || err.code === 4001) {
        setError("Transaction cancelled by user");
      } else if (err.message?.includes("insufficient")) {
        setError("Insufficient USDC balance");
      } else {
        setError(err.message || "Mint failed");
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
        <Card className="mb-8 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-1">x402 Atomic Payment</p>
                <p className="text-blue-700 dark:text-blue-300">
                  Pay {paymentAmount} USDC and mint your NFT in a single atomic transaction. 
                  You'll sign an EIP-3009 authorization, then the settlement executes automatically.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Mint Card */}
          <Card className="overflow-hidden">
            <div className="aspect-square bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center">
              <ImageIcon className="h-24 w-24 text-orange-300" />
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">Mint Price</span>
                <span className="text-2xl font-bold" style={{ color: theme.primaryColor }}>
                  {paymentAmount} USDC
                </span>
              </div>
              
              {!walletAddress ? (
                <Button onClick={handleConnect} disabled={loading === "connect"} className="w-full h-14 text-lg" style={{ backgroundColor: theme.primaryColor }}>
                  {loading === "connect" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wallet className="mr-2 h-5 w-5" />}
                  Connect to Mint
                </Button>
              ) : wrongNetwork ? (
                <Button onClick={handleSwitchNetwork} disabled={loading === "switch"} className="w-full h-14 text-lg" variant="destructive">
                  {loading === "switch" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ArrowRightLeft className="mr-2 h-5 w-5" />}
                  Switch Network
                </Button>
              ) : (
                <Button onClick={handlePayAndMint} disabled={loading === "mint" || !nftContractAddress} className="w-full h-14 text-lg" style={{ backgroundColor: theme.primaryColor }}>
                  {loading === "mint" ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {step === "signing" ? "Sign in Wallet..." : "Minting..."}
                    </>
                  ) : (
                    <><Sparkles className="mr-2 h-5 w-5" /> {sections?.paymentButton?.title || "Pay & Mint NFT"}</>
                  )}
                </Button>
              )}

              {!nftContractAddress && (
                <p className="text-sm text-amber-600 text-center">
                  ⚠️ NFT contract address not configured
                </p>
              )}
            </CardContent>
          </Card>

          {/* Stats Card */}
          <div className="space-y-4">
            {sections?.contractStats?.enabled && nftStats && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">{sections.contractStats.title}</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Minted</span>
                      <span className="font-semibold">{nftStats.totalSupply}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max Supply</span>
                      <span className="font-semibold">{nftStats.maxSupply}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Remaining</span>
                      <span className="font-semibold text-green-600">{nftStats.remaining}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="h-2 rounded-full" 
                        style={{ 
                          width: `${(nftStats.totalSupply / nftStats.maxSupply) * 100}%`,
                          backgroundColor: theme.primaryColor 
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {sections?.walletInfo?.enabled && walletAddress && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">{sections.walletInfo.title}</h3>
                  <p className="font-mono text-sm text-muted-foreground break-all">{walletAddress}</p>
                  {usdcBalance && (
                    <p className="mt-2 text-sm">
                      Balance: <span className="font-semibold">{usdcBalance} USDC</span>
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Contract Info */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Contract Addresses</h3>
                <div className="space-y-2 text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground">Hook: </span>
                    <a href={getBlockExplorerUrl(contract.network, hookAddress)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {hookAddress.slice(0, 10)}...
                    </a>
                  </div>
                  {nftContractAddress && (
                    <div>
                      <span className="text-muted-foreground">NFT: </span>
                      <a href={getBlockExplorerUrl(contract.network, nftContractAddress)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {nftContractAddress.slice(0, 10)}...
                      </a>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Router: </span>
                    <a href={getBlockExplorerUrl(contract.network, settlementRouterAddress)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {settlementRouterAddress.slice(0, 10)}...
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* My NFTs Section */}
        {walletAddress && userNfts.length > 0 && (
          <Card className="mt-8">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">🎨 My NFTs ({userNfts.length})</h3>
              <div className="space-y-3">
                {userNfts.map((tokenId) => {
                  const metadata = nftMetadata[tokenId];
                  const isExpanded = expandedNft === tokenId;
                  const isLoading = loadingMetadata === tokenId;
                  
                  return (
                    <div key={tokenId} className="border rounded-lg overflow-hidden">
                      {/* NFT Header - Always visible */}
                      <button
                        onClick={() => toggleNftExpand(tokenId)}
                        className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center">
                            {metadata?.image ? (
                              <img src={metadata.image} alt={metadata.name || `NFT #${tokenId}`} className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <ImageIcon className="h-6 w-6 text-orange-300" />
                            )}
                          </div>
                          <div className="text-left">
                            <p className="font-semibold" style={{ color: theme.primaryColor }}>
                              {metadata?.name || `NFT #${tokenId}`}
                            </p>
                            <p className="text-xs text-muted-foreground">Token ID: {tokenId}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </button>
                      
                      {/* NFT Details - Expandable */}
                      {isExpanded && (
                        <div className="border-t p-4 bg-muted/30">
                          {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                              <span className="ml-2 text-muted-foreground">Loading metadata...</span>
                            </div>
                          ) : metadata ? (
                            <div className="grid md:grid-cols-2 gap-4">
                              {/* Image */}
                              <div className="aspect-square rounded-lg bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center overflow-hidden">
                                {metadata.image ? (
                                  <img src={metadata.image} alt={metadata.name || `NFT #${tokenId}`} className="w-full h-full object-contain" />
                                ) : (
                                  <ImageIcon className="h-16 w-16 text-orange-300" />
                                )}
                              </div>
                              
                              {/* Details */}
                              <div className="space-y-3">
                                <div>
                                  <p className="text-sm text-muted-foreground">Name</p>
                                  <p className="font-semibold">{metadata.name || `NFT #${tokenId}`}</p>
                                </div>
                                
                                {metadata.description && (
                                  <div>
                                    <p className="text-sm text-muted-foreground">Description</p>
                                    <p className="text-sm">{metadata.description}</p>
                                  </div>
                                )}
                                
                                {metadata.attributes && metadata.attributes.length > 0 && (
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-2">Attributes</p>
                                    <div className="flex flex-wrap gap-2">
                                      {metadata.attributes.map((attr, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-xs">
                                          {attr.trait_type}: {attr.value}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                <div className="pt-2">
                                  <a
                                    href={`${getBlockExplorerUrl(contract.network, nftContractAddress)}#tokentxnsErc721`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
                                  >
                                    View on Explorer <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-muted-foreground text-center py-4">No metadata available</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transaction Status */}
        {(txHash || error) && (
          <Card className={`mt-8 ${error ? "border-destructive" : "border-green-500"}`}>
            <CardContent className="p-4">
              {txHash && (
                <div className="flex items-center justify-between text-green-600">
                  <span className="font-medium">🎉 NFT Minted Successfully!</span>
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
            <p className="text-sm text-muted-foreground mb-2">Powered by x402 Settlement Protocol</p>
            <a
              href={getBlockExplorerUrl(contract.network, contract.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"
            >
              Hook Contract: {contract.address} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
