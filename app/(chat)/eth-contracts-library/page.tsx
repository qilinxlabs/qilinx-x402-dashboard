"use client";

import { useState, useEffect, useMemo } from "react";
import { TemplateCard } from "@/components/contracts/template-card";
import { NetworkSelector } from "@/components/contracts/network-selector";
import { UserContractsList } from "@/components/contracts/user-contracts-list";
import { ContractCustomizer } from "@/components/contracts/contract-customizer";
import { WalletConnectButton } from "@/components/contracts/wallet-connect-button";
import { Loader2, FileCode, Router, Webhook } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import type { ContractTemplate, EthereumNetwork } from "@/lib/db/schema";
import type { DeploymentResult } from "@/lib/contracts/web3-service";
import { getBlockExplorerUrl, getNetworkDisplayName } from "@/lib/contracts/network-config";

export default function EthContractsLibraryPage() {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [network, setNetwork] = useState<EthereumNetwork>("cronos_testnet");
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/contracts/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    } finally {
      setLoading(false);
    }
  };

  // Separate x402 templates into router and hooks
  const { routerTemplates, hookTemplates } = useMemo(() => {
    const routers: ContractTemplate[] = [];
    const hooks: ContractTemplate[] = [];

    // Only process x402 templates
    for (const template of templates) {
      if (template.category === "x402-settlement" || 
          template.name.toLowerCase().includes("x402")) {
        if (template.name.toLowerCase().includes("settlement router")) {
          routers.push(template);
        } else {
          hooks.push(template);
        }
      }
    }

    return { routerTemplates: routers, hookTemplates: hooks };
  }, [templates]);

  const handleDeploySuccess = async (
    result: DeploymentResult,
    sourceCode: string,
    abi: object[]
  ) => {
    if (!selectedTemplate || !result.contractAddress || !result.transactionHash) return;

    // Check if this is a multi-file bundle deployment
    // Bundle deployments are already saved to DB by deployBundle() in deployment-service.ts
    const isMultiFile = !!(selectedTemplate.sourceFiles && selectedTemplate.sourceFiles.length > 0 && selectedTemplate.deploymentConfig);
    
    if (isMultiFile) {
      // Bundle deployment - contracts already saved by deployment service
      const explorerUrl = getBlockExplorerUrl(network, result.contractAddress);
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-medium">Contract bundle deployed successfully!</span>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline"
          >
            View main contract on {getNetworkDisplayName(network)} Explorer
          </a>
        </div>
      );
      setRefreshKey((k) => k + 1);
      setSelectedTemplate(null);
      return;
    }

    // Single contract deployment - save to database
    try {
      const res = await fetch("/api/contracts/user-contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          name: selectedTemplate.name,
          contractAddress: result.contractAddress,
          network,
          constructorArgs: {},
          deployedSourceCode: sourceCode,
          abi,
          transactionHash: result.transactionHash,
        }),
      });

      if (res.ok) {
        const explorerUrl = getBlockExplorerUrl(network, result.contractAddress);
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Contract deployed successfully!</span>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-500 hover:underline"
            >
              View on {getNetworkDisplayName(network)} Explorer
            </a>
          </div>
        );
        setRefreshKey((k) => k + 1);
        setSelectedTemplate(null);
      }
    } catch (error) {
      console.error("Failed to save contract:", error);
      toast.error("Contract deployed but failed to save to database");
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <PageHeader
        icon={FileCode}
        title="Smart Contracts Library"
        description="Select contract template, build and deploy USDC integrated smart contracts on Cronos."
        badge={{ text: network === "cronos_testnet" ? "Cronos Testnet" : "Cronos Mainnet", variant: "outline" }}
      >
        <div className="flex items-center gap-3">
          <WalletConnectButton targetNetwork={network} />
          <NetworkSelector value={network} onChange={setNetwork} />
        </div>
      </PageHeader>

      {/* Templates Section */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-4">Contract Templates</h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">
            No templates available. Check back later.
          </p>
        ) : (
          <Tabs defaultValue="router" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="router" className="flex items-center gap-2">
                <Router className="h-4 w-4" />
                x402 Router ({routerTemplates.length})
              </TabsTrigger>
              <TabsTrigger value="hooks" className="flex items-center gap-2">
                <Webhook className="h-4 w-4" />
                x402 Contracts ({hookTemplates.length})
              </TabsTrigger>
            </TabsList>

            {/* Settlement Router Tab */}
            <TabsContent value="router">
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                Deploy the Settlement Router <strong>once per network</strong>. All Hook contracts share this router.
              </div>
              
              {routerTemplates.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center">
                    <Router className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Settlement Router template not available yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {routerTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onClick={() => setSelectedTemplate(template)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* x402 Hook Contracts Tab */}
            <TabsContent value="hooks">
              <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg text-sm text-orange-700 dark:text-orange-300">
                Hook contracts need a <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">_settlementRouter</code> address. Deploy the router first.
              </div>

              {hookTemplates.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center">
                    <Webhook className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No x402 contract templates available yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {hookTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onClick={() => setSelectedTemplate(template)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </section>

      {/* User Contracts Section */}
      <section>
        <UserContractsList key={refreshKey} />
      </section>

      {/* Customizer Modal */}
      {selectedTemplate && (
        <ContractCustomizer
          template={selectedTemplate}
          network={network}
          onClose={() => setSelectedTemplate(null)}
          onDeploySuccess={handleDeploySuccess}
        />
      )}
    </div>
  );
}
