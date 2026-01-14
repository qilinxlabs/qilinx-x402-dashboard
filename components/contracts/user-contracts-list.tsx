"use client";

import { useState, useEffect, useMemo } from "react";
import { UserContractCard } from "./user-contract-card";
import { Loader2, Package, Router, Webhook, Copy, Check, FileCode, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { UserContract, EthereumNetwork } from "@/lib/db/schema";

interface ContractBundle {
  bundleId: string;
  contracts: UserContract[];
  templateName: string;
}

export function UserContractsList() {
  const [contracts, setContracts] = useState<UserContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [networkFilter, setNetworkFilter] = useState<EthereumNetwork | "all">("all");
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [deletingBundle, setDeletingBundle] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: "bundle" | "router" | null;
    id: string | null;
    name: string;
  }>({ open: false, type: null, id: null, name: "" });

  useEffect(() => {
    fetchContracts();
  }, [networkFilter]);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const url = networkFilter === "all"
        ? "/api/contracts/user-contracts"
        : `/api/contracts/user-contracts?network=${networkFilter}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setContracts(data.contracts);
      }
    } catch (error) {
      console.error("Failed to fetch contracts:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleDeleteContract = (id: string) => {
    setContracts(contracts.filter(c => c.id !== id));
  };

  const openDeleteDialog = (type: "bundle" | "router", id: string, name: string) => {
    setDeleteDialog({ open: true, type, id, name });
  };

  const closeDeleteDialog = () => {
    setDeleteDialog({ open: false, type: null, id: null, name: "" });
  };

  const confirmDelete = async () => {
    const { type, id } = deleteDialog;
    if (!id) return;

    if (type === "bundle") {
      setDeletingBundle(id);
      try {
        const res = await fetch(`/api/contracts/user-contracts?bundleId=${id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setContracts(contracts.filter(c => c.bundleId !== id));
        }
      } catch (error) {
        console.error("Failed to delete bundle:", error);
      } finally {
        setDeletingBundle(null);
      }
    } else if (type === "router") {
      try {
        const res = await fetch(`/api/contracts/user-contracts?id=${id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setContracts(contracts.filter(c => c.id !== id));
        }
      } catch (error) {
        console.error("Failed to delete router:", error);
      }
    }
    closeDeleteDialog();
  };

  // Separate contracts into settlement routers and x402 hooks
  const { settlementRouters, hookContracts } = useMemo(() => {
    const routers: UserContract[] = [];
    const hooks: UserContract[] = [];

    for (const contract of contracts) {
      if (contract.name.toLowerCase().includes("settlement router")) {
        routers.push(contract);
      } else if (contract.name.toLowerCase().includes("x402") || 
          contract.bundleRole === "hook" ||
          contract.bundleRole === "nft" ||
          contract.bundleRole === "token") {
        hooks.push(contract);
      }
    }

    return { settlementRouters: routers, hookContracts: hooks };
  }, [contracts]);

  // Group hook contracts by bundleId
  const { bundles, standaloneHookContracts } = useMemo(() => {
    const bundleMap = new Map<string, UserContract[]>();
    const standalone: UserContract[] = [];

    for (const contract of hookContracts) {
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
      const firstContract = bundleContracts[0];
      const templateName = firstContract.name.split(" - ")[0] || "Contract Bundle";
      bundles.push({ bundleId, contracts: bundleContracts, templateName });
    }

    return { bundles, standaloneHookContracts: standalone };
  }, [hookContracts]);

  const getRoleBadgeColor = (role: string | null) => {
    switch (role) {
      case "hook": return "bg-orange-100 text-orange-800 border-orange-200";
      case "nft": return "bg-purple-100 text-purple-800 border-purple-200";
      case "token": return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getNetworkLabel = (network: string) => {
    switch (network) {
      case "cronos_testnet": return "Cronos Testnet";
      case "cronos_mainnet": return "Cronos Mainnet";
      default: return network;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">My Deployed Contracts</h3>
        <select
          value={networkFilter}
          onChange={(e) => setNetworkFilter(e.target.value as EthereumNetwork | "all")}
          className="text-sm border rounded-md px-2 py-1"
        >
          <option value="all">All Networks</option>
          <option value="cronos_testnet">Cronos Testnet</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : contracts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No contracts deployed yet. Select a template above to get started.
        </p>
      ) : (
        <Tabs defaultValue="router" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="router" className="flex items-center gap-2">
              <Router className="h-4 w-4" />
              x402 Router ({settlementRouters.length})
            </TabsTrigger>
            <TabsTrigger value="hooks" className="flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              x402 Contracts ({hookContracts.length})
            </TabsTrigger>
          </TabsList>

          {/* Settlement Routers Tab */}
          <TabsContent value="router" className="mt-4">
            {settlementRouters.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <Router className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">No Settlement Router deployed yet</p>
                  <p className="text-sm text-muted-foreground">
                    Deploy a Settlement Router first. You only need ONE per network.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                  Copy the router address and use it as <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">_settlementRouter</code> when deploying x402 contracts.
                </div>
                <div className="grid gap-4">
                  {settlementRouters.map((router) => (
                    <Card key={router.id} className="border-2 border-blue-200 dark:border-blue-800">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Router className="h-5 w-5 text-blue-600" />
                            <CardTitle className="text-base">{router.name}</CardTitle>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              {getNetworkLabel(router.network)}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => openDeleteDialog("router", router.id, router.name)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                          <code className="flex-1 text-sm font-mono truncate">
                            {router.contractAddress}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyAddress(router.contractAddress)}
                            className="shrink-0"
                          >
                            {copiedAddress === router.contractAddress ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Deployed: {new Date(router.deployedAt).toLocaleDateString()}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* x402 Hook Contracts Tab */}
          <TabsContent value="hooks" className="mt-4">
            {hookContracts.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <Webhook className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">No x402 contracts deployed yet</p>
                  <p className="text-sm text-muted-foreground">
                    Deploy NFT Mint, Reward Points, or Transfer contracts.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Bundled Contracts */}
                {bundles.map((bundle) => (
                  <Card key={bundle.bundleId} className="border-2 border-dashed">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Package className="h-5 w-5 text-muted-foreground" />
                          <CardTitle className="text-base">{bundle.templateName}</CardTitle>
                          <Badge variant="outline" className="text-xs">
                            {bundle.contracts.length} contracts
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => openDeleteDialog("bundle", bundle.bundleId, bundle.templateName)}
                          disabled={deletingBundle === bundle.bundleId}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Bundle: {bundle.bundleId.slice(0, 8)}...
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 md:grid-cols-2">
                        {bundle.contracts.map((contract) => (
                          <div key={contract.id} className="relative">
                            {contract.bundleRole && (
                              <Badge 
                                variant="outline" 
                                className={`absolute -top-2 right-2 text-xs z-10 ${getRoleBadgeColor(contract.bundleRole)}`}
                              >
                                {contract.bundleRole}
                              </Badge>
                            )}
                            <UserContractCard contract={contract} compact onDelete={handleDeleteContract} />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Standalone Hook Contracts */}
                {standaloneHookContracts.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {standaloneHookContracts.map((contract) => (
                      <UserContractCard key={contract.id} contract={contract} onDelete={handleDeleteContract} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && closeDeleteDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteDialog.type === "bundle" ? "Contract Bundle" : "Contract"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteDialog.name}</strong> from your list?
              <br /><br />
              This only removes it from your dashboard. The contract{deleteDialog.type === "bundle" ? "s remain" : " remains"} deployed on the blockchain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
