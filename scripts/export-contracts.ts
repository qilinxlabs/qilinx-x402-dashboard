import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { contractTemplate } from "../lib/db/schema";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

async function exportContracts() {
  if (!process.env.POSTGRES_URL) {
    console.error("POSTGRES_URL not found in environment");
    process.exit(1);
  }

  const client = postgres(process.env.POSTGRES_URL);
  const db = drizzle(client);

  console.log("Fetching x402 contract templates from database...");

  // Get all x402 settlement templates
  const templates = await db
    .select()
    .from(contractTemplate)
    .where(eq(contractTemplate.category, "x402-settlement"));

  console.log(`Found ${templates.length} x402 contract templates`);

  const contractsDir = path.join(process.cwd(), "contracts", "x402");
  
  // Create contracts/x402 directory if it doesn't exist
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  for (const template of templates) {
    console.log(`\nProcessing: ${template.name}`);
    
    // Create a subdirectory for each template
    const templateDir = path.join(contractsDir, template.name.replace(/\s+/g, "-"));
    if (!fs.existsSync(templateDir)) {
      fs.mkdirSync(templateDir, { recursive: true });
    }

    // Check if template has sourceFiles (multi-file bundle)
    if (template.sourceFiles && Array.isArray(template.sourceFiles)) {
      const sourceFiles = template.sourceFiles as Array<{
        filename: string;
        content: string;
        isMain: boolean;
        contractName: string;
      }>;

      for (const file of sourceFiles) {
        const filePath = path.join(templateDir, file.filename);
        // Unescape newlines in the content
        const content = file.content.replace(/\\n/g, "\n");
        fs.writeFileSync(filePath, content);
        console.log(`  - Saved: ${file.filename}${file.isMain ? " (main)" : ""}`);
      }
    } else if (template.soliditySourceCode) {
      // Single file contract
      const filename = `${template.name.replace(/\s+/g, "")}.sol`;
      const filePath = path.join(templateDir, filename);
      fs.writeFileSync(filePath, template.soliditySourceCode);
      console.log(`  - Saved: ${filename}`);
    }
  }

  console.log("\n✅ Export complete!");
  await client.end();
}

exportContracts().catch(console.error);
