// Deployment service for multi-contract bundle deployment
// Task 6.1: Deployment service for x402 contracts

import { db } from "@/lib/db";
import { userContract, type ContractTemplate, type EthereumNetwork, type DeploymentConfig, type SourceFile } from "@/lib/db/schema";
import { compileMultiFileSolidity } from "./compiler-service";
import { randomUUID } from "crypto";

export interface DeploymentContext {
  network: EthereumNetwork;
  deployedAddresses: Map<string, string>;  // filename -> address
  userParams: Record<string, unknown>;      // User-provided constructor params
}

export interface DeployedContract {
  filename: string;
  contractName: string;
  address: string;
  transactionHash: string;
  role: string;
  abi: object[];
  sourceCode: string;
}

export interface BundleDeploymentResult {
  bundleId: string;
  contracts: DeployedContract[];
}

export interface DeployContractFn {
  (bytecode: string, abi: object[], constructorArgs: unknown[]): Promise<{
    address: string;
    transactionHash: string;
  }>;
}

/**
 * Resolves constructor arguments for a contract based on deployment config
 * Injects addresses from previously deployed contracts
 * Returns both the args array and a named map for storage
 */
export function resolveConstructorArgs(
  filename: string,
  deploymentConfig: DeploymentConfig,
  context: DeploymentContext
): { args: unknown[]; namedArgs: Record<string, unknown> } {
  const deps = deploymentConfig.dependencies[filename];
  if (!deps || !deps.constructorParams) {
    return { args: [], namedArgs: {} };
  }

  const args: unknown[] = [];
  const namedArgs: Record<string, unknown> = {};
  
  for (const param of deps.constructorParams) {
    let value: unknown;
    
    if (param.sourceContract) {
      // Get address from previously deployed contract
      const address = context.deployedAddresses.get(param.sourceContract);
      if (!address) {
        throw new Error(`Dependency ${param.sourceContract} not yet deployed for ${filename}`);
      }
      value = address;
    } else if (param.externalAddress) {
      // Get address from user params
      const address = context.userParams[param.paramName];
      if (!address) {
        throw new Error(`External address ${param.paramName} not provided for ${filename}`);
      }
      value = address;
    }
    
    if (value !== undefined) {
      args.push(value);
      namedArgs[param.paramName] = value;
    }
  }

  return { args, namedArgs };
}

/**
 * Determines the role of a contract in the bundle based on its filename
 */
function determineContractRole(filename: string, isMain: boolean): string {
  if (isMain) return "hook";
  
  const lowerFilename = filename.toLowerCase();
  if (lowerFilename.includes("nft")) return "nft";
  if (lowerFilename.includes("token") || lowerFilename.includes("reward")) return "token";
  
  return "supporting";
}

/**
 * Deploys a multi-contract bundle in the correct order
 * Handles address injection for constructor dependencies
 */
export async function deployBundle(
  template: ContractTemplate,
  context: DeploymentContext,
  deployContract: DeployContractFn,
  userId: string
): Promise<BundleDeploymentResult> {
  if (!template.sourceFiles || !template.deploymentConfig) {
    throw new Error("Template does not have multi-file configuration");
  }

  const sourceFiles = template.sourceFiles;
  const deploymentConfig = template.deploymentConfig;
  
  // Compile all source files
  const compileResult = compileMultiFileSolidity(sourceFiles);
  if (!compileResult.success) {
    throw new Error(`Compilation failed: ${compileResult.errors?.join(", ")}`);
  }

  const bundleId = randomUUID();
  const deployedContracts: DeployedContract[] = [];
  const fileMap = new Map(sourceFiles.map(f => [f.filename, f]));

  // Deploy contracts in order
  for (const filename of deploymentConfig.deploymentOrder) {
    const compiled = compileResult.contracts[filename];
    if (!compiled) {
      throw new Error(`Compiled contract not found for ${filename}`);
    }

    const sourceFile = fileMap.get(filename);
    if (!sourceFile) {
      throw new Error(`Source file not found for ${filename}`);
    }

    // Resolve constructor arguments
    const { args: constructorArgs, namedArgs } = resolveConstructorArgs(filename, deploymentConfig, context);

    // Deploy the contract
    const { address, transactionHash } = await deployContract(
      compiled.bytecode,
      compiled.abi,
      constructorArgs
    );

    // Store deployed address for subsequent contracts
    context.deployedAddresses.set(filename, address);

    const role = determineContractRole(filename, sourceFile.isMain);

    // Save to database with named constructor args
    await db.insert(userContract).values({
      userId,
      templateId: template.id,
      name: `${template.name} - ${compiled.contractName}`,
      contractAddress: address,
      network: context.network,
      constructorArgs: namedArgs,
      deployedSourceCode: sourceFile.content,
      abi: compiled.abi,
      transactionHash,
      bundleId,
      bundleRole: role,
    });

    deployedContracts.push({
      filename,
      contractName: compiled.contractName,
      address,
      transactionHash,
      role,
      abi: compiled.abi,
      sourceCode: sourceFile.content,
    });
  }

  return {
    bundleId,
    contracts: deployedContracts,
  };
}

/**
 * Gets all contracts in a bundle
 */
export async function getContractsByBundleId(bundleId: string) {
  const { eq } = await import("drizzle-orm");
  return db
    .select()
    .from(userContract)
    .where(eq(userContract.bundleId, bundleId));
}
