export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function validateTabId(tabId: any): boolean {
  return typeof tabId === 'number' && tabId > 0;
}

import { WebSocketMessage, AudioStreamMessage, SessionStartMessage, SessionEndMessage } from './types';

export function createWebSocketMessage<T extends WebSocketMessage>(
  type: T['type'],
  data?: T['data']
): T {
  return {
    type,
    data,
    timestamp: Date.now()
  } as T;
}

export function isAudioStreamMessage(message: any): message is AudioStreamMessage {
  return message?.type === 'audio-stream' && message?.data?.audioData && message?.data?.tabId;
}

export function isSessionStartMessage(message: any): message is SessionStartMessage {
  return message?.type === 'session-start' && message?.data?.tabId && message?.data?.sessionId;
}

export function isSessionEndMessage(message: any): message is SessionEndMessage {
  return message?.type === 'session-end' && message?.data?.sessionId;
}

export function formatDuration(startTime: number, endTime?: number): string {
  const duration = (endTime || Date.now()) - startTime;
  const seconds = Math.floor(duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}