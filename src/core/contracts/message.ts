export type AgentId = string & { readonly __brand: "AgentId" };
export type SessionId = string & { readonly __brand: "SessionId" };
export type MessageId = string & { readonly __brand: "MessageId" };

export type AgentRole = "builder" | "critic" | "skeptic" | "scientist" | "verifier" | "judge";
export type MessageType = "request" | "response" | "proposal" | "rejection" | "evidence" | "question" | "challenge" | "synthesis";
export type MessageStatus = "pending" | "delivered" | "processed" | "failed";

export interface A2AMessage {
  id: MessageId;
  sessionId: SessionId;
  sender: AgentId;
  recipient: AgentId;
  type: MessageType;
  role: AgentRole;
  content: string;
  metadata: MessageMetadata;
  references: MessageId[];
  timestamp: number;
  ttl: number;
  status: MessageStatus;
}

export interface MessageMetadata {
  correlationId?: string;
  inReplyTo?: MessageId;
  round: number;
  depth: number;
  priority: "low" | "normal" | "high" | "critical";
  cost?: number;
  tokens?: number;
  model?: string;
}

export interface A2AEnvelope {
  message: A2AMessage;
  signature?: string;
  encryption?: "none" | "aes-256-gcm";
}

export function createMessage(
  sender: AgentId,
  recipient: AgentId,
  type: MessageType,
  content: string,
  role: AgentRole,
  sessionId: SessionId,
  options?: Partial<Pick<A2AMessage, "references" | "ttl" | "metadata">>
): A2AMessage {
  const id = crypto.randomUUID() as MessageId;
  return {
    id,
    sessionId,
    sender,
    recipient,
    type,
    role,
    content,
    metadata: {
      round: 1,
      depth: 0,
      priority: "normal",
      ...options?.metadata,
    },
    references: options?.references ?? [],
    timestamp: Date.now(),
    ttl: options?.ttl ?? 300000,
    status: "pending",
  };
}