"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DappUiConfig } from "@/lib/db/schema";

interface DappConfigEditorProps {
  config: DappUiConfig;
  onChange: (config: DappUiConfig) => void;
  section: "branding" | "sections" | "features" | "x402";
}

export function DappConfigEditor({ config, onChange, section }: DappConfigEditorProps) {
  const updateTheme = (key: keyof DappUiConfig["theme"], value: string) => {
    onChange({ ...config, theme: { ...config.theme, [key]: value } });
  };

  const updateBranding = (key: keyof DappUiConfig["branding"], value: string) => {
    onChange({ ...config, branding: { ...config.branding, [key]: value } });
  };

  const updateSection = (key: string, field: "enabled" | "title", value: boolean | string) => {
    const currentSection = config.sections[key as keyof typeof config.sections] || { enabled: true, title: key };
    onChange({
      ...config,
      sections: {
        ...config.sections,
        [key]: { ...currentSection, [field]: value },
      },
    });
  };

  const updateFeature = (key: keyof DappUiConfig["features"], value: boolean) => {
    onChange({ ...config, features: { ...config.features, [key]: value } });
  };

  const updateX402Config = (key: string, value: string) => {
    onChange({
      ...config,
      x402Config: {
        settlementRouterAddress: config.x402Config?.settlementRouterAddress || "",
        hookAddress: config.x402Config?.hookAddress || "",
        facilitatorFee: config.x402Config?.facilitatorFee || "0",
        defaultPaymentAmount: config.x402Config?.defaultPaymentAmount || "0.1",
        nftContractAddress: (config.x402Config as any)?.nftContractAddress || "",
        merchantAddress: (config.x402Config as any)?.merchantAddress || "",
        ...config.x402Config,
        [key]: value,
      },
    });
  };

  if (section === "branding") {
    return (
      <div className="space-y-4">
        <h3 className="font-medium text-sm">Branding & Theme</h3>
        
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Title</Label>
            <Input
              value={config.branding.title}
              onChange={(e) => updateBranding("title", e.target.value)}
            />
          </div>
          
          <div>
            <Label className="text-xs">Subtitle</Label>
            <Input
              value={config.branding.subtitle || ""}
              onChange={(e) => updateBranding("subtitle", e.target.value)}
              placeholder="Optional subtitle"
            />
          </div>
          
          <div>
            <Label className="text-xs">Logo URL</Label>
            <Input
              value={config.branding.logoUrl || ""}
              onChange={(e) => updateBranding("logoUrl", e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <h4 className="font-medium text-sm pt-2">Colors</h4>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Primary</Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={config.theme.primaryColor}
                onChange={(e) => updateTheme("primaryColor", e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
              />
              <Input
                value={config.theme.primaryColor}
                onChange={(e) => updateTheme("primaryColor", e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          
          <div>
            <Label className="text-xs">Accent</Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={config.theme.accentColor}
                onChange={(e) => updateTheme("accentColor", e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
              />
              <Input
                value={config.theme.accentColor}
                onChange={(e) => updateTheme("accentColor", e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          
          <div>
            <Label className="text-xs">Background</Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={config.theme.backgroundColor}
                onChange={(e) => updateTheme("backgroundColor", e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
              />
              <Input
                value={config.theme.backgroundColor}
                onChange={(e) => updateTheme("backgroundColor", e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
          
          <div>
            <Label className="text-xs">Text</Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={config.theme.textColor}
                onChange={(e) => updateTheme("textColor", e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
              />
              <Input
                value={config.theme.textColor}
                onChange={(e) => updateTheme("textColor", e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div>
          <Label className="text-xs">Card Style</Label>
          <Select value={config.theme.cardStyle} onValueChange={(v) => updateTheme("cardStyle", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="bordered">Bordered</SelectItem>
              <SelectItem value="elevated">Elevated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (section === "sections") {
    const sectionKeys = getSectionKeys(config.templateType);
    
    return (
      <div className="space-y-4">
        <h3 className="font-medium text-sm">Sections</h3>
        
        {sectionKeys.map((key) => {
          const sectionConfig = config.sections[key as keyof typeof config.sections];
          const enabled = sectionConfig?.enabled ?? true;
          const title = sectionConfig?.title ?? formatSectionKey(key);
          
          return (
            <div key={key} className="space-y-2 p-3 border rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{formatSectionKey(key)}</Label>
                <Switch
                  checked={enabled}
                  onCheckedChange={(v: boolean) => updateSection(key, "enabled", v)}
                />
              </div>
              {enabled && (
                <Input
                  value={title}
                  onChange={(e) => updateSection(key, "title", e.target.value)}
                  placeholder="Section title"
                  className="text-sm"
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (section === "features") {
    return (
      <div className="space-y-4">
        <h3 className="font-medium text-sm">Features</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Show Contract Info</Label>
            <Switch
              checked={config.features.showContractInfo}
              onCheckedChange={(v: boolean) => updateFeature("showContractInfo", v)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label className="text-sm">Show Network Badge</Label>
            <Switch
              checked={config.features.showNetworkBadge}
              onCheckedChange={(v: boolean) => updateFeature("showNetworkBadge", v)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label className="text-sm">Show USDC Approval</Label>
            <Switch
              checked={config.features.showUsdcApproval}
              onCheckedChange={(v: boolean) => updateFeature("showUsdcApproval", v)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label className="text-sm">Show Wallet Balance</Label>
            <Switch
              checked={config.features.showWalletBalance}
              onCheckedChange={(v: boolean) => updateFeature("showWalletBalance", v)}
            />
          </div>
        </div>
      </div>
    );
  }

  if (section === "x402") {
    return (
      <div className="space-y-4">
        <h3 className="font-medium text-sm">x402 Configuration</h3>
        <p className="text-xs text-muted-foreground">
          Configure the x402 settlement addresses and payment parameters.
        </p>
        
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Settlement Router Address</Label>
            <Input
              value={config.x402Config?.settlementRouterAddress || ""}
              onChange={(e) => updateX402Config("settlementRouterAddress", e.target.value)}
              placeholder="0x..."
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              The deployed SettlementRouter contract address
            </p>
          </div>
          
          <div>
            <Label className="text-xs">NFT Contract Address</Label>
            <Input
              value={(config.x402Config as any)?.nftContractAddress || ""}
              onChange={(e) => updateX402Config("nftContractAddress", e.target.value)}
              placeholder="0x..."
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              The RandomNFT contract that will mint NFTs (for NFT templates)
            </p>
          </div>
          
          <div>
            <Label className="text-xs">Reward Token Address</Label>
            <Input
              value={(config.x402Config as any)?.rewardTokenAddress || ""}
              onChange={(e) => updateX402Config("rewardTokenAddress", e.target.value)}
              placeholder="0x..."
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              The RewardToken (X402RP) contract address (for reward points templates)
            </p>
          </div>
          
          <div>
            <Label className="text-xs">Payment Recipient Address</Label>
            <Input
              value={(config.x402Config as any)?.merchantAddress || ""}
              onChange={(e) => updateX402Config("merchantAddress", e.target.value)}
              placeholder="0x... (leave empty for testing)"
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Who receives the USDC payment (the seller/merchant). Leave empty to pay yourself for testing.
            </p>
          </div>
          
          <div>
            <Label className="text-xs">Payment Amount (USDC)</Label>
            <Input
              type="number"
              step="0.01"
              value={config.x402Config?.defaultPaymentAmount || "0.1"}
              onChange={(e) => updateX402Config("defaultPaymentAmount", e.target.value)}
              placeholder="0.1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Amount in USDC to charge for minting
            </p>
          </div>
          
          <div>
            <Label className="text-xs">Facilitator Fee (USDC)</Label>
            <Input
              type="number"
              step="0.001"
              value={config.x402Config?.facilitatorFee || "0"}
              onChange={(e) => updateX402Config("facilitatorFee", e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Fee for the facilitator (usually 0 when user is their own facilitator)
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function getSectionKeys(templateType: string): string[] {
  switch (templateType) {
    case "staking":
      return ["stakeForm", "stakedBalance", "rewards", "withdrawForm"];
    case "dao-voting":
      return ["proposalList", "createProposal", "votingStats"];
    case "payment":
      return ["paymentForm", "receiptHistory", "merchantInfo"];
    default:
      return [];
  }
}

function formatSectionKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}
