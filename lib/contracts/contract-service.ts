// Contract service for managing user deployed contracts
// Task 3.5: Contract service

import { db } from "@/lib/db";
import { userContract, type EthereumNetwork, type UserContract } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export interface SaveContractRequest {
  userId: string;
  templateId?: string;
  name: string;
  contractAddress: string;
  network: EthereumNetwork;
  constructorArgs?: Record<string, unknown>;
  deployedSourceCode: string;
  abi: object[];
  transactionHash: string;
}

export async function getUserContracts(userId: string): Promise<UserContract[]> {
  return db
    .select()
    .from(userContract)
    .where(eq(userContract.userId, userId));
}

export async function getContractsByNetwork(
  userId: string,
  network: EthereumNetwork
): Promise<UserContract[]> {
  return db
    .select()
    .from(userContract)
    .where(and(eq(userContract.userId, userId), eq(userContract.network, network)));
}

export async function saveUserContract(data: SaveContractRequest): Promise<UserContract> {
  const [result] = await db
    .insert(userContract)
    .values({
      userId: data.userId,
      templateId: data.templateId,
      name: data.name,
      contractAddress: data.contractAddress,
      network: data.network,
      constructorArgs: data.constructorArgs,
      deployedSourceCode: data.deployedSourceCode,
      abi: data.abi,
      transactionHash: data.transactionHash,
    })
    .returning();
  return result;
}

export async function getContractById(id: string): Promise<UserContract | null> {
  const results = await db
    .select()
    .from(userContract)
    .where(eq(userContract.id, id));
  return results[0] ?? null;
}

export async function deleteUserContract(id: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(userContract)
    .where(and(eq(userContract.id, id), eq(userContract.userId, userId)))
    .returning();
  return result.length > 0;
}

export async function deleteContractBundle(bundleId: string, userId: string): Promise<number> {
  const result = await db
    .delete(userContract)
    .where(and(eq(userContract.bundleId, bundleId), eq(userContract.userId, userId)))
    .returning();
  return result.length;
}
