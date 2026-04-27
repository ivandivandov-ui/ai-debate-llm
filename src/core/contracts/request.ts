export interface DebateRequest {
  id: string;
  query: string;
  protocol?: string;
  context?: Record<string, unknown>;
  attachments?: Attachment[];
  metadata?: RequestMetadata;
  preferences?: RequestPreferences;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  data: string; // base64
  size: number;
}

export interface RequestMetadata {
  userId?: string;
  sessionId?: string;
  source?: "api" | "cli" | "webhook";
  priority?: "low" | "normal" | "high";
  language?: string;
}

export interface RequestPreferences {
  providers?: string[];
  maxTokens?: number;
  temperature?: number;
  budget?: number;
  timeout?: number;
  protocols?: string[];
  interactive?: boolean;
}