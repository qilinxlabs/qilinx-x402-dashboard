// API route for managing user deployed contracts
// Task 7.2: User contracts API route

import { auth } from "@/app/(auth)/auth";
import {
  getUserContracts,
  getContractsByNetwork,
  saveUserContract,
  deleteUserContract,
  deleteContractBundle,
  type SaveContractRequest,
} from "@/lib/contracts/contract-service";
import type { EthereumNetwork } from "@/lib/db/schema";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const network = searchParams.get("network") as EthereumNetwork | null;

    const contracts = network
      ? await getContractsByNetwork(session.user.id, network)
      : await getUserContracts(session.user.id);

    return Response.json({ contracts });
  } catch (error) {
    console.error("Error fetching user contracts:", error);
    return Response.json({ error: "Failed to fetch contracts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    // Validate required fields
    const { name, contractAddress, network, deployedSourceCode, abi, transactionHash } = body;
    if (!name || !contractAddress || !network || !deployedSourceCode || !abi || !transactionHash) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const data: SaveContractRequest = {
      userId: session.user.id,
      templateId: body.templateId,
      name,
      contractAddress,
      network,
      constructorArgs: body.constructorArgs,
      deployedSourceCode,
      abi,
      transactionHash,
    };

    const contract = await saveUserContract(data);
    return Response.json({ contract }, { status: 201 });
  } catch (error) {
    console.error("Error saving contract:", error);
    return Response.json({ error: "Failed to save contract" }, { status: 500 });
  }
}


export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get("id");
    const bundleId = searchParams.get("bundleId");

    if (bundleId) {
      // Delete entire bundle
      const count = await deleteContractBundle(bundleId, session.user.id);
      return Response.json({ deleted: count, bundleId });
    } else if (contractId) {
      // Delete single contract
      const deleted = await deleteUserContract(contractId, session.user.id);
      if (!deleted) {
        return Response.json({ error: "Contract not found" }, { status: 404 });
      }
      return Response.json({ deleted: true, id: contractId });
    } else {
      return Response.json({ error: "Missing id or bundleId parameter" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error deleting contract:", error);
    return Response.json({ error: "Failed to delete contract" }, { status: 500 });
  }
}
