import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { AudioProcessor } from './audio/processor';
import {
  WebSocketMessage,
  AudioChunkMessage,
  ControlMessage,
  StatusMessage,
  RecordingSession,
} from '@audio-tab-capture/shared';

// Utility functions
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function createTimestamp(): number {
  return Date.now();
}

interface ExtendedWebSocket extends WebSocket {
  sessionId?: string;
  isAlive?: boolean;
}

export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const activeSessions = new Map<string, RecordingSession>();
  const audioProcessor = new AudioProcessor();

  // Heartbeat to detect broken connections
  const heartbeat = () => {
    wss.clients.forEach((ws: ExtendedWebSocket) => {
      if (!ws.isAlive) {
        console.log('Terminating dead connection');
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  };

  const heartbeatInterval = setInterval(heartbeat, 30000);

  wss.on('connection', (ws: ExtendedWebSocket, request) => {
    console.log('New WebSocket connection established');
    ws.isAlive = true;
    ws.sessionId = generateSessionId();

    // Send connection established message
    const connectionMessage: StatusMessage = {
      type: 'connection-established',
      sessionId: ws.sessionId,
      timestamp: createTimestamp(),
      status: 'idle',
      message: 'Connected to audio capture backend',
    };
    ws.send(JSON.stringify(connectionMessage));

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (data: Buffer) => {
      try {
        // Handle both JSON messages and binary audio data
        if (data[0] === 0x7b) {
          // JSON message (starts with '{')
          const message: WebSocketMessage = JSON.parse(data.toString());
          await handleControlMessage(ws, message as ControlMessage);
        } else {
          // Binary audio data - extract metadata from first bytes if needed
          // For now, assume it's part of an ongoing session
          if (ws.sessionId && activeSessions.has(ws.sessionId)) {
            await handleAudioChunk(ws, data);
          }
        }
      } catch (error) {
        console.error('Error processing message:', error);
        sendError(ws, 'Invalid message format', ws.sessionId);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      if (ws.sessionId && activeSessions.has(ws.sessionId)) {
        const session = activeSessions.get(ws.sessionId)!;
        if (session.status === 'recording') {
          // Auto-stop recording on disconnect
          stopRecording(ws.sessionId, session);
        }
        activeSessions.delete(ws.sessionId);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  async function handleControlMessage(ws: ExtendedWebSocket, message: ControlMessage) {
    const { type, sessionId, tabId, settings } = message;

    switch (type) {
      case 'start-recording':
        if (!ws.sessionId) {
          sendError(ws, 'No session ID available');
          return;
        }

        const session: RecordingSession = {
          sessionId: ws.sessionId,
          tabId: tabId || 0,
          startTime: createTimestamp(),
          settings: settings || {
            format: {
              mimeType: 'audio/webm;codecs=opus',
              codec: 'opus',
              sampleRate: 48000,
              channels: 2,
            },
            quality: 'medium',
            chunkDuration: 1500,
          },
          status: 'starting',
          totalChunks: 0,
          receivedChunks: 0,
          metadata: {
            tabTitle: 'Unknown Tab',
            tabUrl: 'unknown',
            userAgent: 'unknown',
            duration: 0,
            fileSize: 0,
            createdAt: createTimestamp(),
          },
        };

        activeSessions.set(ws.sessionId, session);
        audioProcessor.startSession(ws.sessionId, session.settings);

        session.status = 'recording';
        sendStatus(ws, session);
        break;

      case 'stop-recording':
        if (ws.sessionId && activeSessions.has(ws.sessionId)) {
          await stopRecording(ws.sessionId, activeSessions.get(ws.sessionId)!);
          activeSessions.delete(ws.sessionId);
        }
        break;

      case 'pause-recording':
        if (ws.sessionId && activeSessions.has(ws.sessionId)) {
          const session = activeSessions.get(ws.sessionId)!;
          session.status = 'paused';
          sendStatus(ws, session);
        }
        break;

      case 'resume-recording':
        if (ws.sessionId && activeSessions.has(ws.sessionId)) {
          const session = activeSessions.get(ws.sessionId)!;
          session.status = 'recording';
          sendStatus(ws, session);
        }
        break;

      default:
        sendError(ws, `Unknown control message type: ${type}`, ws.sessionId);
    }
  }

  async function handleAudioChunk(ws: ExtendedWebSocket, data: Buffer) {
    if (!ws.sessionId || !activeSessions.has(ws.sessionId)) {
      sendError(ws, 'No active recording session', ws.sessionId);
      return;
    }

    const session = activeSessions.get(ws.sessionId)!;
    
    if (session.status !== 'recording') {
      return; // Ignore chunks when not recording
    }

    try {
      session.receivedChunks++;
      await audioProcessor.processChunk(ws.sessionId, data);
      
      // Send progress update
      sendStatus(ws, session);
    } catch (error) {
      console.error('Error processing audio chunk:', error);
      sendError(ws, 'Failed to process audio chunk', ws.sessionId);
    }
  }

  async function stopRecording(sessionId: string, session: RecordingSession) {
    session.status = 'stopping';
    session.endTime = createTimestamp();
    
    try {
      const result = await audioProcessor.finalizeSession(sessionId);
      session.status = 'completed';
      session.filePath = result.filePath;
      session.metadata.duration = session.endTime - session.startTime;
      session.metadata.fileSize = result.fileSize;

      // Notify client of completion
      wss.clients.forEach((client: ExtendedWebSocket) => {
        if (client.sessionId === sessionId && client.readyState === WebSocket.OPEN) {
          sendStatus(client, session);
        }
      });
    } catch (error) {
      console.error('Error finalizing recording:', error);
      session.status = 'error';
      
      wss.clients.forEach((client: ExtendedWebSocket) => {
        if (client.sessionId === sessionId && client.readyState === WebSocket.OPEN) {
          sendError(client, 'Failed to finalize recording', sessionId);
        }
      });
    }
  }

  function sendStatus(ws: ExtendedWebSocket, session: RecordingSession) {
    const message: StatusMessage = {
      type: 'status-update',
      sessionId: session.sessionId,
      timestamp: createTimestamp(),
      status: session.status,
      message: `Recording ${session.status}`,
    };
    ws.send(JSON.stringify(message));
  }

  function sendError(ws: ExtendedWebSocket, error: string, sessionId?: string) {
    const message: StatusMessage = {
      type: 'error',
      sessionId: sessionId || 'unknown',
      timestamp: createTimestamp(),
      error,
    };
    ws.send(JSON.stringify(message));
  }

  return wss;
}