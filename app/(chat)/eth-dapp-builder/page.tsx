import { auth } from "@/app/(auth)/auth";
import { redirect } from "next/navigation";
import { DappBuilderClient } from "@/components/dapps/dapp-builder-client";

export default async function DappBuilderPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <DappBuilderClient />;
}
