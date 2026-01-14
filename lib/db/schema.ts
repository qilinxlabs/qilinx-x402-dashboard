import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  integer,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// MCP Tools Configuration stored per user
export interface MCPToolsConfig {
  disabledToolIds: string[]; // Array of mcp_tools.id that user has disabled
}

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 64 }),
  apiToken: uuid("apiToken").defaultRandom(),
  mcpToolsConfig: json("mcpToolsConfig").$type<MCPToolsConfig>(),
});

export type User = InferSelectModel<typeof user>;

// MCP Tools table for storing external tool server configurations
export const mcpTools = pgTable("MCP_Tools", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  host: varchar("host", { length: 512 }).notNull(),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type MCPTool = InferSelectModel<typeof mcpTools>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = pgTable("Message", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  content: json("content").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = pgTable(
  "Vote",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  }
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;


// ============================================================================
// x402 DeFi Contracts Library Schema
// ============================================================================

// Contract template categories
export const contractCategoryValues = ["x402-settlement"] as const;
export type ContractCategory = typeof contractCategoryValues[number];

// Cronos network types
export const ethereumNetworkValues = ["cronos_mainnet", "cronos_testnet"] as const;
export type EthereumNetwork = typeof ethereumNetworkValues[number];

// Constructor parameter schema for AI customization
export interface ConstructorParam {
  name: string;
  type: string;           // Solidity type: address, uint256, string, etc.
  description: string;
  defaultValue?: string;
  required: boolean;
}

// Multi-file template support for x402 contracts
export interface SourceFile {
  filename: string;           // e.g., "NFTMintHook.sol"
  content: string;            // Solidity source code
  isMain: boolean;            // Primary contract to deploy
  contractName: string;       // Contract name within file
}

export interface DeploymentDependency {
  paramName: string;
  sourceContract?: string;    // Filename of dependency (for auto-injection)
  externalAddress?: boolean;  // User provides address
  description?: string;
}

export interface DeploymentConfig {
  deploymentOrder: string[];  // Filenames in deployment order
  dependencies: {
    [filename: string]: {
      constructorParams: DeploymentDependency[];
    };
  };
}

// Contract template table for storing DeFi contract templates
export const contractTemplate = pgTable("Contract_Template", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { enum: contractCategoryValues }).notNull(),
  soliditySourceCode: text("soliditySourceCode").notNull(),
  abi: json("abi").$type<object[]>(),
  constructorParamsSchema: json("constructorParamsSchema").$type<ConstructorParam[]>(),
  // Multi-file template support
  sourceFiles: json("sourceFiles").$type<SourceFile[]>(),
  deploymentConfig: json("deploymentConfig").$type<DeploymentConfig>(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type ContractTemplate = InferSelectModel<typeof contractTemplate>;

// User deployed contracts table
export const userContract = pgTable("User_Contract", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  templateId: uuid("templateId")
    .references(() => contractTemplate.id),
  name: varchar("name", { length: 128 }).notNull(),
  contractAddress: varchar("contractAddress", { length: 42 }).notNull(),
  network: varchar("network", { enum: ethereumNetworkValues }).notNull(),
  constructorArgs: json("constructorArgs").$type<Record<string, unknown>>(),
  deployedSourceCode: text("deployedSourceCode").notNull(),
  abi: json("abi").$type<object[]>().notNull(),
  transactionHash: varchar("transactionHash", { length: 66 }).notNull(),
  // Multi-contract bundle support
  bundleId: uuid("bundleId"),
  bundleRole: varchar("bundleRole", { length: 64 }),
  deployedAt: timestamp("deployedAt").notNull().defaultNow(),
});

export type UserContract = InferSelectModel<typeof userContract>;

// ============================================================================
// DApps Builder Schema
// ============================================================================

// DApp UI configuration - JSON schema for configuring pre-built templates
export interface DappUiConfig {
  // Template type determines which React component to render
  templateType: "staking" | "dao-voting" | "payment" | "x402-nft-mint" | "x402-reward-points" | "x402-split-payment";
  
  // Theme customization
  theme: {
    primaryColor: string;      // e.g., "#3b82f6"
    accentColor: string;       // e.g., "#10b981"
    backgroundColor: string;   // e.g., "#ffffff"
    textColor: string;         // e.g., "#1f2937"
    cardStyle: "default" | "bordered" | "elevated";
  };
  
  // Branding
  branding: {
    title: string;             // DApp title displayed in header
    subtitle?: string;         // Optional subtitle
    logoUrl?: string;          // Optional logo URL
  };
  
  // Section visibility and labels (varies by template type)
  sections: {
    // Staking template sections
    stakeForm?: { enabled: boolean; title: string };
    stakedBalance?: { enabled: boolean; title: string };
    rewards?: { enabled: boolean; title: string };
    withdrawForm?: { enabled: boolean; title: string };
    
    // DAO Voting template sections
    proposalList?: { enabled: boolean; title: string };
    createProposal?: { enabled: boolean; title: string };
    votingStats?: { enabled: boolean; title: string };
    
    // Payment template sections
    paymentForm?: { enabled: boolean; title: string };
    receiptHistory?: { enabled: boolean; title: string };
    merchantInfo?: { enabled: boolean; title: string };
    
    // x402 template sections
    paymentButton?: { enabled: boolean; title: string; amount?: string };
    contractStats?: { enabled: boolean; title: string };
    transactionHistory?: { enabled: boolean; title: string };
    walletInfo?: { enabled: boolean; title: string };
  };
  
  // Feature toggles
  features: {
    showContractInfo: boolean;
    showNetworkBadge: boolean;
    showUsdcApproval: boolean;
    showWalletBalance: boolean;
  };
  
  // x402-specific configuration (optional, only for x402 templates)
  x402Config?: {
    settlementRouterAddress: string;
    hookAddress: string;
    nftContractAddress?: string;   // For NFT mint templates
    rewardTokenAddress?: string;   // For reward points templates
    merchantAddress?: string;      // Who receives the payment
    facilitatorFee: string;        // In token units (6 decimals for USDC)
    defaultPaymentAmount: string;  // In token units
  };
}

// DApp template table for storing pre-built DApp UI templates
export const dappTemplate = pgTable("Dapp_Template", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  category: varchar("category", { enum: contractCategoryValues }).notNull(),
  defaultConfig: json("defaultConfig").$type<DappUiConfig>().notNull(),
  previewImageUrl: varchar("previewImageUrl", { length: 512 }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type DappTemplate = InferSelectModel<typeof dappTemplate>;

// User DApp table for storing user-created DApps
export const userDapp = pgTable("User_Dapp", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  contractId: uuid("contractId")
    .notNull()
    .references(() => userContract.id),
  templateId: uuid("templateId")
    .references(() => dappTemplate.id),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  description: text("description"),
  uiConfig: json("uiConfig").$type<DappUiConfig>().notNull(),
  isPublished: boolean("isPublished").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type UserDapp = InferSelectModel<typeof userDapp>;
