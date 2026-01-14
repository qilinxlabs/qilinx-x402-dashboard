import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { DeveloperAccountCard } from "@/components/developer-account-card";
import { ApiTokenCard } from "@/components/api-token-card";
import { MCPToolsCard } from "@/components/mcp-tools-card";
import { PageHeader } from "@/components/ui/page-header";
import { getUserById, getMCPToolsWithUserState } from "@/lib/db/queries";
import { ethers } from "ethers";

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Derive developer address from private key
  let developerAddress = "";
  try {
    const privateKey = process.env.CRONOS_DEVELOPER_PRIVATE_KEY;
    if (privateKey) {
      const wallet = new ethers.Wallet(privateKey);
      developerAddress = wallet.address;
    }
  } catch (error) {
    console.error("Failed to derive developer address:", error);
  }

  // Fetch user's API token
  let apiToken = null;
  try {
    const foundUser = await getUserById(session.user.id);
    apiToken = foundUser?.apiToken || null;
  } catch (error) {
    console.error("Failed to fetch API token:", error);
  }

  // Fetch MCP tools with user state
  let mcpTools: Array<{
    id: string;
    name: string;
    description: string | null;
    host: string;
    isEnabled: boolean;
  }> = [];
  try {
    mcpTools = await getMCPToolsWithUserState({ userId: session.user.id });
  } catch (error) {
    console.error("Failed to fetch MCP tools:", error);
  }

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-2xl">
      <PageHeader
        icon="user"
        title="Account"
        description="Manage your profile, developer account, API tokens, and connected tools."
      />

      <div className="space-y-6">
        {/* User Info Section */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Profile</h2>
          <div className="space-y-2">
            <div>
              <label className="text-sm text-muted-foreground">Email</label>
              <p className="font-medium" data-testid="user-email">
                {session.user.email}
              </p>
            </div>
          </div>
        </div>

        {/* Developer Account Section */}
        {developerAddress && <DeveloperAccountCard address={developerAddress} />}

        {/* API Token Section */}
        <ApiTokenCard apiToken={apiToken} />

        {/* MCP Tools Section */}
        <MCPToolsCard tools={mcpTools} />
      </div>
    </div>
  );
}
