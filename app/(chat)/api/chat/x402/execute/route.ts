import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import type { X402Service } from "@/app/(chat)/api/x402/discover/route";

const CRONOS_TESTNET_RPC = "https://evm-t3.cronos.org";

const SETTLEMENT_ROUTER_ABI = [
  "function settleAndExecute(address token, address from, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes calldata signature, bytes32 salt, address payTo, uint256 facilitatorFee, address hook, bytes calldata hookData) external returns (bool)",
  "function calculateCommitment(address token, address from, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 salt, address payTo, uint256 facilitatorFee, address hook, bytes calldata hookData) external view returns (bytes32)",
];

interface ProgressEvent {
  type: "progress" | "success" | "error";
  message: string;
  data?: unknown;
}

interface ExecuteRequest {
  serviceId: string;
  query: string;
  serverUrl?: string;
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

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (event: ProgressEvent) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };

  const processRequest = async () => {
    try {
      const body: ExecuteRequest = await request.json();
      const { serviceId, query, serverUrl: requestServerUrl } = body;

      // Validate request
      if (!serviceId || typeof serviceId !== "string") {
        await sendEvent({ type: "error", message: "serviceId is required" });
        return;
      }

      if (!query || typeof query !== "string") {
        await sendEvent({ type: "error", message: "query is required" });
        return;
      }

      const privateKey = process.env.CRONOS_DEVELOPER_PRIVATE_KEY;
      if (!privateKey) {
        await sendEvent({
          type: "error",
          message: "Developer wallet not configured (CRONOS_DEVELOPER_PRIVATE_KEY)",
        });
        return;
      }

      const serverUrl = requestServerUrl || process.env.RESOURCE_SERVICE_URL;
      if (!serverUrl) {
        await sendEvent({
          type: "error",
          message: "Server URL not configured (RESOURCE_SERVICE_URL)",
        });
        return;
      }

      // Step 1: Discover services
      await sendEvent({ type: "progress", message: `Discovering services from ${serverUrl}...` });

      const discoverResponse = await fetch(`${serverUrl}/api/x402/services`);
      if (!discoverResponse.ok) {
        throw new Error(`Failed to discover services: ${discoverResponse.statusText}`);
      }

      const discoverData = await discoverResponse.json();
      const services: X402Service[] = discoverData.services || [];

      await sendEvent({ type: "progress", message: `Found ${services.length} service(s)` });

      if (services.length === 0) {
        throw new Error("No services available");
      }

      // Step 2: Find the requested service
      const service = services.find((s) => s.id === serviceId);
      if (!service) {
        throw new Error(`Service not found: ${serviceId}`);
      }

      await sendEvent({
        type: "progress",
        message: `Matched service: ${service.title} (${service.hookType})`,
        data: {
          service: {
            id: service.id,
            title: service.title,
            hookType: service.hookType,
          },
        },
      });

      // Step 3: Prepare transaction
      await sendEvent({ type: "progress", message: "Preparing transaction..." });

      const provider = new ethers.JsonRpcProvider(CRONOS_TESTNET_RPC);
      const wallet = new ethers.Wallet(privateKey, provider);
      const payerAddress = wallet.address;

      const hookData = encodeHookData(service);
      const salt = ethers.hexlify(ethers.randomBytes(32));
      const validAfter = 0;
      const validBefore = Math.floor(Date.now() / 1000) + 3600;

      const paymentAmount = service.defaults?.paymentAmount || "0.1";
      const value = ethers.parseUnits(paymentAmount, 6);
      const facilitatorFee = ethers.parseUnits(service.defaults?.facilitatorFee || "0", 6);
      const payTo = service.defaults?.payTo || ethers.ZeroAddress;

      // Calculate commitment
      await sendEvent({ type: "progress", message: "Calculating commitment..." });

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

      // Build EIP-712 domain and types
      const domain = {
        name: "USD Coin",
        version: "2",
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

      // Step 4: Sign
      await sendEvent({ type: "progress", message: "Signing transaction..." });

      const signature = await wallet.signTypedData(domain, types, message);

      // Step 5: Submit
      await sendEvent({ type: "progress", message: "Submitting to blockchain..." });

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

      await sendEvent({ type: "progress", message: `Transaction submitted: ${tx.hash}` });
      await sendEvent({ type: "progress", message: "Waiting for confirmation..." });

      const receipt = await tx.wait();
      const explorerUrl = `https://explorer.cronos.org/testnet/tx/${receipt.hash}`;

      await sendEvent({
        type: "success",
        message: "Transaction confirmed!",
        data: {
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
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("X402 execute error:", error);
      await sendEvent({ type: "error", message });
    } finally {
      await writer.close();
    }
  };

  processRequest();

  return new NextResponse(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
