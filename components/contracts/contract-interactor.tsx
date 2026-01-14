"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, ExternalLink, ChevronDown, ChevronUp, BookOpen, Pencil, Coins, Wallet } from "lucide-react";
import type { UserContract, EthereumNetwork } from "@/lib/db/schema";
import { getBlockExplorerUrl, getUsdcAddress, getNetworkDisplayName, getBlockExplorerTxUrl } from "@/lib/contracts/network-config";
import { readContract, writeContract, connectWallet, getCurrentNetwork, switchNetwork } from "@/lib/contracts/web3-service";
import { useWallet } from "@/lib/contracts/wallet-context";

// Standard ERC20 ABI for approve and allowance
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
];

interface AbiItem {
  type: string;
  name?: string;
  inputs?: Array<{ name: string; type: string; internalType?: string }>;
  outputs?: Array<{ name: string; type: string; internalType?: string }>;
  stateMutability?: string;
}

interface ContractInteractorProps {
  contract: UserContract;
  onClose: () => void;
}

export function ContractInteractor({ contract, onClose }: ContractInteractorProps) {
  const { address: walletAddress, network: walletNetwork, isConnecting, connect, switchToNetwork } = useWallet();
  const [walletError, setWalletError] = useState<string | null>(null);

  const abi = contract.abi as AbiItem[];
  const readFunctions = abi.filter(
    (item) => item.type === "function" && (item.stateMutability === "view" || item.stateMutability === "pure")
  );
  const writeFunctions = abi.filter(
    (item) => item.type === "function" && item.stateMutability !== "view" && item.stateMutability !== "pure"
  );

  const handleConnectWallet = async () => {
    setWalletError(null);
    try {
      await connect(contract.network);
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : "Failed to connect wallet");
    }
  };

  const isCorrectNetwork = walletNetwork === contract.network;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50">
      <div className="fixed inset-4 bg-background border rounded-lg shadow-lg flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">{contract.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={contract.network === "cronos_mainnet" ? "default" : "secondary"}>
                {getNetworkDisplayName(contract.network)}
              </Badge>
              <a
                href={getBlockExplorerUrl(contract.network, contract.contractAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
              >
                {contract.contractAddress.slice(0, 10)}...{contract.contractAddress.slice(-8)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Tabs defaultValue="usdc" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-4">
            <TabsTrigger value="usdc" className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              USDC Token
            </TabsTrigger>
            <TabsTrigger value="read" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Read ({readFunctions.length})
            </TabsTrigger>
            <TabsTrigger value="write" className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Write ({writeFunctions.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="usdc" className="flex-1 overflow-auto p-4">
            <UsdcTokenPanel
              spenderAddress={contract.contractAddress}
              network={contract.network}
            />
          </TabsContent>
          <TabsContent value="read" className="flex-1 overflow-auto p-4">
            <div className="space-y-2">
              {readFunctions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No read functions available</p>
              ) : (
                readFunctions.map((fn, i) => (
                  <FunctionCard
                    key={`${fn.name}-${i}`}
                    fn={fn}
                    contractAddress={contract.contractAddress}
                    network={contract.network}
                    abi={abi}
                    isWrite={false}
                  />
                ))
              )}
            </div>
          </TabsContent>
          <TabsContent value="write" className="flex-1 overflow-auto p-4">
            <div className="space-y-4">
              {/* Wallet Connection Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Wallet Connection
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {walletAddress ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Connected: </span>
                          <span className="font-mono text-xs">{walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}</span>
                        </div>
                        <Badge variant={isCorrectNetwork ? "default" : "destructive"}>
                          {walletNetwork ? getNetworkDisplayName(walletNetwork) : "Unknown Network"}
                        </Badge>
                      </div>
                      {!isCorrectNetwork && (
                        <div className="p-2 bg-amber-50 dark:bg-amber-950 rounded text-sm text-amber-700 dark:text-amber-300">
                          Please switch to {getNetworkDisplayName(contract.network)} to interact with this contract.
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="ml-2"
                            onClick={() => switchToNetwork(contract.network)}
                          >
                            Switch Network
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Connect your wallet to execute write functions. Supports Meteor, MetaMask, and other Cronos-compatible wallets.
                      </p>
                      <Button onClick={handleConnectWallet} disabled={isConnecting} className="w-full">
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
                      {walletError && (
                        <div className="p-2 bg-destructive/10 rounded text-sm text-destructive">{walletError}</div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Write Functions */}
              {writeFunctions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No write functions available</p>
              ) : (
                writeFunctions.map((fn, i) => (
                  <FunctionCard
                    key={`${fn.name}-${i}`}
                    fn={fn}
                    contractAddress={contract.contractAddress}
                    network={contract.network}
                    abi={abi}
                    isWrite={true}
                    walletConnected={!!walletAddress && isCorrectNetwork}
                    onConnectWallet={handleConnectWallet}
                  />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// USDC Token Panel for approve/allowance operations
function UsdcTokenPanel({ spenderAddress, network }: { spenderAddress: string; network: EthereumNetwork }) {
  const [approveAmount, setApproveAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAllowance, setCheckingAllowance] = useState(false);
  const [allowance, setAllowance] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const usdcAddress = getUsdcAddress(network);

  const checkAllowanceAndBalance = async () => {
    setCheckingAllowance(true);
    setError(null);
    try {
      const currentNetwork = await getCurrentNetwork();
      if (currentNetwork !== network) {
        const switched = await switchNetwork(network);
        if (!switched) {
          throw new Error(`Please switch your wallet to ${getNetworkDisplayName(network)}`);
        }
      }

      const address = await connectWallet(network);
      setWalletAddress(address);

      const [allowanceResult, balanceResult] = await Promise.all([
        readContract(usdcAddress, ERC20_ABI, "allowance", [address, spenderAddress], network),
        readContract(usdcAddress, ERC20_ABI, "balanceOf", [address], network),
      ]);

      setAllowance(formatResult(allowanceResult));
      setBalance(formatResult(balanceResult));
    } catch (err) {
      console.error("Check allowance error:", err);
      setError(err instanceof Error ? err.message : "Failed to check allowance");
    } finally {
      setCheckingAllowance(false);
    }
  };

  const handleApprove = async () => {
    if (!approveAmount) return;
    setLoading(true);
    setError(null);
    setTxHash(null);

    try {
      const currentNetwork = await getCurrentNetwork();
      if (currentNetwork !== network) {
        const switched = await switchNetwork(network);
        if (!switched) {
          throw new Error(`Please switch your wallet to ${getNetworkDisplayName(network)}`);
        }
      }

      await connectWallet(network);

      const response = await writeContract(usdcAddress, ERC20_ABI, "approve", [spenderAddress, approveAmount]);
      if (response.success && response.transactionHash) {
        setTxHash(response.transactionHash);
        // Refresh allowance after approval
        setTimeout(checkAllowanceAndBalance, 2000);
      } else {
        throw new Error(response.error || "Approval failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveMax = () => {
    // Max uint256
    setApproveAmount("115792089237316195423570985008687907853269984665640564039457584007913129639935");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-4 w-4" />
            USDC Token ({getNetworkDisplayName(network)})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Token Address: </span>
            <a
              href={getBlockExplorerUrl(network, usdcAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs hover:underline inline-flex items-center gap-1"
            >
              {usdcAddress.slice(0, 10)}...{usdcAddress.slice(-8)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Spender (this contract): </span>
            <span className="font-mono text-xs">{spenderAddress.slice(0, 10)}...{spenderAddress.slice(-8)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Check Allowance & Balance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={checkAllowanceAndBalance} disabled={checkingAllowance} variant="secondary" className="w-full">
            {checkingAllowance ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              "Check Allowance & Balance"
            )}
          </Button>
          {walletAddress && (
            <div className="text-sm">
              <span className="text-muted-foreground">Your Wallet: </span>
              <span className="font-mono text-xs">{walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}</span>
            </div>
          )}
          {balance !== null && (
            <div className="text-sm">
              <span className="text-muted-foreground">Your USDC Balance: </span>
              <span className="font-mono">{balance}</span>
            </div>
          )}
          {allowance !== null && (
            <div className="text-sm">
              <span className="text-muted-foreground">Current Allowance: </span>
              <span className="font-mono">{allowance}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Approve USDC Spending</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Before using functions like stake() or pay(), you need to approve this contract to spend your USDC tokens.
          </p>
          <div>
            <label className="text-xs text-muted-foreground">Amount (raw units, USDC has 6 decimals)</label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., 1000000000 for 1000 USDC"
                value={approveAmount}
                onChange={(e) => setApproveAmount(e.target.value)}
                className="font-mono text-sm"
              />
              <Button variant="outline" size="sm" onClick={handleApproveMax}>
                Max
              </Button>
            </div>
          </div>
          <Button onClick={handleApprove} disabled={loading || !approveAmount} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Approving...
              </>
            ) : (
              "Approve"
            )}
          </Button>
          {txHash && (
            <div className="p-2 bg-green-50 dark:bg-green-950 rounded text-sm">
              <span className="text-green-600 dark:text-green-400">Approval sent: </span>
              <a
                href={getBlockExplorerTxUrl(network, txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs hover:underline"
              >
                {txHash.slice(0, 16)}...
              </a>
            </div>
          )}
          {error && <div className="p-2 bg-destructive/10 rounded text-sm text-destructive">{error}</div>}
        </CardContent>
      </Card>
    </div>
  );
}


interface FunctionCardProps {
  fn: AbiItem;
  contractAddress: string;
  network: EthereumNetwork;
  abi: AbiItem[];
  isWrite: boolean;
  walletConnected?: boolean;
  onConnectWallet?: () => void;
}

function FunctionCard({ fn, contractAddress, network, abi, isWrite, walletConnected, onConnectWallet }: FunctionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const hasInputs = fn.inputs && fn.inputs.length > 0;
  const hasOutputs = fn.outputs && fn.outputs.length > 0;

  const handleQuery = async () => {
    if (!fn.name) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const args = fn.inputs?.map((input) => {
        const value = inputs[input.name] || "";
        return parseInputValue(value, input.type);
      }) || [];

      const response = await readContract(contractAddress, abi, fn.name, args, network);
      setResult(formatResult(response));
    } catch (err) {
      console.error("Read contract error:", err);
      const message = err instanceof Error ? err.message : "Query failed";
      if (message.includes("timeout") || message.includes("abort")) {
        setError("Request timed out. Try switching your wallet to the correct network.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleWrite = async () => {
    if (!fn.name) return;
    setLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // Check network
      const currentNetwork = await getCurrentNetwork();
      if (currentNetwork !== network) {
        const switched = await switchNetwork(network);
        if (!switched) {
          throw new Error(`Please switch to ${getNetworkDisplayName(network)}`);
        }
      }

      await connectWallet(network);

      const args = fn.inputs?.map((input) => {
        const value = inputs[input.name] || "";
        return parseInputValue(value, input.type);
      }) || [];

      const response = await writeContract(contractAddress, abi, fn.name, args);
      if (response.success && response.transactionHash) {
        setTxHash(response.transactionHash);
      } else {
        throw new Error(response.error || "Transaction failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader
        className="py-3 px-4 cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">{fn.name}</span>
            {hasInputs && (
              <span className="text-xs text-muted-foreground">
                ({fn.inputs?.map((i) => i.type).join(", ")})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasOutputs && (
              <span className="text-xs text-muted-foreground">
                → {fn.outputs?.map((o) => o.type).join(", ")}
              </span>
            )}
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 pb-4 px-4 space-y-3">
          {hasInputs && (
            <div className="space-y-2">
              {fn.inputs?.map((input) => (
                <div key={input.name}>
                  <label className="text-xs text-muted-foreground">
                    {input.name} ({input.type})
                  </label>
                  <Input
                    placeholder={getPlaceholder(input.type)}
                    value={inputs[input.name] || ""}
                    onChange={(e) => setInputs({ ...inputs, [input.name]: e.target.value })}
                    className="font-mono text-sm"
                  />
                </div>
              ))}
            </div>
          )}
          {isWrite && !walletConnected ? (
            <Button
              onClick={onConnectWallet}
              size="sm"
              variant="outline"
            >
              <Wallet className="mr-2 h-3 w-3" />
              Connect Wallet to Write
            </Button>
          ) : (
            <Button
              onClick={isWrite ? handleWrite : handleQuery}
              disabled={loading}
              size="sm"
              variant={isWrite ? "default" : "secondary"}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  {isWrite ? "Confirming..." : "Querying..."}
                </>
              ) : isWrite ? (
                "Write"
              ) : (
                "Query"
              )}
            </Button>
          )}
          {result !== null && (
            <div className="p-2 bg-muted rounded text-sm font-mono break-all">{result}</div>
          )}
          {txHash && (
            <div className="p-2 bg-green-50 dark:bg-green-950 rounded text-sm">
              <span className="text-green-600 dark:text-green-400">Transaction sent: </span>
              <a
                href={getBlockExplorerTxUrl(network, txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs hover:underline"
              >
                {txHash.slice(0, 16)}...
              </a>
            </div>
          )}
          {error && <div className="p-2 bg-destructive/10 rounded text-sm text-destructive">{error}</div>}
        </CardContent>
      )}
    </Card>
  );
}

function parseInputValue(value: string, type: string): unknown {
  if (type.startsWith("uint") || type.startsWith("int")) {
    return value; // ethers handles BigInt conversion
  }
  if (type === "bool") {
    return value.toLowerCase() === "true";
  }
  if (type.endsWith("[]")) {
    try {
      return JSON.parse(value);
    } catch {
      return value.split(",").map((v) => v.trim());
    }
  }
  return value;
}

function formatResult(result: unknown): string {
  if (result === null || result === undefined) return "null";
  if (typeof result === "bigint") return result.toString();
  if (typeof result === "object") {
    // Handle arrays and objects
    return JSON.stringify(result, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
  }
  return String(result);
}

function getPlaceholder(type: string): string {
  if (type === "address") return "0x...";
  if (type.startsWith("uint") || type.startsWith("int")) return "0";
  if (type === "bool") return "true/false";
  if (type === "string") return "text";
  if (type.startsWith("bytes")) return "0x...";
  return "";
}
