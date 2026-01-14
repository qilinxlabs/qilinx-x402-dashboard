/**
 * X402 Tools for AI Chat
 *
 * These tools allow the LLM to discover and execute X402 services
 * configured in the RESOURCE_SERVICE_URL using the developer wallet.
 */

import { tool, type Tool } from "ai";
import { z } from "zod";
import { ethers } from "ethers";

const RESOURCE_SERVICE_URL = process.env.RESOURCE_SERVICE_URL;
const CRONOS_DEVELOPER_PRIVATE_KEY = process.env.CRONOS_DEVELOPER_PRIVATE_KEY;
const CRONOS_TESTNET_RPC = "https://evm-t3.cronos.org";

const SETTLEMENT_ROUTER_ABI = [
  "function settleAndExecute(address token, address from, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes calldata signature, bytes32 salt, address payTo, uint256 facilitatorFee, address hook, bytes calldata hookData) external returns (bool)",
  "function calculateCommitment(address token, address from, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 salt, address payTo, uint256 facilitatorFee, address hook, bytes calldata hookData) external view returns (bytes32)",
];

const USDC_ABI = [
  "function name() view returns (string)",
  "function version() view returns (string)",
];

/**
 * Get USDC token info for EIP-712 domain
 */
async function getTokenInfo(
  provider: ethers.JsonRpcProvider,
  tokenAddress: string
): Promise<{ name: string; version: string }> {
  const token = new ethers.Contract(tokenAddress, USDC_ABI, provider);
  const [name, version] = await Promise.all([
    token.name(),
    token.version().catch(() => "2"), // Default to '2' if version() not available
  ]);
  return { name, version };
}

export interface X402Service {
  id: string;
  title: string;
  description?: string;
  hookType: "nft-mint" | "reward-points" | "transfer-split";
  hookAddress: string;
  network: string;
  settlementRouter: string;
  usdcAddress: string;
  chainId: number;
  supportingContracts?: Record<string, string>;
  defaults?: {
    paymentAmount: string;
    facilitatorFee: string;
    payTo: string;
  };
}

/**
 * Encode hook data based on service type
 */
function encodeHookData(
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
        return "0x";
      }
      return abiCoder.encode(
        ["tuple(address recipient, uint16 bips)[]"],
        [splits.map((s) => ({ recipient: s.recipient, bips: s.bips }))]
      );
    default:
      return "0x";
  }
}

// biome-ignore lint/suspicious/noExplicitAny: X402 tools have dynamic return types
type X402ToolRecord = Record<string, Tool<any, any>>;

const discoverSchema = z.object({});
const executeSchema = z.object({
  serviceId: z.string().describe("The ID of the service to execute (e.g., 'nft-mint', 'reward-points', 'transfer-split')"),
  splits: z.array(z.object({
    recipient: z.string().describe("Ethereum address of the recipient (0x...)"),
    bips: z.number().describe("Basis points for this recipient (e.g., 8000 for 80%, 2000 for 20%). Total must equal 10000."),
  })).optional().describe("For transfer-split service: array of recipients with their share in basis points. Total bips must equal 10000 (100%). Example: [{recipient: '0x...', bips: 8000}, {recipient: '0x...', bips: 2000}]"),
  useConnectedWallet: z.boolean().optional().describe("If true, returns service details for client-side wallet signing instead of using developer wallet. The client will handle the actual signing."),
});
const detailsSchema = z.object({
  serviceId: z.string().describe("The ID of the service to get details for"),
});

/**
 * Discover X402 services from the configured A2A server
 */
const discoverX402Services = tool({
  description:
    "Discover available X402 payment services from the configured A2A server. Returns a list of services that can be executed. After discovering, use executeX402Service to execute a service.",
  inputSchema: discoverSchema,
  execute: async (_args: z.infer<typeof discoverSchema>) => {
    if (!RESOURCE_SERVICE_URL) {
      return {
        success: false,
        error: "RESOURCE_SERVICE_URL not configured",
        services: [],
      };
    }

    try {
      const response = await fetch(`${RESOURCE_SERVICE_URL}/api/x402/services`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch services: ${response.statusText}`,
          services: [],
        };
      }

      const data = await response.json();
      const services: X402Service[] = data.services || [];

      return {
        success: true,
        serverUrl: RESOURCE_SERVICE_URL,
        serviceCount: services.length,
        services: services.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          hookType: s.hookType,
          network: s.network,
          paymentAmount: s.defaults?.paymentAmount || "0.1",
        })),
        hint: "Use executeX402Service with a serviceId to execute a service",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Failed to connect to A2A server: ${message}`,
        services: [],
      };
    }
  },
});

