import type { DappUiConfig, EthereumNetwork } from "@/lib/db/schema";

export interface TemplateProps {
  config: DappUiConfig;
  contract: {
    address: string;
    abi: object[];
    network: EthereumNetwork;
  };
}

export interface SectionConfig {
  enabled: boolean;
  title: string;
}
