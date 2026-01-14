import { getDappTemplates, getDappTemplateByCategory } from "@/lib/dapps/dapp-service";
import type { ContractCategory } from "@/lib/db/schema";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as ContractCategory | null;

    if (category) {
      const template = await getDappTemplateByCategory(category);
      return Response.json(template);
    }

    const templates = await getDappTemplates();
    return Response.json(templates);
  } catch (error) {
    console.error("Failed to fetch DApp templates:", error);
    return Response.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}
