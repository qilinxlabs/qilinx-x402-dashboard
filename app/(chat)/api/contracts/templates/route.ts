// API route for fetching contract templates
// Task 7.1: Templates API route

import { getTemplates, getTemplateById, getTemplatesByCategory } from "@/lib/contracts/template-service";
import type { ContractCategory } from "@/lib/db/schema";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const category = searchParams.get("category") as ContractCategory | null;

    if (id) {
      const template = await getTemplateById(id);
      if (!template) {
        return Response.json({ error: "Template not found" }, { status: 404 });
      }
      return Response.json({ template });
    }

    if (category) {
      const templates = await getTemplatesByCategory(category);
      return Response.json({ templates });
    }

    const templates = await getTemplates();
    return Response.json({ templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return Response.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}
