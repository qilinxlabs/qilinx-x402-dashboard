import { Facilitator, CronosNetwork } from '@crypto.com/facilitator-client';
import type { ethers } from 'ethers';
import { getNetworkConfig, type CronosNetworkConfig } from './network-config';

export interface PaymentParams {
  recipientAddress: string;
  amount: string; // in base units (6 decimals for USDCe)
  description?: string;
}

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export type PaymentStatus = 
  | 'idle'
  | 'generating'
  | 'verifying'
  | 'settling'
  | 'success'
  | 'error';

export interface PaymentState {
  status: PaymentStatus;
  currentStep?: string;
  txHash?: string;
  error?: string;
}

export class CronosFacilitatorService {
  private facilitator: Facilitator;
  private networkConfig: CronosNetworkConfig;

  constructor(network: 'mainnet' | 'testnet') {
    this.networkConfig = getNetworkConfig(network);
    this.facilitator = new Facilitator({
      network: this.networkConfig.cronosNetwork,
    });
  }

  getNetworkConfig(): CronosNetworkConfig {
    return this.networkConfig;
  }

  generatePaymentRequirements(params: PaymentParams) {
    return this.facilitator.generatePaymentRequirements({
      payTo: params.recipientAddress,
      description: params.description || 'X402 Payment',
      maxAmountRequired: params.amount,
    });
  }

  async generatePaymentHeader(
    params: PaymentParams,
    signer: ethers.Signer,
    validBefore?: number
  ): Promise<string> {
    const expiry = validBefore || Math.floor(Date.now() / 1000) + 600; // 10 min default
    
    return this.facilitator.generatePaymentHeader({
      to: params.recipientAddress,
      value: params.amount,
      signer,
      validBefore: expiry,
    });
  }

  async verifyPayment(header: string, requirements: ReturnType<typeof this.generatePaymentRequirements>) {
    const body = this.facilitator.buildVerifyRequest(header, requirements);
    return this.facilitator.verifyPayment(body);
  }

  async settlePayment(header: string, requirements: ReturnType<typeof this.generatePaymentRequirements>) {
    const body = this.facilitator.buildVerifyRequest(header, requirements);
    return this.facilitator.settlePayment(body);
  }

  async executePaymentFlow(
    params: PaymentParams,
    signer: ethers.Signer,
    onStatusChange: (state: PaymentState) => void
  ): Promise<PaymentResult> {
    try {
      // Step 1: Generate payment requirements
      onStatusChange({ status: 'generating', currentStep: 'Generating payment requirements...' });
      const requirements = this.generatePaymentRequirements(params);

      // Step 2: Generate payment header
      onStatusChange({ status: 'generating', currentStep: 'Generating payment header...' });
      const header = await this.generatePaymentHeader(params, signer);

      // Step 3: Verify payment
      onStatusChange({ status: 'verifying', currentStep: 'Verifying payment...' });
      const verifyResponse = await this.verifyPayment(header, requirements);

      if (!verifyResponse.isValid) {
        const error = 'Payment verification failed';
        onStatusChange({ status: 'error', error });
        return { success: false, error };
      }

      // Step 4: Settle payment
      onStatusChange({ status: 'settling', currentStep: 'Settling payment on-chain...' });
      const settleResponse = await this.settlePayment(header, requirements);

      if (!settleResponse.txHash) {
        const error = 'Payment settlement failed - no transaction hash returned';
        onStatusChange({ status: 'error', error });
        return { success: false, error };
      }

      // Success
      onStatusChange({ status: 'success', txHash: settleResponse.txHash });
      return { success: true, txHash: settleResponse.txHash };

    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error occurred';
      onStatusChange({ status: 'error', error });
      return { success: false, error };
    }
  }

  async getSupported() {
    return this.facilitator.getSupported();
  }
}
