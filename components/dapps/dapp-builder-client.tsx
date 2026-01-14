"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, ExternalLink, Pencil, Trash2, Globe, GlobeLock, LayoutDashboard, Package, Copy, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { WalletConnectButton } from "@/components/contracts/wallet-connect-button";
import type { UserContract, UserDapp, DappTemplate } from "@/lib/db/schema";
import { DappEditor, type ContractBundle } from "./dapp-editor";

interface DappWithContract {
  dapp: UserDapp;
  contract: UserContract;
}

export function DappBuilderClient() {
  const [contracts, setContracts] = useState<UserContract[]>([]);
  const [dapps, setDapps] = useState<DappWithContract[]>([]);
  const [templates, setTemplates] = useState<DappTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContract, setSelectedContract] = useState<UserContract | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<ContractBundle | null>(null);
  const [editingDapp, setEditingDapp] = useState<DappWithContract | null>(null);
  const [networkFilter, setNetworkFilter] = useState<"all" | "cronos_testnet">("all");
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const copyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [contractsRes, dappsRes, templatesRes] = await Promise.all([
        fetch("/api/contracts/user-contracts"),
        fetch("/api/dapps"),
        fetch("/api/dapps/templates"),
      ]);
      
      if (contractsRes.ok) {
        const data = await contractsRes.json();
        setContracts(data.contracts || []);
      }
      if (dappsRes.ok) {
        const data = await dappsRes.json();
        setDapps(Array.isArray(data) ? data : []);
      }
      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Group contracts by bundleId for x402 bundles
  const { bundles, standaloneContracts } = useMemo(() => {
    const bundleMap = new Map<string, UserContract[]>();
    const standalone: UserContract[] = [];

    for (const contract of contracts) {
      if (contract.bundleId) {
        const existing = bundleMap.get(contract.bundleId) || [];
        existing.push(contract);
        bundleMap.set(contract.bundleId, existing);
      } else {
        standalone.push(contract);
      }
    }

    const bundles: ContractBundle[] = [];
    for (const [bundleId, bundleContracts] of bundleMap) {
      const templateName = bundleContracts[0]?.name.split(" - ")[0] || "Contract Bundle";
      const hookContract = bundleContracts.find(c => c.bundleRole === "hook");
      bundles.push({ bundleId, contracts: bundleContracts, templateName, hookContract });
    }

    return { bundles, standaloneContracts: standalone };
  }, [contracts]);

  const handleCreateDapp = (contract: UserContract, bundle?: ContractBundle) => {
    setSelectedBundle(bundle || null);
    setSelectedContract(contract);
    setEditingDapp(null);
  };

  const handleEditDapp = (dappWithContract: DappWithContract) => {
    setEditingDapp(dappWithContract);
    setSelectedContract(null);
  };

  const handleDeleteDapp = async (id: string) => {
    if (!confirm("Are you sure you want to delete this DApp?")) return;
    
    try {
      const res = await fetch(`/api/dapps/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDapps(dapps.filter((d) => d.dapp.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete DApp:", error);
    }
  };

  const handleTogglePublish = async (dapp: UserDapp) => {
    try {
      const res = await fetch(`/api/dapps/${dapp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !dapp.isPublished }),
      });
      if (res.ok) {
        loadData();
      }
    } catch (error) {
      console.error("Failed to toggle publish:", error);
    }
  };

  const handleClose = () => {
    setSelectedContract(null);
    setEditingDapp(null);
    loadData();
  };

  const getTemplateForContract = (contract: UserContract): DappTemplate | undefined => {
    const name = contract.name.toLowerCase();
    // Check for x402 templates first
    if (contract.bundleRole === "hook" || name.includes("hook")) {
      if (name.includes("nft") || name.includes("mint")) {
        return templates.find((t) => t.defaultConfig.templateType === "x402-nft-mint");
      }
      if (name.includes("reward") || name.includes("point")) {
        return templates.find((t) => t.defaultConfig.templateType === "x402-reward-points");
      }
      if (name.includes("transfer") || name.includes("split")) {
        return templates.find((t) => t.defaultConfig.templateType === "x402-split-payment");
      }
    }
    // Fallback to first x402 template
    return templates[0];
  };

  const filteredContracts = standaloneContracts.filter(
    (c) => networkFilter === "all" || c.network === networkFilter
  );

  const filteredBundles = bundles.filter(
    (b) => networkFilter === "all" || b.contracts[0]?.network === networkFilter
  );

  const filteredDapps = dapps.filter(
    (d) => networkFilter === "all" || d.contract.network === networkFilter
  );

  // Show editor if creating or editing
  if (selectedContract || editingDapp) {
    const contract = selectedContract || editingDapp?.contract;
    const template = selectedContract ? getTemplateForContract(selectedContract) : undefined;
    
    return (
      <DappEditor
        contract={contract!}
        existingDapp={editingDapp?.dapp}
        template={template}
        bundle={selectedBundle || undefined}
        onClose={handleClose}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="DApps Builder"
        description="Create public facing dapps interface for your deployed smart contracts using AI guided tool. Customize themes, branding, and features to build production-ready decentralized applications."
        badge={{ text: "Cronos Chain", variant: "outline" }}
        notice={{
          text: "DApps interact with contracts deployed on Cronos network.",
        }}
      >
        <WalletConnectButton />
      </PageHeader>

      <Tabs defaultValue="dapps" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="dapps">My DApps ({dapps.length})</TabsTrigger>
            <TabsTrigger value="contracts">Contracts ({contracts.length})</TabsTrigger>
          </TabsList>
          
          <div className="flex gap-2">
            <Button
              variant={networkFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setNetworkFilter("all")}
            >
              All
            </Button>
            <Button
              variant={networkFilter === "cronos_testnet" ? "default" : "outline"}
              size="sm"
              onClick={() => setNetworkFilter("cronos_testnet")}
            >
              Testnet
            </Button>
          </div>
        </div>

        <TabsContent value="dapps" className="space-y-4">
          {filteredDapps.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No DApps created yet. Select a contract to create your first DApp.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredDapps.map(({ dapp, contract }) => (
                <Card key={dapp.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{dapp.name}</CardTitle>
                        <CardDescription className="text-xs">{contract.name}</CardDescription>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={contract.network === "cronos_mainnet" ? "default" : "secondary"} className="text-xs">
                          {contract.network === "cronos_mainnet" ? "Mainnet" : "Testnet"}
                        </Badge>
                        {dapp.isPublished ? (
                          <Badge variant="default" className="text-xs bg-green-600">
                            <Globe className="h-3 w-3 mr-1" /> Live
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <GlobeLock className="h-3 w-3 mr-1" /> Draft
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {dapp.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{dapp.description}</p>
                    )}
                    {dapp.isPublished && (
                      <a
                        href={`/dapp/${dapp.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        /dapp/{dapp.slug} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEditDapp({ dapp, contract })}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleTogglePublish(dapp)}>
                        {dapp.isPublished ? "Unpublish" : "Publish"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteDapp(dapp.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="contracts" className="space-y-6">
          {/* x402 Contract Bundles - exclude router-only bundles */}
          {filteredBundles.filter(b => {
            // Exclude bundles that are just the SettlementRouter
            const isRouterOnly = b.contracts.length === 1 && 
              b.templateName.toLowerCase().includes("settlement") && 
              b.templateName.toLowerCase().includes("router");
            return !isRouterOnly;
          }).length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Package className="h-4 w-4" /> x402 Contract Bundles
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredBundles.filter(b => {
                  const isRouterOnly = b.contracts.length === 1 && 
                    b.templateName.toLowerCase().includes("settlement") && 
                    b.templateName.toLowerCase().includes("router");
                  return !isRouterOnly;
                }).map((bundle) => {
                  const hookContract = bundle.hookContract || bundle.contracts[0];
                  const dappCount = dapps.filter((d) => 
                    bundle.contracts.some(c => c.id === d.contract.id)
                  ).length;
                  return (
                    <Card key={bundle.bundleId} className="border-2 border-dashed border-orange-200">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              <Package className="h-4 w-4 text-orange-500" />
                              {bundle.templateName}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {bundle.contracts.length} contracts in bundle
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-1">
                            {dappCount > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {dappCount} DApp{dappCount > 1 ? "s" : ""}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                              x402
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-xs space-y-1">
                          {bundle.contracts.map((c) => (
                            <div key={c.id} className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground">{c.bundleRole || "contract"}</span>
                              <div className="flex items-center gap-1">
                                <span className="font-mono">{c.contractAddress.slice(0, 8)}...</span>
                                <button
                                  onClick={() => copyAddress(c.contractAddress)}
                                  className="p-0.5 hover:bg-muted rounded"
                                  title="Copy address"
                                >
                                  {copiedAddress === c.contractAddress ? (
                                    <Check className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <Copy className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleCreateDapp(hookContract, bundle)}
                          className="w-full bg-orange-500 hover:bg-orange-600"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Create x402 DApp
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* x402 Infrastructure (Settlement Routers) */}
          {filteredBundles.filter(b => {
            const isRouterOnly = b.contracts.length === 1 && 
              b.templateName.toLowerCase().includes("settlement") && 
              b.templateName.toLowerCase().includes("router");
            return isRouterOnly;
          }).length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                🔧 x402 Infrastructure
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredBundles.filter(b => {
                  const isRouterOnly = b.contracts.length === 1 && 
                    b.templateName.toLowerCase().includes("settlement") && 
                    b.templateName.toLowerCase().includes("router");
                  return isRouterOnly;
                }).map((bundle) => {
                  const routerContract = bundle.contracts[0];
                  return (
                    <Card key={bundle.bundleId} className="border border-blue-200 bg-blue-50/50">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              🔧 {bundle.templateName}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              Shared infrastructure contract
                            </CardDescription>
                          </div>
                          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                            Infrastructure
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-xs flex items-center gap-2">
                          <span className="text-muted-foreground">Address: </span>
                          <span className="font-mono">{routerContract.contractAddress.slice(0, 10)}...{routerContract.contractAddress.slice(-6)}</span>
                          <button
                            onClick={() => copyAddress(routerContract.contractAddress)}
                            className="p-1 hover:bg-muted rounded"
                            title="Copy address"
                          >
                            {copiedAddress === routerContract.contractAddress ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground italic">
                          This router is used by all x402 hook contracts. Create DApps from hook bundles instead.
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Standalone Contracts */}
          {filteredContracts.length === 0 && filteredBundles.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No deployed contracts. Deploy a contract first from the Contracts Library.
              </CardContent>
            </Card>
          ) : filteredContracts.length > 0 && (
            <div className="space-y-4">
              {filteredBundles.length > 0 && (
                <h3 className="text-sm font-medium text-muted-foreground">Standalone Contracts</h3>
              )}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredContracts.map((contract) => {
                  const dappCount = dapps.filter((d) => d.contract.id === contract.id).length;
                  const isRouter = contract.name.toLowerCase().includes("settlement") && 
                                   contract.name.toLowerCase().includes("router");
                  return (
                    <Card key={contract.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base">{contract.name}</CardTitle>
                          <div className="flex items-center gap-1">
                            {dappCount > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {dappCount} DApp{dappCount > 1 ? "s" : ""}
                              </Badge>
                            )}
                            {isRouter && (
                              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                                Infrastructure
                              </Badge>
                            )}
                            <Badge variant={contract.network === "cronos_mainnet" ? "default" : "secondary"} className="text-xs">
                              {contract.network === "cronos_mainnet" ? "Mainnet" : "Testnet"}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-mono text-muted-foreground">
                            {contract.contractAddress.slice(0, 10)}...{contract.contractAddress.slice(-8)}
                          </p>
                          <button
                            onClick={() => copyAddress(contract.contractAddress)}
                            className="p-0.5 hover:bg-muted rounded"
                            title="Copy address"
                          >
                            {copiedAddress === contract.contractAddress ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                        {isRouter ? (
                          <p className="text-xs text-muted-foreground italic">
                            Router contracts are shared infrastructure - create DApps from hook contracts instead.
                          </p>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleCreateDapp(contract)}
                            className="w-full"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Create DApp
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
