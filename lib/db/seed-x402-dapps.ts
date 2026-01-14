// Seed file for x402 DApp templates
// Task 13.1: Seed x402 DApp templates

import { db } from "@/lib/db";
import { dappTemplate, type DappUiConfig } from "@/lib/db/schema";

// ============================================================================
// x402 DApp Template Configurations
// ============================================================================

const nftMintDappConfig: DappUiConfig = {
  templateType: "x402-nft-mint",
  theme: {
    primaryColor: "#f97316",  // Orange
    accentColor: "#10b981",
    backgroundColor: "#fff7ed",
    textColor: "#1f2937",
    cardStyle: "bordered",
  },
  branding: {
    title: "NFT Mint",
    subtitle: "Pay & mint your NFT instantly",
  },
  sections: {
    paymentButton: { enabled: true, title: "Pay & Mint NFT", amount: "0.1" },
    contractStats: { enabled: true, title: "Collection Stats" },
    transactionHistory: { enabled: true, title: "Recent Mints" },
    walletInfo: { enabled: true, title: "Your Wallet" },
  },
  features: {
    showContractInfo: true,
    showNetworkBadge: true,
    showUsdcApproval: false,
    showWalletBalance: true,
  },
  x402Config: {
    settlementRouterAddress: "",
    hookAddress: "",
    facilitatorFee: "0",             // Default to 0 (no facilitator fee)
    defaultPaymentAmount: "0.1",     // 0.1 USDC (human-readable)
  },
};

const rewardPointsDappConfig: DappUiConfig = {
  templateType: "x402-reward-points",
  theme: {
    primaryColor: "#eab308",  // Yellow
    accentColor: "#15803d",
    backgroundColor: "#fef3c7",
    textColor: "#1f2937",
    cardStyle: "bordered",
  },
  branding: {
    title: "Earn Rewards",
    subtitle: "Pay & earn loyalty points",
  },
  sections: {
    paymentButton: { enabled: true, title: "Pay & Earn Points", amount: "0.1" },
    contractStats: { enabled: true, title: "Reward Pool Stats" },
    transactionHistory: { enabled: true, title: "Your Rewards" },
    walletInfo: { enabled: true, title: "Your Balance" },
  },
  features: {
    showContractInfo: true,
    showNetworkBadge: true,
    showUsdcApproval: false,
    showWalletBalance: true,
  },
  x402Config: {
    settlementRouterAddress: "",
    hookAddress: "",
    facilitatorFee: "0",
    defaultPaymentAmount: "0.1",
  },
};

const splitPaymentDappConfig: DappUiConfig = {
  templateType: "x402-split-payment",
  theme: {
    primaryColor: "#3b82f6",  // Blue
    accentColor: "#10b981",
    backgroundColor: "#f0f9ff",
    textColor: "#1f2937",
    cardStyle: "default",
  },
  branding: {
    title: "Split Payment",
    subtitle: "Distribute payments to multiple recipients",
  },
  sections: {
    paymentButton: { enabled: true, title: "Pay & Split", amount: "0.1" },
    contractStats: { enabled: false, title: "" },
    transactionHistory: { enabled: true, title: "Payment History" },
    walletInfo: { enabled: true, title: "Your Wallet" },
  },
  features: {
    showContractInfo: true,
    showNetworkBadge: true,
    showUsdcApproval: false,
    showWalletBalance: true,
  },
  x402Config: {
    settlementRouterAddress: "",
    hookAddress: "",
    facilitatorFee: "0",
    defaultPaymentAmount: "0.1",
  },
};

// ============================================================================
// Seed Function
// ============================================================================

export async function seedX402DappTemplates() {
  console.log("Seeding x402 DApp templates...");

  // 1. NFT Mint DApp Template
  await db.insert(dappTemplate).values({
    name: "x402 NFT Mint DApp",
    description: "Pay-to-mint NFT application with collection stats. Users can pay with USDC and automatically receive an NFT.",
    category: "x402-settlement",
    defaultConfig: nftMintDappConfig,
    previewImageUrl: "/images/dapp-templates/x402-nft-mint.png",
  });

  // 2. Reward Points DApp Template
  await db.insert(dappTemplate).values({
    name: "x402 Reward Points DApp",
    description: "Pay-to-earn loyalty rewards application. Users earn reward tokens for each payment made.",
    category: "x402-settlement",
    defaultConfig: rewardPointsDappConfig,
    previewImageUrl: "/images/dapp-templates/x402-reward-points.png",
  });

  // 3. Split Payment DApp Template
  await db.insert(dappTemplate).values({
    name: "x402 Split Payment DApp",
    description: "Configurable multi-recipient payment distribution. Automatically splits payments to multiple addresses by percentage.",
    category: "x402-settlement",
    defaultConfig: splitPaymentDappConfig,
    previewImageUrl: "/images/dapp-templates/x402-split-payment.png",
  });

  console.log("x402 DApp templates seeded successfully!");
}
