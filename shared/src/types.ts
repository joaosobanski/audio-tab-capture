// WebSocket Message Types
export interface WebSocketMessage {
  type: string;
  sessionId: string;
  timestamp: number;
}

export interface AudioChunkMessage extends WebSocketMessage {
  type: 'audio-chunk';
  sequenceNumber: number;
  chunk: ArrayBuffer;
  isLast: boolean;
  format: AudioFormat;
  chunkDuration: number;
}

export interface ControlMessage extends WebSocketMessage {
  type: 'start-recording' | 'stop-recording' | 'pause-recording' | 'resume-recording';
  tabId?: number;
  settings?: RecordingSettings;
}

export interface StatusMessage extends WebSocketMessage {
  type: 'status-update' | 'error' | 'connection-established';
  status?: RecordingStatus;
  message?: string;
  error?: string;
}

// Audio and Recording Types
export interface AudioFormat {
  mimeType: string;
  codec: string;
  sampleRate: number;
  channels: number;
  bitRate?: number;
}

export interface RecordingSettings {
  format: AudioFormat;
  quality: 'low' | 'medium' | 'high';
  chunkDuration: number; // in milliseconds
  maxDuration?: number; // in milliseconds
}

export interface RecordingSession {
  sessionId: string;
  tabId: number;
  startTime: number;
  endTime?: number;
  settings: RecordingSettings;
  status: RecordingStatus;
  totalChunks: number;
  receivedChunks: number;
  filePath?: string;
  metadata: SessionMetadata;
}

export interface SessionMetadata {
  tabTitle: string;
  tabUrl: string;
  userAgent: string;
  duration: number;
  fileSize: number;
  createdAt: number;
}

export type RecordingStatus = 
  | 'idle'
  | 'starting'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'completed'
  | 'error';

// Browser Extension Types
export interface TabInfo {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  audible: boolean;
}

export interface ExtensionSettings {
  defaultFormat: AudioFormat;
  defaultQuality: 'low' | 'medium' | 'high';
  defaultChunkDuration: number;
  maxRecordingDuration: number;
  autoConnect: boolean;
  serverUrl: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  uptime: number;
  activeConnections: number;
  activeSessions: number;
  version: string;
}

export interface SessionListResponse {
  sessions: RecordingSession[];
  total: number;
  page: number;
  limit: number;
}

// Error Types
export class AudioCaptureError extends Error {
  constructor(
    message: string,
    public code: string,
    public sessionId?: string
  ) {
    super(message);
    this.name = 'AudioCaptureError';
  }
}

export class WebSocketError extends Error {
  constructor(
    message: string,
    public code: string,
    public event?: Event
  ) {
    super(message);
    this.name = 'WebSocketError';
  }
}

export class RecordingError extends Error {
  constructor(
    message: string,
    public code: string,
    public sessionId?: string
  ) {
    super(message);
    this.name = 'RecordingError';
  }
}