import type { AudioFormat } from './types.js';

// Audio utilities
export function createAudioFormat(
  sampleRate: number = 44100,
  channels: number = 2,
  bitDepth: number = 16,
  codec: AudioFormat['codec'] = 'webm'
): AudioFormat {
  return {
    sampleRate,
    channels,
    bitDepth,
    codec,
  };
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

// Session utilities
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateFilename(tabTitle: string, format: AudioFormat['codec']): string {
  const sanitizedTitle = tabTitle
    .replace(/[^a-zA-Z0-9\s-_]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${sanitizedTitle}_${timestamp}.${format}`;
}

// WebSocket utilities
export function isValidWebSocketMessage(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const message = data as Record<string, unknown>;
  return typeof message.type === 'string' && typeof message.payload === 'object';
}

// Constants
export const CONSTANTS = {
  CHUNK_SIZE: 16384, // 16KB chunks
  CHUNK_DURATION_MS: 1000, // 1 second chunks
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB max file size
  WEBSOCKET_HEARTBEAT_INTERVAL: 30000, // 30 seconds
  AUDIO_SAMPLE_RATE: 44100,
  AUDIO_CHANNELS: 2,
  AUDIO_BIT_DEPTH: 16,
} as const;

// Error codes
export const ERROR_CODES = {
  INVALID_SESSION: 'INVALID_SESSION',
  AUDIO_CAPTURE_FAILED: 'AUDIO_CAPTURE_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  WEBSOCKET_ERROR: 'WEBSOCKET_ERROR',
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  STORAGE_ERROR: 'STORAGE_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];