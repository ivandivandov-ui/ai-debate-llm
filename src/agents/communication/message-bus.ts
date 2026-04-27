import type { AgentId, SessionId, MessageId, A2AMessage, MessageStatus } from "../../core/contracts/message";
import { A2AProtocol } from "./protocol";

export interface MessageDelivery {
  messageId: string;
  attempts: number;
  lastAttempt: number;
  status: "pending" | "delivered" | "failed";
  error?: string;
}

export class MessageBus {
  private protocol: A2AProtocol;
  private pending: Map<SessionId, Map<MessageStatus, A2AMessage[]>> = new Map();
  private delivery: Map<MessageId, MessageDelivery> = new Map();
  private subscribers: Map<AgentId, Set<(msg: A2AMessage) => void>> = new Map();

  constructor(protocol: A2AProtocol) {
    this.protocol = protocol;
  }

  subscribe(agentId: AgentId, handler: (msg: A2AMessage) => void): void {
    if (!this.subscribers.has(agentId)) {
      this.subscribers.set(agentId, new Set());
    }
    this.subscribers.get(agentId)!.add(handler);
  }

  unsubscribe(agentId: AgentId, handler: (msg: A2AMessage) => void): void {
    this.subscribers.get(agentId)?.delete(handler);
  }

  async send(message: A2AMessage): Promise<{ success: boolean; error?: string }> {
    const canSend = this.protocol.canSend(
      message.sessionId,
      message.sender,
      message.type
    );
    if (!canSend.allowed) {
      return { success: false, error: canSend.reason };
    }

    const canAccess = this.protocol.canAccess(
      message.sessionId,
      message.sender,
      message.recipient,
      message.role
    );
    if (!canAccess.allowed) {
      return { success: false, error: canAccess.reason };
    }

    const delivery: MessageDelivery = {
      messageId: message.id,
      attempts: 0,
      lastAttempt: Date.now(),
      status: "pending",
    };
    this.delivery.set(message.id, delivery);
    this.queueMessage(message);

    const handlers = this.subscribers.get(message.recipient);
    if (handlers) {
      for (const handler of handlers) {
        try {
          await handler(message);
        } catch (err) {
          delivery.status = "failed";
          delivery.error = err instanceof Error ? err.message : String(err);
          return { success: false, error: delivery.error };
        }
      }

      delivery.status = "delivered";
      message.status = "delivered";
      this.protocol.recordTurn(message.sessionId, message.sender);
    }

    return { success: true };
  }

  private queueMessage(message: A2AMessage): void {
    if (!this.pending.has(message.sessionId)) {
      this.pending.set(message.sessionId, new Map());
    }
    const sessionMessages = this.pending.get(message.sessionId)!;

    const status = message.status;
    if (!sessionMessages.has(status)) {
      sessionMessages.set(status, []);
    }
    sessionMessages.get(status)!.push(message);
  }

  getPending(sessionId: SessionId): A2AMessage[] {
    return this.pending.get(sessionId)?.get("pending") ?? [];
  }

  getDeliveryStatus(messageId: MessageId): MessageDelivery | undefined {
    return this.delivery.get(messageId);
  }

  acknowledge(messageId: MessageId): void {
    const msg = this.findMessage(messageId);
    if (msg) {
      msg.status = "processed";
      this.moveToStatus(msg, "processed");
    }
  }

  private findMessage(messageId: MessageId): A2AMessage | undefined {
    for (const sessionMessages of this.pending.values()) {
      for (const messages of sessionMessages.values()) {
        const found = messages.find((m) => m.id === messageId);
        if (found) return found;
      }
    }
    return undefined;
  }

  private moveToStatus(message: A2AMessage, newStatus: MessageStatus): void {
    const sessionMessages = this.pending.get(message.sessionId);
    if (!sessionMessages) return;

    const oldStatus = message.status;
    const oldQueue = sessionMessages.get(oldStatus);
    const newQueue = sessionMessages.get(newStatus);

    if (oldQueue && newQueue) {
      const idx = oldQueue.indexOf(message);
      if (idx >= 0) {
        oldQueue.splice(idx, 1);
        newQueue.push(message);
      }
    }
  }

  cleanup(sessionId: SessionId): void {
    this.pending.delete(sessionId);
    this.protocol.cleanup(sessionId);
  }
}