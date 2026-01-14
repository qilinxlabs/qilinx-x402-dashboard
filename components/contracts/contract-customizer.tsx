"use client";

import { useState, useRef, useEffect, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeEditor } from "./code-editor";
import { DeployButton } from "./deploy-button";
import { Loader2, Send, X, Sparkles, AlertCircle, CheckCircle, CheckIcon, FileCode, ArrowRight } from "lucide-react";
import type { ContractTemplate, EthereumNetwork, SourceFile, DeploymentConfig } from "@/lib/db/schema";
import { getTokenAddress, getNetworkDisplayName } from "@/lib/contracts/network-config";
import type { DeploymentResult } from "@/lib/contracts/web3-service";
import { chatModels, modelsByProvider, DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Badge } from "@/components/ui/badge";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ContractCustomizerProps {
  template: ContractTemplate;
  network: EthereumNetwork;
  onClose: () => void;
  onDeploySuccess: (result: DeploymentResult, sourceCode: string, abi: object[]) => void;
}

// Check if template is multi-file
function isMultiFileTemplate(template: ContractTemplate): boolean {
  return !!(template.sourceFiles && template.sourceFiles.length > 0 && template.deploymentConfig);
}

export function ContractCustomizer({ template, network, onClose, onDeploySuccess }: ContractCustomizerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentCode, setCurrentCode] = useState(template.soliditySourceCode);
  const [compiledAbi, setCompiledAbi] = useState<object[] | null>(null);
  const [compiledBytecode, setCompiledBytecode] = useState<string | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_CHAT_MODEL);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Multi-file state
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [externalAddresses, setExternalAddresses] = useState<Record<string, string>>({});

  const isMultiFile = isMultiFileTemplate(template);
  const sourceFiles = template.sourceFiles || [];
  const deploymentConfig = template.deploymentConfig;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Clear compiled state when code changes
  const handleCodeChange = (newCode: string) => {
    setCurrentCode(newCode);
    setCompiledAbi(null);
    setCompiledBytecode(null);
    setCompileError(null);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/contracts/customize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id, network, messages: newMessages, modelId: selectedModelId }),
      });

      if (!res.ok) throw new Error("Failed to get response");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let assistantContent = "";

      setMessages([...newMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;
        setMessages([...newMessages, { role: "assistant", content: assistantContent }]);
      }

      // Extract code block if present and update the editor
      const codeMatch = assistantContent.match(/```solidity\n([\s\S]*?)```/);
      if (codeMatch) {
        handleCodeChange(codeMatch[1]);
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompile = async () => {
    setIsCompiling(true);
    setCompileError(null);
    setCompiledAbi(null);
    setCompiledBytecode(null);

    try {
      if (isMultiFile && sourceFiles.length > 0) {
        // Multi-file compilation
        const res = await fetch("/api/contracts/compile-multi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceFiles }),
        });

        const result = await res.json();
        if (result.success) {
          // Get the main contract's ABI and bytecode
          const mainFile = sourceFiles.find(f => f.isMain);
          if (mainFile && result.contracts[mainFile.filename]) {
            setCompiledAbi(result.contracts[mainFile.filename].abi);
            setCompiledBytecode(result.contracts[mainFile.filename].bytecode);
          }
        } else {
          setCompileError(result.errors?.join("\n") || "Compilation failed");
        }
      } else {
        // Single file compilation
        const nameMatch = currentCode.match(/contract\s+(\w+)/);
        const contractName = nameMatch?.[1] || "Contract";

        const res = await fetch("/api/contracts/compile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceCode: currentCode, contractName }),
        });

        const result = await res.json();
        if (result.success) {
          setCompiledAbi(result.abi);
          setCompiledBytecode(result.bytecode);
        } else {
          setCompileError(result.errors?.join("\n") || "Compilation failed");
        }
      }
    } catch (error) {
      setCompileError("Failed to compile contract");
    } finally {
      setIsCompiling(false);
    }
  };

  const handleDeploySuccess = (result: DeploymentResult) => {
    setDeployError(null);
    onDeploySuccess(result, currentCode, compiledAbi!);
  };

  // Get token address for constructor args
  const tokenAddress = getTokenAddress(network);
  
  // Build constructor args based on template type
  const constructorArgs = isMultiFile 
    ? buildMultiFileConstructorArgs(template, externalAddresses, tokenAddress)
    : template.constructorParamsSchema?.map(p => {
        if (p.name.toLowerCase().includes("token") && p.type === "address") {
          return tokenAddress;
        }
        return p.defaultValue || "";
      }) || [];

  // Get external address params for multi-file templates
  const externalParams = getExternalAddressParams(deploymentConfig ?? undefined);

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50">
      <div className="fixed inset-4 bg-background border rounded-lg shadow-lg flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{template.name}</h2>
              {isMultiFile && (
                <Badge variant="secondary" className="text-xs">
                  {sourceFiles.length} files
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Network: {getNetworkDisplayName(network)}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Chat Panel */}
          <div className="w-1/2 border-r flex flex-col">
            <div className="p-2 border-b">
              <ContractModelSelector
                selectedModelId={selectedModelId}
                onModelChange={setSelectedModelId}
              />
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-2" />
                  <p>Ask me about this contract or request customizations.</p>
                  <p className="text-sm mt-2">
                    For example: "What does this contract do?" or "Add a minimum stake amount"
                  </p>
                </div>
              )}
              {messages.map((msg, i) => (
                <Message key={i} from={msg.role === "user" ? "user" : "assistant"}>
                  <MessageContent>
                    {msg.role === "assistant" ? (
                      <MessageResponse>{msg.content}</MessageResponse>
                    ) : (
                      msg.content
                    )}
                  </MessageContent>
                </Message>
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about the contract or request changes..."
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  disabled={isLoading}
                />
                <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Code & Deploy Panel */}
          <div className="w-1/2 flex flex-col">
            <Tabs defaultValue="code" className="flex-1 flex flex-col">
              <TabsList className="mx-4 mt-4">
                <TabsTrigger value="code">Source Code</TabsTrigger>
                {isMultiFile && <TabsTrigger value="files">Files ({sourceFiles.length})</TabsTrigger>}
                <TabsTrigger value="deploy">Deploy</TabsTrigger>
              </TabsList>
              
              <TabsContent value="code" className="flex-1 overflow-hidden p-4">
                <CodeEditor 
                  code={isMultiFile && sourceFiles[selectedFileIndex] 
                    ? sourceFiles[selectedFileIndex].content 
                    : currentCode
                  } 
                  onChange={handleCodeChange}
                  originalCode={template.soliditySourceCode}
                  maxHeight="calc(100vh - 280px)" 
                />
              </TabsContent>
              
              {isMultiFile && (
                <TabsContent value="files" className="flex-1 overflow-auto p-4 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Contract Bundle</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {/* Deployment Order */}
                      {deploymentConfig && (
                        <div className="mb-4">
                          <p className="text-sm font-medium mb-2">Deployment Order:</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {deploymentConfig.deploymentOrder.map((filename, i) => {
                              const file = sourceFiles.find(f => f.filename === filename);
                              return (
                                <div key={filename} className="flex items-center gap-1">
                                  <Badge 
                                    variant={file?.isMain ? "default" : "outline"}
                                    className="cursor-pointer"
                                    onClick={() => {
                                      const idx = sourceFiles.findIndex(f => f.filename === filename);
                                      if (idx >= 0) setSelectedFileIndex(idx);
                                    }}
                                  >
                                    {i + 1}. {file?.contractName || filename}
                                  </Badge>
                                  {i < deploymentConfig.deploymentOrder.length - 1 && (
                                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* File List */}
                      <div className="space-y-2">
                        {sourceFiles.map((file, i) => (
                          <div 
                            key={file.filename}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted ${
                              selectedFileIndex === i ? "bg-muted" : ""
                            }`}
                            onClick={() => setSelectedFileIndex(i)}
                          >
                            <FileCode className="h-4 w-4" />
                            <span className="flex-1">{file.filename}</span>
                            {file.isMain && <Badge variant="secondary">Main</Badge>}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
              
              <TabsContent value="deploy" className="flex-1 overflow-auto p-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">1. Compile Contract</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button onClick={handleCompile} disabled={isCompiling} className="w-full">
                      {isCompiling ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Compiling...
                        </>
                      ) : (
                        isMultiFile ? "Compile All Files" : "Compile Solidity"
                      )}
                    </Button>
                    {compileError && (
                      <div className="text-sm text-destructive flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <pre className="whitespace-pre-wrap">{compileError}</pre>
                      </div>
                    )}
                    {compiledAbi && (
                      <div className="text-sm text-green-600 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Compiled successfully
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">2. Deploy to {getNetworkDisplayName(network)}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* External Address Inputs for Multi-file Templates */}
                    {isMultiFile && externalParams.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-sm font-medium">External Addresses:</p>
                        {externalParams.map(param => (
                          <div key={param.paramName} className="space-y-1">
                            <label className="text-sm text-muted-foreground">
                              {param.paramName}
                              {param.description && (
                                <span className="ml-1 text-xs">({param.description})</span>
                              )}
                            </label>
                            <Input
                              placeholder="0x..."
                              value={externalAddresses[param.paramName] || ""}
                              onChange={(e) => setExternalAddresses(prev => ({
                                ...prev,
                                [param.paramName]: e.target.value
                              }))}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Auto-filled Dependencies Info */}
                    {isMultiFile && deploymentConfig && (
                      <div className="text-sm space-y-1">
                        <p className="font-medium">Auto-filled from deployment:</p>
                        {Object.entries(deploymentConfig.dependencies).map(([filename, config]) => (
                          config.constructorParams
                            .filter(p => p.sourceContract)
                            .map(p => (
                              <div key={`${filename}-${p.paramName}`} className="text-muted-foreground">
                                {filename} → {p.paramName}: <span className="text-green-600">from {p.sourceContract}</span>
                              </div>
                            ))
                        ))}
                      </div>
                    )}
                    
                    {/* Single-file Constructor Args */}
                    {!isMultiFile && template.constructorParamsSchema && (
                      <div className="text-sm space-y-1">
                        <p className="font-medium">Constructor Arguments:</p>
                        {template.constructorParamsSchema.map((p, i) => (
                          <div key={p.name} className="text-muted-foreground">
                            {p.name}: <span className="font-mono">{String(constructorArgs[i])}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <DeployButton
                      abi={compiledAbi}
                      bytecode={compiledBytecode}
                      constructorArgs={constructorArgs}
                      targetNetwork={network}
                      onDeploySuccess={handleDeploySuccess}
                      onDeployError={setDeployError}
                      template={isMultiFile ? template : undefined}
                      userParams={isMultiFile ? externalAddresses : undefined}
                    />
                    {deployError && (
                      <div className="text-sm text-destructive flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        {deployError}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to get external address params from deployment config
function getExternalAddressParams(deploymentConfig?: DeploymentConfig) {
  if (!deploymentConfig) return [];
  
  const params: Array<{ paramName: string; description?: string }> = [];
  
  for (const config of Object.values(deploymentConfig.dependencies)) {
    for (const param of config.constructorParams) {
      if (param.externalAddress) {
        params.push({
          paramName: param.paramName,
          description: param.description,
        });
      }
    }
  }
  
  return params;
}

// Helper function to build constructor args for multi-file templates
function buildMultiFileConstructorArgs(
  template: ContractTemplate,
  externalAddresses: Record<string, string>,
  tokenAddress: string
): unknown[] {
  if (!template.deploymentConfig) return [];
  
  const mainFile = template.sourceFiles?.find(f => f.isMain);
  if (!mainFile) return [];
  
  const deps = template.deploymentConfig.dependencies[mainFile.filename];
  if (!deps) return [];
  
  return deps.constructorParams.map(param => {
    if (param.externalAddress) {
      return externalAddresses[param.paramName] || "";
    }
    if (param.paramName.toLowerCase().includes("token")) {
      return tokenAddress;
    }
    return "";
  });
}


// Model selector component

const providerNames: Record<string, string> = {
  google: "Google",
};

function PureContractModelSelector({
  selectedModelId,
  onModelChange,
}: {
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedModel = chatModels.find((m) => m.id === selectedModelId) || chatModels[0];
  const provider = selectedModel.id.split("/")[0];

  return (
    <ModelSelector onOpenChange={setOpen} open={open}>
      <ModelSelectorTrigger asChild>
        <Button className="h-8 w-full justify-between px-2" variant="ghost">
          {provider && <ModelSelectorLogo provider={provider} />}
          <ModelSelectorName>{selectedModel.name}</ModelSelectorName>
        </Button>
      </ModelSelectorTrigger>
      <ModelSelectorContent>
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList>
          {Object.entries(modelsByProvider).map(
            ([providerKey, providerModels]) => (
              <ModelSelectorGroup
                heading={providerNames[providerKey] ?? providerKey}
                key={providerKey}
              >
                {providerModels.map((model) => {
                  const logoProvider = model.id.split("/")[0];
                  return (
                    <ModelSelectorItem
                      key={model.id}
                      onSelect={() => {
                        onModelChange(model.id);
                        setOpen(false);
                      }}
                      value={model.id}
                    >
                      <ModelSelectorLogo provider={logoProvider} />
                      <ModelSelectorName>{model.name}</ModelSelectorName>
                      {model.id === selectedModel.id && (
                        <CheckIcon className="ml-auto size-4" />
                      )}
                    </ModelSelectorItem>
                  );
                })}
              </ModelSelectorGroup>
            )
          )}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
}

const ContractModelSelector = memo(PureContractModelSelector);
