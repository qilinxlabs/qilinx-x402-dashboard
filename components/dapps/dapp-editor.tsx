"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, X, Save, Globe, Eye, Palette, Layout, Settings, Zap } from "lucide-react";
import type { UserContract, UserDapp, DappTemplate, DappUiConfig } from "@/lib/db/schema";
import { DappRenderer } from "./templates/dapp-renderer";
import { DappConfigEditor } from "./dapp-config-editor";

export interface ContractBundle {
  bundleId: string;
  contracts: UserContract[];
  templateName: string;
  hookContract?: UserContract;
}

interface DappEditorProps {
  contract: UserContract;
  existingDapp?: UserDapp;
  template?: DappTemplate;
  bundle?: ContractBundle;
  onClose: () => void;
}

export function DappEditor({ contract, existingDapp, template, bundle, onClose }: DappEditorProps) {
  // Get base config from existing dapp, template, or generate default
  let baseConfig = existingDapp?.uiConfig || template?.defaultConfig || getDefaultConfig(contract, bundle);
  
  // If we have a bundle and it's an x402 template, merge bundle-specific addresses
  if (bundle && !existingDapp) {
    const mergedConfig = mergeX402BundleConfig(baseConfig as DappUiConfig, bundle, contract);
    baseConfig = mergedConfig;
  }
  
  const [name, setName] = useState(existingDapp?.name || `${contract.name} DApp`);
  const [description, setDescription] = useState(existingDapp?.description || "");
  const [config, setConfig] = useState<DappUiConfig>(baseConfig as DappUiConfig);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedDapp, setSavedDapp] = useState<UserDapp | null>(existingDapp || null);

  // Check if this is an x402 template
  const isX402Template = config.templateType?.startsWith("x402-");

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const url = savedDapp ? `/api/dapps/${savedDapp.id}` : "/api/dapps";
      const method = savedDapp ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: contract.id,
          templateId: template?.id,
          name,
          description,
          uiConfig: config,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      const dapp = await res.json();
      setSavedDapp(dapp);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!savedDapp) {
      await handleSave();
      return;
    }

    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/dapps/${savedDapp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: true }),
      });

      if (!res.ok) throw new Error("Failed to publish");
      
      const dapp = await res.json();
      setSavedDapp(dapp);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="font-semibold">{existingDapp ? "Edit DApp" : "Create DApp"}</h2>
            <p className="text-xs text-muted-foreground">{contract.name}</p>
          </div>
          <Badge variant={contract.network === "cronos_mainnet" ? "default" : "secondary"}>
            {contract.network === "cronos_mainnet" ? "Mainnet" : "Testnet"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {savedDapp?.isPublished && (
            <a
              href={`/dapp/${savedDapp.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              /dapp/{savedDapp.slug}
            </a>
          )}
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
          <Button onClick={handlePublish} disabled={publishing || savedDapp?.isPublished}>
            {publishing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
            {savedDapp?.isPublished ? "Published" : "Publish"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-2 bg-destructive/10 text-destructive text-sm text-center">{error}</div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Config Panel */}
        <div className="w-[400px] border-r overflow-y-auto p-4 space-y-4">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">DApp Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
          </div>

          <Tabs defaultValue={isX402Template ? "x402" : "branding"} className="space-y-4">
            <TabsList className={`grid w-full ${isX402Template ? "grid-cols-4" : "grid-cols-3"}`}>
              {isX402Template && (
                <TabsTrigger value="x402"><Zap className="h-4 w-4" /></TabsTrigger>
              )}
              <TabsTrigger value="branding"><Palette className="h-4 w-4" /></TabsTrigger>
              <TabsTrigger value="sections"><Layout className="h-4 w-4" /></TabsTrigger>
              <TabsTrigger value="features"><Settings className="h-4 w-4" /></TabsTrigger>
            </TabsList>

            {isX402Template && (
              <TabsContent value="x402">
                <DappConfigEditor config={config} onChange={setConfig} section="x402" />
              </TabsContent>
            )}
            <TabsContent value="branding">
              <DappConfigEditor config={config} onChange={setConfig} section="branding" />
            </TabsContent>
            <TabsContent value="sections">
              <DappConfigEditor config={config} onChange={setConfig} section="sections" />
            </TabsContent>
            <TabsContent value="features">
              <DappConfigEditor config={config} onChange={setConfig} section="features" />
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview Panel */}
        <div className="flex-1 overflow-y-auto bg-muted/30">
          <div className="p-2 border-b bg-background flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Preview</span>
          </div>
          <div className="min-h-full">
            <DappRenderer
              config={config}
              contract={{
                address: contract.contractAddress,
                abi: contract.abi as object[],
                network: contract.network,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Merge bundle-specific addresses into x402 config
 */
function mergeX402BundleConfig(config: DappUiConfig, bundle: ContractBundle, hookContract: UserContract): DappUiConfig {
  if (!config.templateType?.startsWith("x402-")) {
    return config;
  }

  // Find NFT contract in bundle
  let nftContractAddress = config.x402Config?.nftContractAddress || "";
  let rewardTokenAddress = config.x402Config?.rewardTokenAddress || "";
  let settlementRouterAddress = config.x402Config?.settlementRouterAddress || "0x80e941858065dfD4875030A7a30DfbfeE8c7742a";

  // Extract NFT contract address
  const nftContract = bundle.contracts.find(c => 
    c.bundleRole === "nft" || 
    (c.bundleRole !== "hook" && c.name.toLowerCase().includes("nft"))
  );
  if (nftContract) {
    nftContractAddress = nftContract.contractAddress;
  }

  // Extract RewardToken contract address
  const rewardToken = bundle.contracts.find(c => 
    c.bundleRole === "token" || 
    c.name.toLowerCase().includes("rewardtoken") ||
    (c.bundleRole !== "hook" && c.name.toLowerCase().includes("token"))
  );
  if (rewardToken) {
    rewardTokenAddress = rewardToken.contractAddress;
  }

  // Extract settlement router from hook's constructor args
  const hook = bundle.contracts.find(c => c.bundleRole === "hook") || hookContract;
  if (hook?.constructorArgs) {
    const args = hook.constructorArgs as Record<string, unknown>;
    // Check various possible key names
    const routerAddr = args.settlementRouter || args._settlementRouter || args.arg0;
    if (routerAddr && typeof routerAddr === "string") {
      settlementRouterAddress = routerAddr;
    }
  }

  console.log("mergeX402BundleConfig:", { nftContractAddress, rewardTokenAddress, settlementRouterAddress, bundle });

  return {
    ...config,
    x402Config: {
      ...config.x402Config,
      settlementRouterAddress,
      hookAddress: hookContract.contractAddress,
      nftContractAddress,
      rewardTokenAddress,
      merchantAddress: config.x402Config?.merchantAddress || "",
      facilitatorFee: config.x402Config?.facilitatorFee || "0",
      defaultPaymentAmount: config.x402Config?.defaultPaymentAmount || "0.1",
    },
  };
}

function getDefaultConfig(contract: UserContract, bundle?: ContractBundle): DappUiConfig {
  const name = contract.name.toLowerCase();
  
  // Debug logging
  console.log("getDefaultConfig called with:", { 
    contractName: contract.name, 
    bundleExists: !!bundle,
    bundleContracts: bundle?.contracts?.map(c => ({ name: c.name, role: c.bundleRole, address: c.contractAddress, args: c.constructorArgs }))
  });
  
  // x402 NFT Mint template - auto-populate from bundle
  if (name.includes("nft") && (name.includes("hook") || name.includes("mint"))) {
    // Extract NFT contract address from bundle (look for "nft" role or non-hook contract)
    let nftContractAddress = "";
    let settlementRouterAddress = "0x80e941858065dfD4875030A7a30DfbfeE8c7742a"; // Default
    
    if (bundle) {
      // Find NFT contract in bundle
      const nftContract = bundle.contracts.find(c => 
        c.bundleRole === "nft" || 
        (c.bundleRole !== "hook" && c.name.toLowerCase().includes("nft"))
      );
      console.log("Found NFT contract:", nftContract);
      if (nftContract) {
        nftContractAddress = nftContract.contractAddress;
      }
      
      // Try to get settlement router from constructor args
      const hookContract = bundle.contracts.find(c => c.bundleRole === "hook");
      console.log("Found hook contract:", hookContract, "constructorArgs:", hookContract?.constructorArgs);
      if (hookContract?.constructorArgs) {
        const args = hookContract.constructorArgs as Record<string, unknown>;
        // Check for named param first, then fall back to arg0 (legacy format)
        const routerAddr = args.settlementRouter || args._settlementRouter || args.arg0;
        console.log("Router address from args:", routerAddr);
        if (routerAddr && typeof routerAddr === "string") {
          settlementRouterAddress = routerAddr;
        }
      }
    }
    
    console.log("Final config:", { nftContractAddress, settlementRouterAddress });
    
    return {
      templateType: "x402-nft-mint",
      theme: { primaryColor: "#f97316", accentColor: "#3b82f6", backgroundColor: "#ffffff", textColor: "#1f2937", cardStyle: "default" },
      branding: { title: "NFT Mint", subtitle: "Pay with USDC to mint your NFT" },
      sections: {
        paymentButton: { enabled: true, title: "Pay & Mint NFT", amount: "0.1" },
        contractStats: { enabled: true, title: "Collection Stats" },
        walletInfo: { enabled: true, title: "Your Wallet" },
      },
      features: { showContractInfo: true, showNetworkBadge: true, showUsdcApproval: false, showWalletBalance: true },
      x402Config: {
        settlementRouterAddress,
        hookAddress: contract.contractAddress,
        nftContractAddress,
        merchantAddress: "",
        facilitatorFee: "0",
        defaultPaymentAmount: "0.1",
      },
    };
  }
  
  // x402 Reward Points template - auto-populate from bundle
  if (name.includes("reward") && (name.includes("hook") || name.includes("point"))) {
    let rewardTokenAddress = "";
    let settlementRouterAddress = "0x80e941858065dfD4875030A7a30DfbfeE8c7742a";
    
    if (bundle) {
      // Find RewardToken contract in bundle
      const rewardToken = bundle.contracts.find(c => 
        c.bundleRole === "token" || 
        c.name.toLowerCase().includes("rewardtoken") ||
        (c.bundleRole !== "hook" && c.name.toLowerCase().includes("token"))
      );
      console.log("Found RewardToken contract:", rewardToken);
      if (rewardToken) {
        rewardTokenAddress = rewardToken.contractAddress;
      }
      
      // Get settlement router from constructor args
      const hookContract = bundle.contracts.find(c => c.bundleRole === "hook");
      if (hookContract?.constructorArgs) {
        const args = hookContract.constructorArgs as Record<string, unknown>;
        const routerAddr = args.settlementRouter || args._settlementRouter || args.arg0;
        if (routerAddr && typeof routerAddr === "string") {
          settlementRouterAddress = routerAddr;
        }
      }
    }
    
    console.log("Reward Points config:", { rewardTokenAddress, settlementRouterAddress });
    
    return {
      templateType: "x402-reward-points",
      theme: { primaryColor: "#eab308", accentColor: "#22c55e", backgroundColor: "#ffffff", textColor: "#1f2937", cardStyle: "default" },
      branding: { title: "Earn Rewards", subtitle: "Pay with USDC to earn reward points" },
      sections: {
        paymentButton: { enabled: true, title: "Pay & Earn Points", amount: "0.1" },
        walletInfo: { enabled: true, title: "Your Wallet" },
      },
      features: { showContractInfo: true, showNetworkBadge: true, showUsdcApproval: false, showWalletBalance: true },
      x402Config: {
        settlementRouterAddress,
        hookAddress: contract.contractAddress,
        rewardTokenAddress,
        merchantAddress: "",
        facilitatorFee: "0",
        defaultPaymentAmount: "0.1",
      },
    };
  }
  
  if (name.includes("staking")) {
    return {
      templateType: "staking",
      theme: { primaryColor: "#3b82f6", accentColor: "#10b981", backgroundColor: "#ffffff", textColor: "#1f2937", cardStyle: "default" },
      branding: { title: contract.name, subtitle: "Stake your tokens" },
      sections: {
        stakeForm: { enabled: true, title: "Stake Tokens" },
        stakedBalance: { enabled: true, title: "Your Staked Balance" },
        rewards: { enabled: true, title: "Earned Rewards" },
        withdrawForm: { enabled: true, title: "Withdraw" },
      },
      features: { showContractInfo: true, showNetworkBadge: true, showUsdcApproval: true, showWalletBalance: true },
    };
  }
  
  if (name.includes("dao") || name.includes("voting") || name.includes("governance")) {
    return {
      templateType: "dao-voting",
      theme: { primaryColor: "#8b5cf6", accentColor: "#f59e0b", backgroundColor: "#ffffff", textColor: "#1f2937", cardStyle: "default" },
      branding: { title: contract.name, subtitle: "Participate in governance" },
      sections: {
        proposalList: { enabled: true, title: "Active Proposals" },
        createProposal: { enabled: true, title: "Create Proposal" },
        votingStats: { enabled: true, title: "Governance Stats" },
      },
      features: { showContractInfo: true, showNetworkBadge: true, showUsdcApproval: false, showWalletBalance: true },
    };
  }
  
  // Default to payment
  return {
    templateType: "payment",
    theme: { primaryColor: "#10b981", accentColor: "#3b82f6", backgroundColor: "#ffffff", textColor: "#1f2937", cardStyle: "default" },
    branding: { title: contract.name, subtitle: "Pay with MNEE tokens" },
    sections: {
      paymentForm: { enabled: true, title: "Make Payment" },
      receiptHistory: { enabled: true, title: "Your Receipts" },
      merchantInfo: { enabled: true, title: "Merchant Info" },
    },
    features: { showContractInfo: true, showNetworkBadge: true, showUsdcApproval: true, showWalletBalance: true },
  };
}
