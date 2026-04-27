import { logger } from "../../observability/logging";

export interface WebSocketMessage {
  type: string;
  payload: unknown;
}

export interface WSConnection {
  id: string;
  send(message: WebSocketMessage): void;
  close(): void;
}

export interface WSHandler {
  onConnection(conn: WSConnection): void;
  onMessage(conn: WSConnection, message: WebSocketMessage): void;
  onClose(conn: WSConnection): void;
}

export class WebSocketServer {
  private connections: Map<string, WSConnection> = new Map();
  private handler?: WSHandler;

  constructor(handler?: WSHandler) {
    this.handler = handler;
  }

  connect(id: string): WSConnection {
    const conn: WSConnection = {
      id,
      send: (message) => this.sendTo(id, message),
      close: () => this.disconnect(id),
    };

    this.connections.set(id, conn);
    this.handler?.onConnection(conn);

    return conn;
  }

  disconnect(id: string): void {
    const conn = this.connections.get(id);
    if (conn) {
      this.handler?.onClose(conn);
      this.connections.delete(id);
    }
  }

  private sendTo(id: string, message: WebSocketMessage): void {
    const conn = this.connections.get(id);
    if (conn) {
      logger.info(`WS [${id}]:`, { type: message.type });
    }
  }

  broadcast(message: WebSocketMessage, exclude?: string): void {
    for (const [id, conn] of this.connections) {
      if (id !== exclude) {
        conn.send(message);
      }
    }
  }

  getConnections(): WSConnection[] {
    return Array.from(this.connections.values());
  }
}

export function createWSServer(): WebSocketServer {
  const server = new WebSocketServer({
    onConnection: (conn) => logger.info(`Client connected: ${conn.id}`),
    onMessage: (conn, msg) => logger.info(`Message from ${conn.id}:`, { type: msg.type }),
    onClose: (conn) => logger.info(`Client disconnected: ${conn.id}`),
  });

  return server;
}