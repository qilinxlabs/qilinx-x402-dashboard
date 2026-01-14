"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Rocket, Workflow } from "lucide-react";
import type { ContractTemplate } from "@/lib/db/schema";
import { X402FlowModal } from "./x402-flow-canvas";

interface TemplateCardProps {
  template: ContractTemplate;
  onClick: () => void;
  selected?: boolean;
}

const categoryColors: Record<string, string> = {
  staking: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "dao-voting": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  payment: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "x402-settlement": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const categoryLabels: Record<string, string> = {
  staking: "Staking",
  "dao-voting": "DAO Voting",
  payment: "Payment",
  "x402-settlement": "x402 Settlement",
};

// Map template names to flow types
function getFlowType(templateName: string): "nft-mint" | "reward-points" | "transfer" | "router" | null {
  const name = templateName.toLowerCase();
  if (name.includes("settlement router")) return "router";
  if (name.includes("nft") && name.includes("mint")) return "nft-mint";
  if (name.includes("reward") && name.includes("point")) return "reward-points";
  if (name.includes("transfer") || name.includes("split")) return "transfer";
  return null;
}

export function TemplateCard({ template, onClick, selected }: TemplateCardProps) {
  const [showWorkflow, setShowWorkflow] = useState(false);
  const flowType = template.category === "x402-settlement" ? getFlowType(template.name) : null;
  const isX402 = template.category === "x402-settlement";
  
  // For x402 contracts, don't make the whole card clickable
  if (isX402) {
    return (
      <>
        <Card className={`transition-all hover:shadow-md ${selected ? "ring-2 ring-primary" : ""}`}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg">{template.name}</CardTitle>
              <Badge className={categoryColors[template.category]}>
                {categoryLabels[template.category]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="line-clamp-2">{template.description}</CardDescription>
          </CardContent>
          <CardFooter className="pt-0 gap-2">
            {flowType && (
              <Button variant="outline" size="sm" onClick={() => setShowWorkflow(true)}>
                <Workflow className="h-4 w-4 mr-2" />
                View Workflow
              </Button>
            )}
            <Button onClick={onClick} size="sm" className="flex-1">
              <Rocket className="h-4 w-4 mr-2" />
              Deploy
            </Button>
          </CardFooter>
        </Card>
        
        {flowType && (
          <X402FlowModal 
            type={flowType} 
            open={showWorkflow} 
            onOpenChange={setShowWorkflow} 
          />
        )}
      </>
    );
  }
  
  // For non-x402 contracts, keep the original clickable card behavior
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${selected ? "ring-2 ring-primary" : ""}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{template.name}</CardTitle>
          <Badge className={categoryColors[template.category] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"}>
            {categoryLabels[template.category] || template.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <CardDescription className="line-clamp-2">{template.description}</CardDescription>
      </CardContent>
    </Card>
  );
}
