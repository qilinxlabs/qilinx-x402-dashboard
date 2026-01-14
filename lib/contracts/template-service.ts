// Template service for fetching contract templates from database
// Task 3.3: Template service

import { db } from "@/lib/db";
import { contractTemplate, type ContractCategory, type ContractTemplate, type DeploymentConfig, type SourceFile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getTemplates(): Promise<ContractTemplate[]> {
  return db.select().from(contractTemplate);
}

export async function getTemplateById(id: string): Promise<ContractTemplate | null> {
  const results = await db
    .select()
    .from(contractTemplate)
    .where(eq(contractTemplate.id, id));
  return results[0] ?? null;
}

export async function getTemplatesByCategory(category: ContractCategory): Promise<ContractTemplate[]> {
  return db
    .select()
    .from(contractTemplate)
    .where(eq(contractTemplate.category, category));
}

// ============================================================================
// Multi-file Template Support (x402)
// ============================================================================

/**
 * Validates that deployment dependencies reference valid source files
 * and that dependencies appear earlier in the deployment order
 */
export function validateDeploymentConfig(
  sourceFiles: SourceFile[],
  deploymentConfig: DeploymentConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const filenames = new Set(sourceFiles.map(f => f.filename));
  const deploymentOrder = deploymentConfig.deploymentOrder;
  
  // Check all files in deployment order exist
  for (const filename of deploymentOrder) {
    if (!filenames.has(filename)) {
      errors.push(`Deployment order references non-existent file: ${filename}`);
    }
  }
  
  // Check dependencies reference valid files and appear earlier in order
  for (const [filename, config] of Object.entries(deploymentConfig.dependencies)) {
    if (!filenames.has(filename)) {
      errors.push(`Dependencies reference non-existent file: ${filename}`);
      continue;
    }
    
    const fileIndex = deploymentOrder.indexOf(filename);
    
    for (const param of config.constructorParams) {
      if (param.sourceContract) {
        if (!filenames.has(param.sourceContract)) {
          errors.push(`Dependency ${param.paramName} references non-existent file: ${param.sourceContract}`);
        } else {
          const depIndex = deploymentOrder.indexOf(param.sourceContract);
          if (depIndex >= fileIndex) {
            errors.push(`Dependency ${param.paramName} references ${param.sourceContract} which is not deployed before ${filename}`);
          }
        }
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Resolves the deployment order for a multi-file template
 * Returns source files in the order they should be deployed
 */
export function resolveDeploymentOrder(
  sourceFiles: SourceFile[],
  deploymentConfig: DeploymentConfig
): SourceFile[] {
  const fileMap = new Map(sourceFiles.map(f => [f.filename, f]));
  const orderedFiles: SourceFile[] = [];
  
  for (const filename of deploymentConfig.deploymentOrder) {
    const file = fileMap.get(filename);
    if (file) {
      orderedFiles.push(file);
    }
  }
  
  return orderedFiles;
}

/**
 * Checks if a template is a multi-file template
 */
export function isMultiFileTemplate(template: ContractTemplate): boolean {
  return !!(template.sourceFiles && template.sourceFiles.length > 0 && template.deploymentConfig);
}

/**
 * Gets the main contract file from a multi-file template
 */
export function getMainContractFile(template: ContractTemplate): SourceFile | null {
  if (!template.sourceFiles) return null;
  return template.sourceFiles.find(f => f.isMain) ?? null;
}
