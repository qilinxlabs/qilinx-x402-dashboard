import { NextResponse } from "next/server";
import { Wallet, JsonRpcProvider, ContractFactory } from "ethers";
import type { EthereumNetwork, ContractTemplate } from "@/lib/db/schema";
import { RPC_URLS, isServerDeployNetwork } from "@/lib/contracts/network-config";
import { deployBundle, type DeploymentContext } from "@/lib/contracts/deployment-service";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db";
import { contractTemplate } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface DeployRequest {
  abi: object[];
  bytecode: string;
  constructorArgs: unknown[];
  network: EthereumNetwork;
}

interface BundleDeployRequest {
  templateId: string;
  network: EthereumNetwork;
  userParams: Record<string, unknown>;
}

// Helper to deploy a single contract
async function deploySingleContract(
  abi: object[],
  bytecode: string,
  constructorArgs: unknown[],
  wallet: Wallet
): Promise<{ address: string; transactionHash: string }> {
  const factory = new ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy(...constructorArgs);
  const receipt = await contract.deploymentTransaction()?.wait();
  return {
    address: await contract.getAddress(),
    transactionHash: receipt?.hash || "",
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Check if this is a bundle deployment request
    if (body.templateId) {
      return handleBundleDeployment(body as BundleDeployRequest);
    }
    
    // Handle single contract deployment (backward compatible)
    return handleSingleDeployment(body as DeployRequest);
  } catch (error) {
    console.error("Server deployment error:", error);
    const message = error instanceof Error ? error.message : "Deployment failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

async function handleSingleDeployment(body: DeployRequest) {
  const { abi, bytecode, constructorArgs, network } = body;

  // Validate network supports server-side deployment
  if (!isServerDeployNetwork(network)) {
    return NextResponse.json(
      { success: false, error: `Server-side deployment not supported for ${network}` },
      { status: 400 }
    );
  }

  // Get developer private key from environment
  const privateKey = process.env.CRONOS_DEVELOPER_PRIVATE_KEY;
  if (!privateKey) {
    return NextResponse.json(
      { success: false, error: "Developer private key not configured" },
      { status: 500 }
    );
  }

  // Create provider and wallet
  const rpcUrl = RPC_URLS[network];
  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);

  // Deploy contract
  const { address, transactionHash } = await deploySingleContract(
    abi,
    bytecode,
    constructorArgs,
    wallet
  );

  return NextResponse.json({
    success: true,
    contractAddress: address,
    transactionHash,
    deployerAddress: wallet.address,
  });
}

async function handleBundleDeployment(body: BundleDeployRequest) {
  const { templateId, network, userParams } = body;

  // Authenticate user
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  // Validate network supports server-side deployment
  if (!isServerDeployNetwork(network)) {
    return NextResponse.json(
      { success: false, error: `Server-side deployment not supported for ${network}` },
      { status: 400 }
    );
  }

  // Get developer private key from environment
  const privateKey = process.env.CRONOS_DEVELOPER_PRIVATE_KEY;
  if (!privateKey) {
    return NextResponse.json(
      { success: false, error: "Developer private key not configured" },
      { status: 500 }
    );
  }

  // Fetch the template
  const [template] = await db
    .select()
    .from(contractTemplate)
    .where(eq(contractTemplate.id, templateId));

  if (!template) {
    return NextResponse.json(
      { success: false, error: "Template not found" },
      { status: 404 }
    );
  }

  // Verify template has multi-file configuration
  if (!template.sourceFiles || !template.deploymentConfig) {
    return NextResponse.json(
      { success: false, error: "Template does not support bundle deployment" },
      { status: 400 }
    );
  }

  // Create provider and wallet
  const rpcUrl = RPC_URLS[network];
  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);

  // Create deployment context
  const context: DeploymentContext = {
    network,
    deployedAddresses: new Map(),
    userParams,
  };

  // Deploy function that uses the wallet
  const deployContract = async (
    bytecode: string,
    abi: object[],
    constructorArgs: unknown[]
  ) => {
    return deploySingleContract(abi, bytecode, constructorArgs, wallet);
  };

  // Deploy the bundle
  const result = await deployBundle(
    template as ContractTemplate,
    context,
    deployContract,
    session.user.id
  );

  return NextResponse.json({
    success: true,
    bundleId: result.bundleId,
    contracts: result.contracts.map((c) => ({
      filename: c.filename,
      contractName: c.contractName,
      address: c.address,
      transactionHash: c.transactionHash,
      role: c.role,
    })),
    deployerAddress: wallet.address,
  });
}
