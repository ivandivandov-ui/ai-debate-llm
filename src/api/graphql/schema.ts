export interface TypeDef {
  type: "object" | "interface" | "scalar" | "enum" | "union" | "input";
  name: string;
  fields?: TypeDefField[];
  values?: string[];
  typeRefs?: string[];
}

export interface TypeDefField {
  name: string;
  type: string;
  optional?: boolean;
}

export const SCHEMA_DEFINITIONS: Record<string, TypeDef> = {
  DebateRequest: {
    type: "interface",
    name: "DebateRequest",
    fields: [
      { name: "id", type: "string" },
      { name: "query", type: "string" },
      { name: "context", type: "object", optional: true },
      { name: "metadata", type: "RequestMetadata", optional: true },
    ],
  },
  RequestMetadata: {
    type: "interface",
    name: "RequestMetadata",
    fields: [
      { name: "userId", type: "string", optional: true },
      { name: "sessionId", type: "string", optional: true },
      { name: "source", type: "string", optional: true },
    ],
  },
  DebateResult: {
    type: "interface",
    name: "DebateResult",
    fields: [
      { name: "id", type: "string" },
      { name: "requestId", type: "string" },
      { name: "query", type: "string" },
      { name: "finalAnswer", type: "string" },
      { name: "confidence", type: "float" },
      { name: "evidence", type: "Evidence[]" },
      { name: "reasoning", type: "ReasoningChain" },
      { name: "metrics", type: "ResultMetrics" },
    ],
  },
  A2AMessage: {
    type: "interface",
    name: "A2AMessage",
    fields: [
      { name: "id", type: "string" },
      { name: "sessionId", type: "string" },
      { name: "sender", type: "string" },
      { name: "recipient", type: "string" },
      { name: "type", type: "MessageType" },
      { name: "role", type: "string" },
      { name: "content", type: "string" },
      { name: "metadata", type: "MessageMetadata" },
      { name: "references", type: "string[]" },
      { name: "timestamp", type: "int" },
      { name: "status", type: "MessageStatus" },
    ],
  },
  MessageType: {
    type: "enum",
    name: "MessageType",
    values: ["request", "response", "proposal", "rejection", "evidence", "question", "challenge", "synthesis"],
  },
  MessageStatus: {
    type: "enum",
    name: "MessageStatus",
    values: ["pending", "delivered", "processed", "failed"],
  },
  AgentRole: {
    type: "enum",
    name: "AgentRole",
    values: ["builder", "critic", "skeptic", "scientist", "verifier"],
  },
  TaskType: {
    type: "enum",
    name: "TaskType",
    values: ["analyze", "build", "verify", "critique", "question", "synthesize", "research", "refine"],
  },
  PipelineStage: {
    type: "enum",
    name: "PipelineStage",
    values: ["input", "decompose", "dispatch", "collect", "verify", "decision", "fuse", "store", "output"],
  },
};

export function generateGraphQLSchema(): string {
  let schema = "type Query {\n  debate(id: ID!): DebateResult\n  debates(limit: Int): [DebateResult!]!\n  health: Health!\n}\n\n";
  schema += "type Mutation {\n  createDebate(input: DebateInput!): DebateResult!\n}\n\n";
  schema += "type Subscription {\n  debateProgress(id: ID!): DebateProgress!\n}\n\n";

  for (const [name, def] of Object.entries(SCHEMA_DEFINITIONS)) {
    if (def.type === "interface" && def.fields) {
      schema += `type ${name} {\n`;
      for (const field of def.fields) {
        const opt = field.optional ? "" : "!";
        schema += `  ${field.name}: ${field.type}${opt}\n`;
      }
      schema += "}\n\n";
    } else if (def.type === "enum" && def.values) {
      schema += `enum ${name} {\n`;
      for (const val of def.values) {
        schema += `  ${val}\n`;
      }
      schema += "}\n\n";
    }
  }

  return schema;
}