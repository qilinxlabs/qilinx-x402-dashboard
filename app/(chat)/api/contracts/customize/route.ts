// API route for AI-assisted contract customization
// Task 7.4: Customize API route with streaming

import { streamText } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { getTemplateById } from "@/lib/contracts/template-service";
import type { EthereumNetwork, ConstructorParam } from "@/lib/db/schema";

const SYSTEM_PROMPT = `You are an expert Solidity smart contract developer.

Your role is to help users understand and customize smart contract templates for their specific needs.

When analyzing a contract, you MUST:
1. Read and analyze the actual Solidity source code provided
2. Identify the token being used by examining variable names, comments, and contract names in the code
3. Determine the token decimals from the code comments or standard practices
4. Explain the contract's functionality based solely on what you see in the code

When explaining the contract, analyze the actual Solidity code to describe:
- What the contract does (based on the code, not assumptions)
- The token it integrates with (read from the code)
- Key functions and their purposes
- State variables and their roles
- Events emitted
- Access control mechanisms

When helping users customize:
1. Ask clarifying questions about their requirements
2. Explain what each customization option does
3. Generate the final customized Solidity code when ready

Important guidelines:
- Always use SafeERC20 for token transfers
- Include proper access control (Ownable)
- Add reentrancy protection where needed
- Keep gas efficiency in mind
- Add clear comments explaining the code

When the user is ready to deploy, output the complete Solidity contract code in a code block with the contract name clearly indicated.`;

function buildTemplateContext(
  templateName: string,
  templateDescription: string,
  sourceCode: string,
  constructorParams: ConstructorParam[] | null,
  network: EthereumNetwork
): string {
  const paramsInfo = constructorParams
    ? constructorParams.map(p => `- ${p.name} (${p.type}): ${p.description}${p.defaultValue ? ` [default: ${p.defaultValue}]` : ""}`).join("\n")
    : "No constructor parameters";

  return `
## Selected Template: ${templateName}
${templateDescription}

## Target Network: ${network}

## Constructor Parameters:
${paramsInfo}

## Contract Source Code:
Analyze this code to understand what the contract does, what token it uses, and how it works:

\`\`\`solidity
${sourceCode}
\`\`\`
`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { templateId, network, messages, modelId } = body;

    if (!templateId || !network || !messages) {
      return Response.json(
        { error: "Missing templateId, network, or messages" },
        { status: 400 }
      );
    }

    // Fetch template
    const template = await getTemplateById(templateId);
    if (!template) {
      return Response.json({ error: "Template not found" }, { status: 404 });
    }

    // Build context
    const templateContext = buildTemplateContext(
      template.name,
      template.description,
      template.soliditySourceCode,
      template.constructorParamsSchema,
      network as EthereumNetwork
    );

    const systemPrompt = `${SYSTEM_PROMPT}\n\n${templateContext}`;

    // Stream AI response - use provided model or default to gemini-3-pro-preview
    const selectedModel = modelId || "google/gemini-3-pro-preview";
    const result = streamText({
      model: getLanguageModel(selectedModel),
      system: systemPrompt,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Customization error:", error);
    return Response.json(
      { error: "Failed to process customization request" },
      { status: 500 }
    );
  }
}
