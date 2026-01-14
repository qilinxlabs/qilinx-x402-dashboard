// API route for compiling Solidity code
// Task 7.3: Compile API route

import { compileSolidity } from "@/lib/contracts/compiler-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sourceCode, contractName } = body;

    if (!sourceCode || !contractName) {
      return Response.json(
        { success: false, errors: ["Missing sourceCode or contractName"] },
        { status: 400 }
      );
    }

    const result = compileSolidity(sourceCode, contractName);
    return Response.json(result);
  } catch (error) {
    console.error("Compilation error:", error);
    return Response.json(
      { success: false, errors: ["Server error during compilation"] },
      { status: 500 }
    );
  }
}
