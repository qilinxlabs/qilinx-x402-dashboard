import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDappBySlug } from "@/lib/dapps/dapp-service";
import { DappRenderer } from "@/components/dapps/templates/dapp-renderer";
import type { DappUiConfig, EthereumNetwork } from "@/lib/db/schema";
import { Loader2 } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function DappContent({ slug }: { slug: string }) {
  const result = await getDappBySlug(slug);

  if (!result || !result.dapp.isPublished) {
    notFound();
  }

  const { dapp, contract } = result;

  return (
    <DappRenderer
      config={dapp.uiConfig as DappUiConfig}
      contract={{
        address: contract.contractAddress,
        abi: contract.abi as object[],
        network: contract.network as EthereumNetwork,
      }}
    />
  );
}

export default async function PublicDappPage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <DappContent slug={slug} />
    </Suspense>
  );
}
