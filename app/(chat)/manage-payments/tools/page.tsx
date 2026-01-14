import { auth } from "@/app/(auth)/auth";
import { redirect } from "next/navigation";
import { WalletToolsClient } from "@/components/manage-payments/wallet-tools-client";

export default async function WalletToolsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <WalletToolsClient />;
}