/**
 * Execute an X402 service using the developer wallet
 * Signs the transaction and submits it to the blockchain
 */
const executeX402Service = tool({
  description:
    "Execute an X402 payment service. If useConnectedWallet is true, returns service details for client-side wallet signing. Otherwise uses the developer wallet to sign and submit the transaction.",
  inputSchema: executeSchema,
  execute: async (args: z.infer<typeof executeSchema>) => {
    const { serviceId, splits, useConnectedWallet } = args;
    
    // Check configuration
    if (!RESOURCE_SERVICE_URL) {
      return {
        success: false,
        error: "RESOURCE_SERVICE_URL not configured",
      };
    }

    try {
      // Step 1: Fetch services
      const response = await fetch(`${RESOURCE_SERVICE_URL}/api/x402/services`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch services: ${response.statusText}`,
        };
      }

      const data = await response.json();
      const services: X402Service[] = data.services || [];

      // Step 2: Find the requested service
      const service = services.find((s) => s.id === serviceId);
      if (!service) {
        return {
          success: false,
          error: `Service not found: ${serviceId}`,
          availableServices: services.map((s) => ({ id: s.id, title: s.title })),
        };
      }

      // Validate splits for transfer-split service
      if (service.hookType === "transfer-split" && splits && splits.length > 0) {
        // Validate addresses
        for (const split of splits) {
          if (!ethers.isAddress(split.recipient)) {
            return {
              success: false,
              error: `Invalid address: ${split.recipient}`,
            };
          }
          if (split.bips <= 0 || split.bips > 10000) {
            return {
              success: false,
              error: `Invalid bips value: ${split.bips}. Must be between 1 and 10000.`,
            };
          }
        }
        // Validate total bips = 10000
        const totalBips = splits.reduce((sum, s) => sum + s.bips, 0);
        if (totalBips !== 10000) {
          return {
            success: false,
            error: `Total bips must equal 10000 (100%), got ${totalBips}`,
          };
        }
      }

      // If useConnectedWallet is true, return service details for client-side signing
      if (useConnectedWallet) {
        return {
          success: true,
          requiresClientSigning: true,
          message: "Please sign the transaction with your connected wallet.",
          service: {
            id: service.id,
            title: service.title,
            description: service.description,
            hookType: service.hookType,
            hookAddress: service.hookAddress,
            network: service.network,
            chainId: service.chainId,
            settlementRouter: service.settlementRouter,
            usdcAddress: service.usdcAddress,
            supportingContracts: service.supportingContracts,
            defaults: service.defaults,
          },
          splits: splits || null,
        };
      }

      // Developer wallet signing flow
      if (!CRONOS_DEVELOPER_PRIVATE_KEY) {
        return {
          success: false,
          error: "Developer wallet not configured (CRONOS_DEVELOPER_PRIVATE_KEY)",
        };
      }

      // Step 3: Prepare transaction
      const provider = new ethers.JsonRpcProvider(CRONOS_TESTNET_RPC);
      const wallet = new ethers.Wallet(CRONOS_DEVELOPER_PRIVATE_KEY, provider);
      const payerAddress = wallet.address;

      const hookData = encodeHookData(service, splits);
      const salt = ethers.hexlify(ethers.randomBytes(32));
      const validAfter = 0;
      const validBefore = Math.floor(Date.now() / 1000) + 3600;

      const paymentAmount = service.defaults?.paymentAmount || "0.1";
      const value = ethers.parseUnits(paymentAmount, 6);
      const facilitatorFee = ethers.parseUnits(service.defaults?.facilitatorFee || "0", 6);
      const payTo = service.defaults?.payTo || ethers.ZeroAddress;

      // Step 4: Calculate commitment (nonce)
      const router = new ethers.Contract(service.settlementRouter, SETTLEMENT_ROUTER_ABI, provider);

      const nonce = await router.calculateCommitment(
        service.usdcAddress,
        payerAddress,
        value,
        validAfter,
        validBefore,
        salt,
        payTo,
        facilitatorFee,
        service.hookAddress,
        hookData
      );

      // Get token info for EIP-712 domain
      const tokenInfo = await getTokenInfo(provider, service.usdcAddress);

      // Step 5: Build EIP-712 domain and types
      const domain = {
        name: tokenInfo.name,
        version: tokenInfo.version,
        chainId: service.chainId,
        verifyingContract: service.usdcAddress,
      };

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
        from: payerAddress,
        to: service.settlementRouter,
        value: value.toString(),
        validAfter,
        validBefore,
        nonce,
      };

      // Step 6: Sign the typed data
      const signature = await wallet.signTypedData(domain, types, message);

      // Step 7: Submit transaction to blockchain
      const routerWithSigner = new ethers.Contract(
        service.settlementRouter,
        SETTLEMENT_ROUTER_ABI,
        wallet
      );

      const tx = await routerWithSigner.settleAndExecute(
        service.usdcAddress,
        payerAddress,
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

      // Step 8: Wait for confirmation
      const receipt = await tx.wait();
      const explorerUrl = `https://explorer.cronos.org/testnet/tx/${receipt.hash}`;

      // Build result
      const result: Record<string, unknown> = {
        success: true,
        message: splits && splits.length > 0 
          ? `Split payment confirmed to ${splits.length} recipients!`
          : "Transaction confirmed!",
        service: {
          id: service.id,
          title: service.title,
          hookType: service.hookType,
        },
        transaction: {
          hash: receipt.hash,
          blockNumber: receipt.blockNumber,
          from: payerAddress,
          payTo,
          amount: `${paymentAmount} USDC`,
          explorerUrl,
        },
      };

      // Add splits info if applicable
      if (splits && splits.length > 0) {
        result.splits = splits.map((s) => ({
          recipient: s.recipient,
          percentage: `${s.bips / 100}%`,
        }));
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("X402 execute error:", error);
      return {
        success: false,
        error: message,
      };
    }
  },
});

/**
 * Get detailed information about a specific X402 service
 */
const getX402ServiceDetails = tool({
  description:
    "Get detailed information about a specific X402 service by its ID. Use this to see full contract addresses and configuration before execution.",
  inputSchema: detailsSchema,
  execute: async (args: z.infer<typeof detailsSchema>) => {
    const { serviceId } = args;
    
    if (!RESOURCE_SERVICE_URL) {
      return {
        success: false,
        error: "RESOURCE_SERVICE_URL not configured",
      };
    }

    try {
      const response = await fetch(`${RESOURCE_SERVICE_URL}/api/x402/services`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch services: ${response.statusText}`,
        };
      }

      const data = await response.json();
      const services: X402Service[] = data.services || [];
      const service = services.find((s) => s.id === serviceId);

      if (!service) {
        return {
          success: false,
          error: `Service not found: ${serviceId}`,
          availableServices: services.map((s) => ({ id: s.id, title: s.title })),
        };
      }

      return {
        success: true,
        service: {
          id: service.id,
          title: service.title,
          description: service.description,
          hookType: service.hookType,
          hookAddress: service.hookAddress,
          network: service.network,
          chainId: service.chainId,
          settlementRouter: service.settlementRouter,
          usdcAddress: service.usdcAddress,
          supportingContracts: service.supportingContracts,
          defaults: service.defaults,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Failed to connect to A2A server: ${message}`,
      };
    }
  },
});

/**
 * All X402 tools exported as a record for use in streamText
 */
export const x402Tools: X402ToolRecord = {
  discoverX402Services,
  executeX402Service,
  getX402ServiceDetails,
};

export const x402ToolNames = Object.keys(x402Tools);
