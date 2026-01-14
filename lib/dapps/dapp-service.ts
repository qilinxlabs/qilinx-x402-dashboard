import { db } from "@/lib/db";
import { dappTemplate, userDapp, userContract, type DappUiConfig, type ContractCategory } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export interface CreateDappInput {
  userId: string;
  contractId: string;
  templateId?: string;
  name: string;
  description?: string;
  uiConfig: DappUiConfig;
}

export interface UpdateDappInput {
  name?: string;
  description?: string;
  uiConfig?: DappUiConfig;
  isPublished?: boolean;
}

// Generate URL-safe slug from name
export function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
  
  // Add random suffix for uniqueness
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${base}-${suffix}`;
}

// Validate DappUiConfig
export function validateConfig(config: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config || typeof config !== "object") {
    return { valid: false, errors: ["Config must be an object"] };
  }
  
  const c = config as Record<string, unknown>;
  
  const validTemplateTypes = [
    "staking", 
    "dao-voting", 
    "payment",
    "x402-nft-mint",
    "x402-reward-points",
    "x402-split-payment"
  ];
  
  if (!validTemplateTypes.includes(c.templateType as string)) {
    errors.push(`Invalid templateType: ${c.templateType}`);
  }
  
  if (!c.theme || typeof c.theme !== "object") {
    errors.push("Missing theme configuration");
  }
  
  if (!c.branding || typeof c.branding !== "object") {
    errors.push("Missing branding configuration");
  }
  
  if (!c.features || typeof c.features !== "object") {
    errors.push("Missing features configuration");
  }
  
  return { valid: errors.length === 0, errors };
}

// Get all DApp templates
export async function getDappTemplates() {
  return db.select().from(dappTemplate).orderBy(dappTemplate.name);
}

// Get DApp template by category
export async function getDappTemplateByCategory(category: ContractCategory) {
  const [template] = await db
    .select()
    .from(dappTemplate)
    .where(eq(dappTemplate.category, category))
    .limit(1);
  return template || null;
}

// Get DApp template by ID
export async function getDappTemplateById(id: string) {
  const [template] = await db
    .select()
    .from(dappTemplate)
    .where(eq(dappTemplate.id, id))
    .limit(1);
  return template || null;
}

// Create a new DApp
export async function createDapp(input: CreateDappInput) {
  const slug = generateSlug(input.name);
  
  const [dapp] = await db
    .insert(userDapp)
    .values({
      userId: input.userId,
      contractId: input.contractId,
      templateId: input.templateId || null,
      name: input.name,
      slug,
      description: input.description || null,
      uiConfig: input.uiConfig,
      isPublished: false,
    })
    .returning();
  
  return dapp;
}

// Get all DApps for a user
export async function getDappsByUser(userId: string) {
  return db
    .select({
      dapp: userDapp,
      contract: userContract,
    })
    .from(userDapp)
    .innerJoin(userContract, eq(userDapp.contractId, userContract.id))
    .where(eq(userDapp.userId, userId))
    .orderBy(desc(userDapp.createdAt));
}

// Get DApp by ID
export async function getDappById(id: string) {
  const [result] = await db
    .select({
      dapp: userDapp,
      contract: userContract,
    })
    .from(userDapp)
    .innerJoin(userContract, eq(userDapp.contractId, userContract.id))
    .where(eq(userDapp.id, id))
    .limit(1);
  
  return result || null;
}

// Get DApp by slug (for public page)
export async function getDappBySlug(slug: string) {
  const [result] = await db
    .select({
      dapp: userDapp,
      contract: userContract,
    })
    .from(userDapp)
    .innerJoin(userContract, eq(userDapp.contractId, userContract.id))
    .where(eq(userDapp.slug, slug))
    .limit(1);
  
  return result || null;
}

// Update DApp
export async function updateDapp(id: string, userId: string, input: UpdateDappInput) {
  const [dapp] = await db
    .update(userDapp)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(and(eq(userDapp.id, id), eq(userDapp.userId, userId)))
    .returning();
  
  return dapp || null;
}

// Delete DApp
export async function deleteDapp(id: string, userId: string) {
  const [deleted] = await db
    .delete(userDapp)
    .where(and(eq(userDapp.id, id), eq(userDapp.userId, userId)))
    .returning();
  
  return !!deleted;
}

// Publish DApp
export async function publishDapp(id: string, userId: string) {
  return updateDapp(id, userId, { isPublished: true });
}

// Unpublish DApp
export async function unpublishDapp(id: string, userId: string) {
  return updateDapp(id, userId, { isPublished: false });
}
