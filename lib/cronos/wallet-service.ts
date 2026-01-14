import { ethers } from 'ethers';

export interface WalletInfo {
  address: string;
  privateKey: string;
  signer: ethers.Wallet;
}

export class CronosWalletService {
  /**
   * Derives a wallet from a BIP39 mnemonic phrase
   * Uses standard Ethereum derivation path: m/44'/60'/0'/0/{accountIndex}
   */
  static fromMnemonic(
    mnemonic: string,
    rpcUrl: string,
    accountIndex = 0
  ): WalletInfo {
    const trimmedMnemonic = mnemonic.trim();
    
    // Validate mnemonic word count (12 or 24 words)
    const words = trimmedMnemonic.split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      throw new Error('Mnemonic must be 12 or 24 words');
    }

    // Standard Ethereum derivation path
    const path = `m/44'/60'/0'/0/${accountIndex}`;
    const hdNode = ethers.HDNodeWallet.fromPhrase(trimmedMnemonic, undefined, path);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(hdNode.privateKey, provider);

    return {
      address: wallet.address,
      privateKey: hdNode.privateKey,
      signer: wallet,
    };
  }

  /**
   * Creates a wallet directly from a private key
   */
  static fromPrivateKey(privateKey: string, rpcUrl: string): WalletInfo {
    let normalizedKey = privateKey.trim();
    
    // Add 0x prefix if missing
    if (!normalizedKey.startsWith('0x')) {
      normalizedKey = `0x${normalizedKey}`;
    }

    // Validate private key format (0x + 64 hex chars)
    if (!/^0x[a-fA-F0-9]{64}$/.test(normalizedKey)) {
      throw new Error('Invalid private key format');
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(normalizedKey, provider);

    return {
      address: wallet.address,
      privateKey: normalizedKey,
      signer: wallet,
    };
  }

  /**
   * Validates if a string is a valid mnemonic phrase
   */
  static isValidMnemonic(mnemonic: string): boolean {
    const words = mnemonic.trim().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      return false;
    }
    try {
      ethers.Mnemonic.fromPhrase(mnemonic.trim());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validates if a string is a valid private key
   */
  static isValidPrivateKey(privateKey: string): boolean {
    let normalizedKey = privateKey.trim();
    if (!normalizedKey.startsWith('0x')) {
      normalizedKey = `0x${normalizedKey}`;
    }
    return /^0x[a-fA-F0-9]{64}$/.test(normalizedKey);
  }
}
