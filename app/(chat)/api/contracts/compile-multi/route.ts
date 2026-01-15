// API route for compiling multiple Solidity files
// Task 5.1: Multi-file compile API route

import { NextResponse } from "next/server";
import { compileMultiFileSolidity } from "@/lib/contracts/compiler-service";
import type { SourceFile } from "@/lib/db/schema";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sourceFiles } = body as { sourceFiles: SourceFile[] };

    if (!sourceFiles || !Array.isArray(sourceFiles) || sourceFiles.length === 0) {
      return NextResponse.json(
        { success: false, errors: ["Missing or invalid sourceFiles array"] },
        { status: 400 }
      );
    }

    // Validate source files structure
    for (const file of sourceFiles) {
      if (!file.filename || !file.content || !file.contractName) {
        return NextResponse.json(
          { success: false, errors: [`Invalid source file: ${file.filename || "unknown"}`] },
          { status: 400 }
        );
      }
    }

    const result = compileMultiFileSolidity(sourceFiles);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Multi-file compilation error:", error);
    return NextResponse.json(
      { success: false, errors: ["Server error during compilation"] },
      { status: 500 }
    );
  }
}
