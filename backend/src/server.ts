import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { setupWebSocket } from './websocket.js';
import { AudioProcessor } from './audio/processor.js';
import type { ApiResponse, SessionListResponse, DownloadInfo } from '@audio-tab-capture/shared';

const app = express();
const server = createServer(app);
const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;

// Initialize audio processor
const audioProcessor = new AudioProcessor();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Get all sessions
app.get('/api/sessions', async (_req, res) => {
  try {
    const sessions = await audioProcessor.getAllSessions();
    const response: ApiResponse<SessionListResponse> = {
      success: true,
      data: {
        sessions,
        total: sessions.length,
      },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// Get session by ID
app.get('/api/sessions/:sessionId', async (req, res) => {
  try {
    const session = await audioProcessor.getSession(req.params.sessionId);
    if (!session) {
      const response: ApiResponse = {
        success: false,
        error: 'Session not found',
      };
      return res.status(404).json(response);
    }
    
    const response: ApiResponse = {
      success: true,
      data: session,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// Download audio file
app.get('/api/sessions/:sessionId/download', async (req, res) => {
  try {
    const downloadInfo = await audioProcessor.getDownloadInfo(req.params.sessionId);
    if (!downloadInfo) {
      const response: ApiResponse = {
        success: false,
        error: 'Session not found or file not available',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<DownloadInfo> = {
      success: true,
      data: downloadInfo,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// Serve audio files
app.get('/api/files/:filename', async (req, res) => {
  try {
    const filePath = await audioProcessor.getFilePath(req.params.filename);
    if (!filePath) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(filePath);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Delete session
app.delete('/api/sessions/:sessionId', async (req, res) => {
  try {
    const success = await audioProcessor.deleteSession(req.params.sessionId);
    if (!success) {
      const response: ApiResponse = {
        success: false,
        error: 'Session not found',
      };
      return res.status(404).json(response);
    }
    
    const response: ApiResponse = {
      success: true,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// Setup WebSocket server
setupWebSocket(server, audioProcessor);

// Start server
server.listen(port, () => {
  console.log(`Audio Tab Capture server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`WebSocket: ws://localhost:${port}`);
});