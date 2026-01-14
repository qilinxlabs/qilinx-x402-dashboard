"use client";

import { Canvas } from "@/components/ai-elements/canvas";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Node as FlowNode, Edge as FlowEdge, NodeTypes, EdgeTypes, EdgeProps, InternalNode, Node } from "@xyflow/react";
import { Handle, Position, BaseEdge, getBezierPath, useInternalNode, ReactFlowProvider } from "@xyflow/react";
import { 
  Wallet,
  FileSignature,
  Router,
  Webhook,
  ImageIcon,
  Gift,
  ArrowRightLeft,
  DollarSign,
  User,
} from "lucide-react";

// Node data interface
interface FlowNodeData {
  label: string;
  iconType: string;
  color: string;
  handles: { target: boolean; source: boolean };
  [key: string]: unknown;
}

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  wallet: Wallet,
  signature: FileSignature,
  router: Router,
  webhook: Webhook,
  image: ImageIcon,
  gift: Gift,
  transfer: ArrowRightLeft,
  dollar: DollarSign,
  user: User,
};

// Helper to get handle coordinates
const getHandleCoordsByPosition = (
  node: InternalNode<Node>,
  handlePosition: Position
) => {
  const handleType = handlePosition === Position.Left ? "target" : "source";
  const handle = node.internals.handleBounds?.[handleType]?.find(
    (h) => h.position === handlePosition
  );

  if (!handle) {
    return [0, 0] as const;
  }

  let offsetX = handle.width / 2;
  let offsetY = handle.height / 2;

  switch (handlePosition) {
    case Position.Left:
      offsetX = 0;
      break;
    case Position.Right:
      offsetX = handle.width;
      break;
    default:
      break;
  }

  const x = node.internals.positionAbsolute.x + handle.x + offsetX;
  const y = node.internals.positionAbsolute.y + handle.y + offsetY;

  return [x, y] as const;
};

// Animated edge with flowing dot
function AnimatedEdge({ id, source, target, style }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!(sourceNode && targetNode)) {
    return null;
  }

  const [sx, sy] = getHandleCoordsByPosition(sourceNode, Position.Right);
  const [tx, ty] = getHandleCoordsByPosition(targetNode, Position.Left);

  const [edgePath] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: Position.Right,
    targetX: tx,
    targetY: ty,
    targetPosition: Position.Left,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      <circle fill="var(--primary)" r="3">
        <animateMotion dur="1.5s" path={edgePath} repeatCount="indefinite" />
      </circle>
    </>
  );
}

// Flow node component
function FlowNode({ data }: { data: FlowNodeData }) {
  const { label, iconType, color, handles } = data;
  const Icon = iconMap[iconType];
  
  return (
    <div 
      className="flex flex-col items-center justify-center size-full rounded-lg border-2 bg-background shadow-sm px-2 py-1"
      style={{ borderColor: color }}
    >
      {handles.target && <Handle position={Position.Left} type="target" style={{ background: color }} />}
      {handles.source && <Handle position={Position.Right} type="source" style={{ background: color }} />}
      
      <div className="rounded-full p-1.5" style={{ backgroundColor: `${color}20` }}>
        <span style={{ color }}>{Icon && <Icon className="size-4" />}</span>
      </div>
      <span className="text-[9px] font-medium text-center mt-0.5 leading-tight">{label}</span>
    </div>
  );
}

