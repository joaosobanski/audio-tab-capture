import { Router } from 'express';
import { WebSocketManager } from '../websocket';

export function createApiRoutes(wsManager: WebSocketManager): Router {
  const router = Router();

  // Get active sessions
  router.get('/sessions', (req, res) => {
    const sessions = wsManager.getActiveSessions().map(session => ({
      id: session.id,
      tabId: session.tabId,
      tabTitle: session.tabTitle,
      startTime: session.startTime,
      lastActivity: session.lastActivity,
      isActive: session.isActive
    }));

    res.json({
      sessions,
      count: sessions.length
    });
  });

  // Health check
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      activeSessions: wsManager.getSessionCount()
    });
  });

  // Server stats
  router.get('/stats', (req, res) => {
    res.json({
      activeSessions: wsManager.getSessionCount(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: Date.now()
    });
  });

  return router;
}