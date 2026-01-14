import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { Facilitator, CronosNetwork } from "@crypto.com/facilitator-client";
import { ethers } from "ethers";

const NETWORK_CONFIG = {
  mainnet: {
    rpcUrl: "https://evm.cronos.org",
    cronosNetwork: CronosNetwork.CronosMainnet,
    privateKeyEnv: "CRONOS_MAINNET_PRIVATE_KEY",
  },
  testnet: {
    rpcUrl: "https://evm-t3.cronos.org",
    cronosNetwork: CronosNetwork.CronosTestnet,
    privateKeyEnv: "CRONOS_TESTNET_PRIVATE_KEY",
  },
};

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { network, recipientAddress, amount, description } = body;

    if (!network || !["mainnet", "testnet"].includes(network)) {
      return NextResponse.json({ error: "Invalid network" }, { status: 400 });
    }

    if (!recipientAddress || !/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
      return NextResponse.json({ error: "Invalid recipient address" }, { status: 400 });
    }

    if (!amount || Number.parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const config = NETWORK_CONFIG[network as "mainnet" | "testnet"];
    const privateKey = process.env[config.privateKeyEnv];

    if (!privateKey) {
      return NextResponse.json(
        { error: `Private key not configured for ${network}` },
        { status: 500 }
      );
    }

    // Create facilitator and signer
    const facilitator = new Facilitator({ network: config.cronosNetwork });
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);

    console.log("Payment request - amount received:", amount);
    console.log("Payment request - recipient:", recipientAddress);

    // Generate payment requirements
    const requirements = facilitator.generatePaymentRequirements({
      payTo: recipientAddress,
      description: description || "X402 Payment",
      maxAmountRequired: amount,
    });

    console.log("Payment requirements:", JSON.stringify(requirements, null, 2));

    // Generate payment header
    const header = await facilitator.generatePaymentHeader({
      to: recipientAddress,
      value: amount,
      signer,
      validBefore: Math.floor(Date.now() / 1000) + 600, // 10 min expiry
    });

    console.log("Payment header generated");

    // Verify payment
    const verifyBody = facilitator.buildVerifyRequest(header, requirements);
    const verifyResponse = await facilitator.verifyPayment(verifyBody);

    if (!verifyResponse.isValid) {
      return NextResponse.json(
        { error: "Payment verification failed", details: verifyResponse },
        { status: 400 }
      );
    }

    // Settle payment
    const settleResponse = await facilitator.settlePayment(verifyBody);

    console.log("Settle response:", JSON.stringify(settleResponse, null, 2));

    if (!settleResponse.txHash) {
      return NextResponse.json(
        { 
          error: "Payment settlement failed - no transaction hash",
          details: settleResponse,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      txHash: settleResponse.txHash,
      network,
    });
  } catch (error) {
    console.error("Payment error:", error);
    const errorMessage = error instanceof Error ? error.message : "Payment failed";
    const errorDetails = error instanceof Error ? error.stack : String(error);
    console.error("Error details:", errorDetails);
    return NextResponse.json(
      { error: errorMessage, details: errorDetails },
      { status: 500 }
    );
  }
}

// Get wallet address for the configured private key
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const network = searchParams.get("network") || "testnet";

  if (!["mainnet", "testnet"].includes(network)) {
    return NextResponse.json({ error: "Invalid network" }, { status: 400 });
  }

  const config = NETWORK_CONFIG[network as "mainnet" | "testnet"];
  const privateKey = process.env[config.privateKeyEnv];

  if (!privateKey) {
    return NextResponse.json(
      { error: `Private key not configured for ${network}`, configured: false },
      { status: 200 }
    );
  }

  try {
    const wallet = new ethers.Wallet(privateKey);
    return NextResponse.json({
      configured: true,
      address: wallet.address,
      network,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid private key configuration", configured: false },
      { status: 200 }
    );
  }
}
