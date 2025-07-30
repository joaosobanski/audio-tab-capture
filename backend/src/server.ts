import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { setupWebSocket } from './websocket';
import { ApiResponse, HealthCheckResponse } from '@audio-tab-capture/shared';
import path from 'path';
import fs from 'fs';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['chrome-extension://*', 'moz-extension://*', 'http://localhost:*'],
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json());

// Ensure recordings directory exists
const recordingsDir = path.join(process.cwd(), 'recordings');
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}

// Setup WebSocket server
const wss = setupWebSocket(server);

// Health check endpoint
app.get('/health', (req, res) => {
  const response: ApiResponse<HealthCheckResponse> = {
    success: true,
    data: {
      status: 'healthy',
      uptime: process.uptime(),
      activeConnections: wss.clients.size,
      activeSessions: 0, // Will be updated by WebSocket handler
      version: '1.0.0',
    },
    timestamp: Date.now(),
  };
  res.json(response);
});

// API routes
app.get('/api/sessions', (req, res) => {
  // TODO: Implement session listing
  const response: ApiResponse = {
    success: true,
    data: {
      sessions: [],
      total: 0,
      page: 1,
      limit: 50,
    },
    timestamp: Date.now(),
  };
  res.json(response);
});

app.get('/api/sessions/:sessionId/download', (req, res) => {
  const { sessionId } = req.params;
  const filePath = path.join(recordingsDir, `${sessionId}.webm`);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath, `recording-${sessionId}.webm`);
  } else {
    const response: ApiResponse = {
      success: false,
      error: 'Recording not found',
      timestamp: Date.now(),
    };
    res.status(404).json(response);
  }
});

app.delete('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const filePath = path.join(recordingsDir, `${sessionId}.webm`);
  
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    const response: ApiResponse = {
      success: true,
      data: { deleted: true },
      timestamp: Date.now(),
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: 'Failed to delete recording',
      timestamp: Date.now(),
    };
    res.status(500).json(response);
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  const response: ApiResponse = {
    success: false,
    error: err.message || 'Internal server error',
    timestamp: Date.now(),
  };
  res.status(500).json(response);
});

// 404 handler
app.use('*', (req, res) => {
  const response: ApiResponse = {
    success: false,
    error: 'Not found',
    timestamp: Date.now(),
  };
  res.status(404).json(response);
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Audio Tab Capture Backend running on port ${PORT}`);
  console.log(`📁 Recordings directory: ${recordingsDir}`);
  console.log(`🔌 WebSocket server ready for connections`);
});

export default app;