/**
 * x402 Settlement Service
 * Handles EIP-3009 signature generation and SettlementRouter interaction
 */

import { ethers } from "ethers";

// USDC on Cronos Testnet (EIP-3009 compatible) - devUSDC.e
const CRONOS_TESTNET_USDC = "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0";

// EIP-712 Domain for USDC transferWithAuthorization
const getUSDCDomain = (chainId: number, usdcAddress: string) => ({
  name: "USD Coin",
  version: "2",
  chainId,
  verifyingContract: usdcAddress,
});

// EIP-3009 TransferWithAuthorization type
const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

// SettlementRouter ABI (only the functions we need)
export const SETTLEMENT_ROUTER_ABI = [
  "function settleAndExecute(address token, address from, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes calldata signature, bytes32 salt, address payTo, uint256 facilitatorFee, address hook, bytes calldata hookData) external",
  "function calculateCommitment(address token, address from, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 salt, address payTo, uint256 facilitatorFee, address hook, bytes calldata hookData) external view returns (bytes32)",
  "function isSettled(bytes32 contextKey) external view returns (bool)",
  "function calculateContextKey(address from, address token, bytes32 nonce) external pure returns (bytes32)",
];

// NFTMintHook ABI
export const NFT_MINT_HOOK_ABI = [
  "function settlementRouter() external view returns (address)",
];

// RandomNFT ABI
export const RANDOM_NFT_ABI = [
  "function totalSupply() external view returns (uint256)",
  "function MAX_SUPPLY() external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
];

export interface X402PaymentParams {
  settlementRouterAddress: string;
  hookAddress: string;
  nftContractAddress: string;
  payTo: string; // Merchant address (receives USDC)
  amount: bigint; // Amount in USDC atomic units (6 decimals)
  facilitatorFee: bigint; // Fee for facilitator (can be 0)
  chainId: number;
  usdcAddress?: string;
}

export interface X402SignatureResult {
  signature: string;
  nonce: string; // This is the commitment hash
  salt: string;
  validAfter: number;
  validBefore: number;
  hookData: string;
}

/**
 * Encode hookData for NFTMintHook
 * The hook expects: struct MintConfig { address nftContract; }
 */
export function encodeNFTMintHookData(nftContractAddress: string): string {
  const abiCoder = new ethers.AbiCoder();
  return abiCoder.encode(["tuple(address)"], [[nftContractAddress]]);
}

/**
 * Generate a random salt for the payment
 */
export function generateSalt(): string {
  const randomBytes = ethers.randomBytes(32);
  return ethers.hexlify(randomBytes);
}

/**
 * Calculate the commitment hash that will be used as the nonce
 */
export async function calculateCommitment(
  provider: ethers.Provider,
  params: X402PaymentParams,
  salt: string,
  hookData: string,
  signerAddress: string
): Promise<string> {
  const router = new ethers.Contract(
    params.settlementRouterAddress,
    SETTLEMENT_ROUTER_ABI,
    provider
  );

  const validAfter = 0; // Valid immediately
  const validBefore = Math.floor(Date.now() / 1000) + 3600; // Valid for 1 hour

  const commitment = await router.calculateCommitment(
    params.usdcAddress || CRONOS_TESTNET_USDC,
    signerAddress,
    params.amount,
    validAfter,
    validBefore,
    salt,
    params.payTo,
    params.facilitatorFee,
    params.hookAddress,
    hookData
  );

  return commitment;
}

/**
 * Sign the EIP-3009 transferWithAuthorization message
 * Returns the signature and all parameters needed for settleAndExecute
 */
export async function signX402Payment(
  signer: ethers.Signer,
  params: X402PaymentParams
): Promise<X402SignatureResult> {
  const address = await signer.getAddress();
  const usdcAddress = params.usdcAddress || CRONOS_TESTNET_USDC;
  
  // Generate salt and encode hook data
  const salt = generateSalt();
  const hookData = encodeNFTMintHookData(params.nftContractAddress);
  
  // Time bounds
  const validAfter = 0;
  const validBefore = Math.floor(Date.now() / 1000) + 3600; // 1 hour

  // Calculate commitment hash (this becomes the nonce)
  const router = new ethers.Contract(
    params.settlementRouterAddress,
    SETTLEMENT_ROUTER_ABI,
    signer.provider!
  );

  const nonce = await router.calculateCommitment(
    usdcAddress,
    address,
    params.amount,
    validAfter,
    validBefore,
    salt,
    params.payTo,
    params.facilitatorFee,
    params.hookAddress,
    hookData
  );

  // Create EIP-712 domain and message for USDC
  const domain = getUSDCDomain(params.chainId, usdcAddress);
  
  const message = {
    from: address,
    to: params.settlementRouterAddress, // USDC goes to router first
    value: params.amount,
    validAfter,
    validBefore,
    nonce,
  };

  // Sign the typed data
  const signature = await signer.signTypedData(
    domain,
    TRANSFER_WITH_AUTHORIZATION_TYPES,
    message
  );

  return {
    signature,
    nonce,
    salt,
    validAfter,
    validBefore,
    hookData,
  };
}

/**
 * Execute the x402 settlement (user acts as facilitator)
 * This calls SettlementRouter.settleAndExecute()
 */
export async function executeX402Settlement(
  signer: ethers.Signer,
  params: X402PaymentParams,
  signatureResult: X402SignatureResult
): Promise<ethers.TransactionResponse> {
  const address = await signer.getAddress();
  const usdcAddress = params.usdcAddress || CRONOS_TESTNET_USDC;

  const router = new ethers.Contract(
    params.settlementRouterAddress,
    SETTLEMENT_ROUTER_ABI,
    signer
  );

  const tx = await router.settleAndExecute(
    usdcAddress,
    address,
    params.amount,
    signatureResult.validAfter,
    signatureResult.validBefore,
    signatureResult.nonce,
    signatureResult.signature,
    signatureResult.salt,
    params.payTo,
    params.facilitatorFee,
    params.hookAddress,
    signatureResult.hookData
  );

  return tx;
}

/**
 * Get NFT collection stats
 */
export async function getNFTStats(
  provider: ethers.Provider,
  nftContractAddress: string
): Promise<{ totalSupply: number; maxSupply: number; remaining: number }> {
  const nft = new ethers.Contract(nftContractAddress, RANDOM_NFT_ABI, provider);
  
  const [totalSupply, maxSupply] = await Promise.all([
    nft.totalSupply(),
    nft.MAX_SUPPLY(),
  ]);

  return {
    totalSupply: Number(totalSupply),
    maxSupply: Number(maxSupply),
    remaining: Number(maxSupply) - Number(totalSupply),
  };
}

/**
 * Check if user has approved USDC for the router (not needed for EIP-3009, but useful for display)
 */
export async function checkUSDCBalance(
  provider: ethers.Provider,
  userAddress: string,
  usdcAddress?: string
): Promise<bigint> {
  const usdc = new ethers.Contract(
    usdcAddress || CRONOS_TESTNET_USDC,
    ["function balanceOf(address) view returns (uint256)"],
    provider
  );
  return await usdc.balanceOf(userAddress);
}
