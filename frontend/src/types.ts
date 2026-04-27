// API Types
export interface DebateMessage {
  id: string
  agent: string
  content: string
  timestamp: string
  type: 'argument' | 'question' | 'response' | 'conclusion'
}

export interface DebateData {
  id: string
  query: string
  protocol: string
  status: 'running' | 'completed' | 'failed'
  messages: DebateMessage[]
  agents: string[]
  startedAt: string
  completedAt?: string
}

export interface DebateSummary {
  id: string
  query: string
  protocol: string
  status: 'completed' | 'failed' | 'running'
  agents: string[]
  messageCount: number
  startedAt: string
  completedAt?: string
  duration?: number
}

export interface CreateDebateRequest {
  query: string
  protocol: 'socratic' | 'adversarial' | 'red-team' | 'consensus'
}

// UI Types
export type ProtocolType = 'socratic' | 'adversarial' | 'red-team' | 'consensus'

export interface ProtocolInfo {
  id: ProtocolType
  name: string
  description: string
  icon: string
}