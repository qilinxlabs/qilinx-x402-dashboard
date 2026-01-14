import { auth } from "@/app/(auth)/auth";
import { getDappsByUser, createDapp, validateConfig } from "@/lib/dapps/dapp-service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dapps = await getDappsByUser(session.user.id);
    return Response.json(dapps);
  } catch (error) {
    console.error("Failed to fetch DApps:", error);
    return Response.json({ error: "Failed to fetch DApps" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { contractId, templateId, name, description, uiConfig } = body;

    if (!contractId || !name || !uiConfig) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const validation = validateConfig(uiConfig);
    if (!validation.valid) {
      return Response.json({ error: "Invalid config", details: validation.errors }, { status: 400 });
    }

    const dapp = await createDapp({
      userId: session.user.id,
      contractId,
      templateId,
      name,
      description,
      uiConfig,
    });

    return Response.json(dapp);
  } catch (error) {
    console.error("Failed to create DApp:", error);
    return Response.json({ error: "Failed to create DApp" }, { status: 500 });
  }
}
