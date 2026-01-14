import { auth } from "@/app/(auth)/auth";
import { getDappById, updateDapp, deleteDapp, validateConfig } from "@/lib/dapps/dapp-service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const result = await getDappById(id);
    
    if (!result) {
      return Response.json({ error: "DApp not found" }, { status: 404 });
    }

    if (result.dapp.userId !== session.user.id) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }

    return Response.json(result);
  } catch (error) {
    console.error("Failed to fetch DApp:", error);
    return Response.json({ error: "Failed to fetch DApp" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, uiConfig, isPublished } = body;

    if (uiConfig) {
      const validation = validateConfig(uiConfig);
      if (!validation.valid) {
        return Response.json({ error: "Invalid config", details: validation.errors }, { status: 400 });
      }
    }

    const dapp = await updateDapp(id, session.user.id, { name, description, uiConfig, isPublished });
    
    if (!dapp) {
      return Response.json({ error: "DApp not found or not authorized" }, { status: 404 });
    }

    return Response.json(dapp);
  } catch (error) {
    console.error("Failed to update DApp:", error);
    return Response.json({ error: "Failed to update DApp" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const deleted = await deleteDapp(id, session.user.id);
    
    if (!deleted) {
      return Response.json({ error: "DApp not found or not authorized" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to delete DApp:", error);
    return Response.json({ error: "Failed to delete DApp" }, { status: 500 });
  }
}
