import WebSocket from 'ws';
import { 
  ServerSession, 
  WebSocketMessage, 
  AudioStreamMessage,
  SessionStartMessage,
  SessionEndMessage,
  isAudioStreamMessage,
  isSessionStartMessage,
  isSessionEndMessage,
  generateSessionId
} from './shared';

export class WebSocketManager {
  private wss: WebSocket.Server;
  private sessions: Map<string, ServerSession> = new Map();
  private clientConnections: Set<WebSocket> = new Set();

  constructor(port: number) {
    this.wss = new WebSocket.Server({ port });
    this.setupWebSocketServer();
    console.log(`WebSocket server started on port ${port}`);
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('New WebSocket connection established');
      this.clientConnections.add(ws);

      ws.on('message', (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed');
        this.clientConnections.delete(ws);
        this.cleanupSessionsForConnection(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clientConnections.delete(ws);
      });

      // Send current active sessions to new client
      this.sendActiveSessions(ws);
    });
  }

  private handleMessage(ws: WebSocket, message: WebSocketMessage): void {
    if (isSessionStartMessage(message)) {
      this.handleSessionStart(ws, message);
    } else if (isSessionEndMessage(message)) {
      this.handleSessionEnd(ws, message);
    } else if (isAudioStreamMessage(message)) {
      this.handleAudioStream(ws, message);
    } else {
      console.warn('Unknown message type:', message.type);
    }
  }

  private handleSessionStart(ws: WebSocket, message: SessionStartMessage): void {
    const { tabId, tabTitle, sessionId } = message.data;
    
    const session: ServerSession = {
      id: sessionId,
      tabId,
      tabTitle,
      websocket: ws,
      isActive: true,
      startTime: Date.now(),
      lastActivity: Date.now()
    };

    this.sessions.set(sessionId, session);
    console.log(`Session started: ${sessionId} for tab: ${tabTitle}`);

    // Broadcast session start to all clients
    this.broadcastToClients({
      type: 'session-start',
      data: { tabId, tabTitle, sessionId },
      timestamp: Date.now()
    });
  }

  private handleSessionEnd(ws: WebSocket, message: SessionEndMessage): void {
    const { sessionId } = message.data;
    const session = this.sessions.get(sessionId);

    if (session) {
      session.isActive = false;
      this.sessions.delete(sessionId);
      console.log(`Session ended: ${sessionId}`);

      // Broadcast session end to all clients
      this.broadcastToClients({
        type: 'session-end',
        data: { sessionId },
        timestamp: Date.now()
      });
    }
  }

  private handleAudioStream(ws: WebSocket, message: AudioStreamMessage): void {
    const { sessionId } = message.data;
    const session = this.sessions.get(sessionId);

    if (session && session.isActive) {
      session.lastActivity = Date.now();
      
      // Broadcast audio data to all connected clients except the sender
      this.broadcastToClients(message, ws);
    }
  }

  private broadcastToClients(message: WebSocketMessage, exclude?: WebSocket): void {
    const messageStr = JSON.stringify(message);
    
    this.clientConnections.forEach(client => {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  private sendActiveSessions(ws: WebSocket): void {
    const activeSessions = Array.from(this.sessions.values())
      .filter(session => session.isActive)
      .map(session => ({
        id: session.id,
        tabId: session.tabId,
        tabTitle: session.tabTitle,
        startTime: session.startTime
      }));

    const message = {
      type: 'active-sessions',
      data: { sessions: activeSessions },
      timestamp: Date.now()
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, message: string): void {
    const errorMessage = {
      type: 'error',
      data: { message },
      timestamp: Date.now()
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(errorMessage));
    }
  }

  private cleanupSessionsForConnection(ws: WebSocket): void {
    // Find and cleanup sessions associated with this connection
    const sessionsToCleanup: string[] = [];
    
    this.sessions.forEach((session, sessionId) => {
      if (session.websocket === ws) {
        sessionsToCleanup.push(sessionId);
      }
    });

    sessionsToCleanup.forEach(sessionId => {
      this.sessions.delete(sessionId);
      this.broadcastToClients({
        type: 'session-end',
        data: { sessionId },
        timestamp: Date.now()
      });
    });
  }

  public getActiveSessions(): ServerSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  public getSessionCount(): number {
    return this.sessions.size;
  }
}