// Large flow node for modal
function LargeFlowNode({ data }: { data: FlowNodeData }) {
  const { label, iconType, color, handles } = data;
  const Icon = iconMap[iconType];
  
  return (
    <div 
      className="flex flex-col items-center justify-center size-full rounded-xl border-2 bg-background shadow-md px-4 py-3"
      style={{ borderColor: color }}
    >
      {handles.target && <Handle position={Position.Left} type="target" style={{ background: color, width: 10, height: 10 }} />}
      {handles.source && <Handle position={Position.Right} type="source" style={{ background: color, width: 10, height: 10 }} />}
      
      <div className="rounded-full p-3" style={{ backgroundColor: `${color}20` }}>
        <span style={{ color }}>{Icon && <Icon className="size-8" />}</span>
      </div>
      <span className="text-sm font-semibold text-center mt-2">{label}</span>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  flow: FlowNode,
};

const largeNodeTypes: NodeTypes = {
  flow: LargeFlowNode,
};

const edgeTypes: EdgeTypes = {
  animated: AnimatedEdge,
};

// ============================================================================
// Flow Configurations
// ============================================================================

// Small nodes for card view
const createSmallNodes = (type: FlowType): FlowNode[] => {
  const configs: Record<FlowType, Array<{ id: string; label: string; iconType: string; color: string; target: boolean; source: boolean }>> = {
    "nft-mint": [
      { id: "user", label: "User", iconType: "user", color: "#3b82f6", target: false, source: true },
      { id: "sign", label: "Sign USDC", iconType: "signature", color: "#8b5cf6", target: true, source: true },
      { id: "router", label: "Router", iconType: "router", color: "#f97316", target: true, source: true },
      { id: "hook", label: "NFT Hook", iconType: "webhook", color: "#ec4899", target: true, source: true },
      { id: "nft", label: "Mint NFT", iconType: "image", color: "#10b981", target: true, source: false },
    ],
    "reward-points": [
      { id: "user", label: "User", iconType: "user", color: "#3b82f6", target: false, source: true },
      { id: "sign", label: "Sign USDC", iconType: "signature", color: "#8b5cf6", target: true, source: true },
      { id: "router", label: "Router", iconType: "router", color: "#f97316", target: true, source: true },
      { id: "hook", label: "Reward Hook", iconType: "webhook", color: "#eab308", target: true, source: true },
      { id: "reward", label: "Get Points", iconType: "gift", color: "#10b981", target: true, source: false },
    ],
    "transfer": [
      { id: "user", label: "User", iconType: "user", color: "#3b82f6", target: false, source: true },
      { id: "sign", label: "Sign USDC", iconType: "signature", color: "#8b5cf6", target: true, source: true },
      { id: "router", label: "Router", iconType: "router", color: "#f97316", target: true, source: true },
      { id: "hook", label: "Transfer Hook", iconType: "transfer", color: "#06b6d4", target: true, source: true },
      { id: "split", label: "Split Pay", iconType: "dollar", color: "#10b981", target: true, source: false },
    ],
    "router": [
      { id: "payer", label: "Payer", iconType: "wallet", color: "#3b82f6", target: false, source: true },
      { id: "sign", label: "EIP-3009", iconType: "signature", color: "#8b5cf6", target: true, source: true },
      { id: "router", label: "Router", iconType: "router", color: "#f97316", target: true, source: true },
      { id: "hook", label: "Any Hook", iconType: "webhook", color: "#ec4899", target: true, source: true },
      { id: "merchant", label: "Merchant", iconType: "dollar", color: "#10b981", target: true, source: false },
    ],
  };

  return configs[type].map((node, i) => ({
    id: node.id,
    type: "flow",
    position: { x: i * 90, y: 20 },
    data: { label: node.label, iconType: node.iconType, color: node.color, handles: { target: node.target, source: node.source } },
    style: { width: 70, height: 55 },
  }));
};

// Large nodes for modal view
const createLargeNodes = (type: FlowType): FlowNode[] => {
  const configs: Record<FlowType, Array<{ id: string; label: string; iconType: string; color: string; target: boolean; source: boolean }>> = {
    "nft-mint": [
      { id: "user", label: "User Wallet", iconType: "user", color: "#3b82f6", target: false, source: true },
      { id: "sign", label: "Sign USDC Authorization", iconType: "signature", color: "#8b5cf6", target: true, source: true },
      { id: "router", label: "Settlement Router", iconType: "router", color: "#f97316", target: true, source: true },
      { id: "hook", label: "NFT Mint Hook", iconType: "webhook", color: "#ec4899", target: true, source: true },
      { id: "nft", label: "Mint NFT to User", iconType: "image", color: "#10b981", target: true, source: false },
    ],
    "reward-points": [
      { id: "user", label: "User Wallet", iconType: "user", color: "#3b82f6", target: false, source: true },
      { id: "sign", label: "Sign USDC Authorization", iconType: "signature", color: "#8b5cf6", target: true, source: true },
      { id: "router", label: "Settlement Router", iconType: "router", color: "#f97316", target: true, source: true },
      { id: "hook", label: "Reward Points Hook", iconType: "webhook", color: "#eab308", target: true, source: true },
      { id: "reward", label: "Distribute X402RP", iconType: "gift", color: "#10b981", target: true, source: false },
    ],
    "transfer": [
      { id: "user", label: "User Wallet", iconType: "user", color: "#3b82f6", target: false, source: true },
      { id: "sign", label: "Sign USDC Authorization", iconType: "signature", color: "#8b5cf6", target: true, source: true },
      { id: "router", label: "Settlement Router", iconType: "router", color: "#f97316", target: true, source: true },
      { id: "hook", label: "Transfer Hook", iconType: "transfer", color: "#06b6d4", target: true, source: true },
      { id: "split", label: "Split to Recipients", iconType: "dollar", color: "#10b981", target: true, source: false },
    ],
    "router": [
      { id: "payer", label: "Payer Wallet", iconType: "wallet", color: "#3b82f6", target: false, source: true },
      { id: "sign", label: "EIP-3009 Signature", iconType: "signature", color: "#8b5cf6", target: true, source: true },
      { id: "router", label: "Settlement Router", iconType: "router", color: "#f97316", target: true, source: true },
      { id: "hook", label: "Business Logic Hook", iconType: "webhook", color: "#ec4899", target: true, source: true },
      { id: "merchant", label: "Merchant Receives", iconType: "dollar", color: "#10b981", target: true, source: false },
    ],
  };

  return configs[type].map((node, i) => ({
    id: node.id,
    type: "flow",
    position: { x: i * 180, y: 30 },
    data: { label: node.label, iconType: node.iconType, color: node.color, handles: { target: node.target, source: node.source } },
    style: { width: 140, height: 100 },
  }));
};

const createEdges = (type: FlowType): FlowEdge[] => {
  const edgeConfigs: Record<FlowType, Array<{ source: string; target: string }>> = {
    "nft-mint": [
      { source: "user", target: "sign" },
      { source: "sign", target: "router" },
      { source: "router", target: "hook" },
      { source: "hook", target: "nft" },
    ],
    "reward-points": [
      { source: "user", target: "sign" },
      { source: "sign", target: "router" },
      { source: "router", target: "hook" },
      { source: "hook", target: "reward" },
    ],
    "transfer": [
      { source: "user", target: "sign" },
      { source: "sign", target: "router" },
      { source: "router", target: "hook" },
      { source: "hook", target: "split" },
    ],
    "router": [
      { source: "payer", target: "sign" },
      { source: "sign", target: "router" },
      { source: "router", target: "hook" },
      { source: "hook", target: "merchant" },
    ],
  };

  return edgeConfigs[type].map((edge, i) => ({
    id: `e${i + 1}`,
    source: edge.source,
    target: edge.target,
    type: "animated",
  }));
};

// ============================================================================
// Modal Component (exported for use in template card)
// ============================================================================
type FlowType = "nft-mint" | "reward-points" | "transfer" | "router";

const flowTitles: Record<FlowType, string> = {
  "nft-mint": "NFT Mint Flow",
  "reward-points": "Reward Points Flow",
  "transfer": "Transfer/Split Payment Flow",
  "router": "Settlement Router Flow",
};

interface X402FlowModalProps {
  type: FlowType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function X402FlowModal({ type, open, onOpenChange }: X402FlowModalProps) {
  const largeNodes = createLargeNodes(type);
  const edges = createEdges(type);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{flowTitles[type]}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 w-full rounded-lg border bg-muted/20 overflow-hidden">
          <ReactFlowProvider>
            <Canvas
              edges={edges}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              nodes={largeNodes}
              nodeTypes={largeNodeTypes}
              nodesDraggable={false}
              nodesConnectable={false}
              panOnDrag={false}
              zoomOnScroll={false}
              zoomOnPinch={false}
              zoomOnDoubleClick={false}
              preventScrolling={false}
              proOptions={{ hideAttribution: true }}
            />
          </ReactFlowProvider>
        </div>
        <p className="text-sm text-muted-foreground text-center py-2">
          {type === "router" && "The Settlement Router is the core x402 protocol contract. Deploy once per network - all Hook contracts share this router."}
          {type === "nft-mint" && "User signs USDC authorization → Router verifies & transfers → NFT Hook mints NFT to user and sends USDC to merchant."}
          {type === "reward-points" && "User signs USDC authorization → Router verifies & transfers → Reward Hook distributes X402RP tokens based on payment amount."}
          {type === "transfer" && "User signs USDC authorization → Router verifies & transfers → Transfer Hook splits payment to multiple recipients by percentage."}
        </p>
      </DialogContent>
    </Dialog>
  );
}
