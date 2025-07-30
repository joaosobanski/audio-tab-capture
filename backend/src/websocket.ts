import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import type { AudioProcessor } from './audio/processor.js';
import type { 
  WebSocketMessage, 
  AudioSession, 
  ErrorMessage,
  ERROR_CODES,
  generateSessionId 
} from '@audio-tab-capture/shared';

interface ExtendedWebSocket extends WebSocket {
  sessionId?: string;
  isAlive?: boolean;
}

export function setupWebSocket(server: Server, audioProcessor: AudioProcessor): WebSocketServer {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws'
  });

  // Heartbeat to detect broken connections
  const heartbeat = (): void => {
    wss.clients.forEach((ws: ExtendedWebSocket) => {
      if (ws.isAlive === false) {
        ws.terminate();
        return;
      }
      
      ws.isAlive = false;
      ws.ping();
    });
  };

  const interval = setInterval(heartbeat, 30000);

  wss.on('connection', (ws: ExtendedWebSocket) => {
    console.log('WebSocket client connected');
    
    ws.isAlive = true;
    
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (data: Buffer) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString()) as WebSocketMessage;
        await handleMessage(ws, message, audioProcessor);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        sendError(ws, 'INVALID_MESSAGE', 'Invalid message format');
      }
    });

    ws.on('close', async () => {
      console.log('WebSocket client disconnected');
      if (ws.sessionId) {
        try {
          await audioProcessor.stopSession(ws.sessionId);
        } catch (error) {
          console.error('Error stopping session on disconnect:', error);
        }
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
}

async function handleMessage(
  ws: ExtendedWebSocket, 
  message: WebSocketMessage, 
  audioProcessor: AudioProcessor
): Promise<void> {
  try {
    switch (message.type) {
      case 'session_start':
        await handleSessionStart(ws, message, audioProcessor);
        break;
      
      case 'session_stop':
        await handleSessionStop(ws, message, audioProcessor);
        break;
      
      case 'session_pause':
        await handleSessionPause(ws, message, audioProcessor);
        break;
      
      case 'session_resume':
        await handleSessionResume(ws, message, audioProcessor);
        break;
      
      case 'audio_chunk':
        await handleAudioChunk(ws, message, audioProcessor);
        break;
      
      default:
        sendError(ws, 'INVALID_MESSAGE', `Unknown message type: ${(message as unknown as { type: string }).type}`);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendError(ws, 'WEBSOCKET_ERROR', error instanceof Error ? error.message : 'Unknown error');
  }
}

async function handleSessionStart(
  ws: ExtendedWebSocket,
  message: Extract<WebSocketMessage, { type: 'session_start' }>,
  audioProcessor: AudioProcessor
): Promise<void> {
  const { generateSessionId } = await import('@audio-tab-capture/shared');
  const sessionId = generateSessionId();
  
  const session = await audioProcessor.startSession(
    sessionId,
    message.payload.tabId,
    message.payload.tabTitle,
    message.payload.audioFormat
  );
  
  ws.sessionId = sessionId;
  
  ws.send(JSON.stringify({
    type: 'status_update',
    payload: {
      sessionId,
      status: session.status,
    },
  }));
}

async function handleSessionStop(
  ws: ExtendedWebSocket,
  message: Extract<WebSocketMessage, { type: 'session_stop' }>,
  audioProcessor: AudioProcessor
): Promise<void> {
  const session = await audioProcessor.stopSession(message.payload.sessionId);
  
  ws.send(JSON.stringify({
    type: 'status_update',
    payload: {
      sessionId: message.payload.sessionId,
      status: session.status,
    },
  }));
}

async function handleSessionPause(
  ws: ExtendedWebSocket,
  message: Extract<WebSocketMessage, { type: 'session_pause' }>,
  audioProcessor: AudioProcessor
): Promise<void> {
  const session = await audioProcessor.pauseSession(message.payload.sessionId);
  
  ws.send(JSON.stringify({
    type: 'status_update',
    payload: {
      sessionId: message.payload.sessionId,
      status: session.status,
    },
  }));
}

async function handleSessionResume(
  ws: ExtendedWebSocket,
  message: Extract<WebSocketMessage, { type: 'session_resume' }>,
  audioProcessor: AudioProcessor
): Promise<void> {
  const session = await audioProcessor.resumeSession(message.payload.sessionId);
  
  ws.send(JSON.stringify({
    type: 'status_update',
    payload: {
      sessionId: message.payload.sessionId,
      status: session.status,
    },
  }));
}

async function handleAudioChunk(
  ws: ExtendedWebSocket,
  message: Extract<WebSocketMessage, { type: 'audio_chunk' }>,
  audioProcessor: AudioProcessor
): Promise<void> {
  await audioProcessor.processAudioChunk(message.payload);
  
  // Send progress update periodically
  if (message.payload.sequenceNumber % 10 === 0) {
    const session = await audioProcessor.getSession(message.payload.sessionId);
    if (session) {
      const fileSize = await audioProcessor.getSessionFileSize(session.id);
      const duration = Date.now() - session.startTime.getTime();
      
      ws.send(JSON.stringify({
        type: 'status_update',
        payload: {
          sessionId: session.id,
          status: session.status,
          progress: {
            duration,
            fileSize,
          },
        },
      }));
    }
  }
}

function sendError(ws: ExtendedWebSocket, code: keyof typeof ERROR_CODES, error: string): void {
  const message: ErrorMessage = {
    type: 'error',
    payload: {
      sessionId: ws.sessionId,
      error,
      code,
    },
  };
  
  ws.send(JSON.stringify(message));
}