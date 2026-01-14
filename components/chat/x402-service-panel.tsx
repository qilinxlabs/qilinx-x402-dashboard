"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Zap,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useX402Services, type X402Service } from "@/hooks/use-x402-services";
import { cn } from "@/lib/utils";

interface X402ServicePanelProps {
  className?: string;
  onExecuteService?: (service: X402Service) => void;
}

export function X402ServicePanel({ className, onExecuteService }: X402ServicePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { services, isLoading, error, configured, refetch } = useX402Services();

  const handleExecute = (service: X402Service) => {
    if (onExecuteService) {
      onExecuteService(service);
      // Collapse the panel after clicking
      setIsOpen(false);
    }
  };

  if (!configured) {
    return null;
  }

  return (
    <div className={cn("border-t", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between rounded-none h-10 px-4"
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-medium">X402 Services</span>
              {services.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {services.length}
                </Badge>
              )}
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Discovering services...
                </span>
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetch()}
                  className="ml-auto"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              </div>
            )}

            {/* Services List */}
            {!isLoading && services.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground mb-2">
                  Click a service to execute it via chat
                </div>
                {services.map((service) => (
                  <Card key={service.id} className="overflow-hidden">
                    <CardHeader className="p-3 pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm">{service.title}</CardTitle>
                          {service.description && (
                            <CardDescription className="text-xs mt-0.5">
                              {service.description}
                            </CardDescription>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs shrink-0",
                            service.hookType === "nft-mint" &&
                              "border-purple-500 text-purple-600",
                            service.hookType === "reward-points" &&
                              "border-green-500 text-green-600",
                            service.hookType === "transfer-split" &&
                              "border-blue-500 text-blue-600"
                          )}
                        >
                          {service.hookType}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          {service.defaults?.paymentAmount || "0.1"} USDC
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleExecute(service)}
                        >
                          <Zap className="h-3 w-3 mr-1" />
                          Execute
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* No Services */}
            {!isLoading && !error && services.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No X402 services available
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
