"use client";

import type { TemplateProps } from "./types";
import { X402NftMintTemplate } from "./x402-nft-mint-template";
import { X402RewardPointsTemplate } from "./x402-reward-points-template";
import { X402SplitPaymentTemplate } from "./x402-split-payment-template";

export function DappRenderer({ config, contract }: TemplateProps) {
  switch (config.templateType) {
    case "x402-nft-mint":
      return <X402NftMintTemplate config={config} contract={contract} />;
    case "x402-reward-points":
      return <X402RewardPointsTemplate config={config} contract={contract} />;
    case "x402-split-payment":
      return <X402SplitPaymentTemplate config={config} contract={contract} />;
    default:
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-destructive">Unsupported Template</h1>
            <p className="text-muted-foreground">
              Template type &quot;{(config as { templateType: string }).templateType}&quot; is not supported.
            </p>
          </div>
        </div>
      );
  }
}
