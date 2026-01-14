import { auth } from "@/app/(auth)/auth";
import { redirect } from "next/navigation";
import { ManagePaymentsClient } from "@/components/manage-payments/manage-payments-client";

export default async function ManagePaymentsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <ManagePaymentsClient />;
}
