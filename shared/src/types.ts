// Audio session and streaming interfaces
export interface AudioSession {
  id: string;
  tabId: number;
  tabTitle: string;
  startTime: Date;
  endTime?: Date;
  status: 'recording' | 'paused' | 'stopped' | 'error';
  audioFormat: AudioFormat;
}

export interface AudioFormat {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  codec: 'webm' | 'wav' | 'mp3';
}

export interface AudioChunk {
  sessionId: string;
  sequenceNumber: number;
  timestamp: number;
  data: ArrayBuffer;
  isLast: boolean;
}

// WebSocket message types
export type WebSocketMessage = 
  | SessionStartMessage
  | SessionStopMessage
  | SessionPauseMessage
  | SessionResumeMessage
  | AudioChunkMessage
  | StatusUpdateMessage
  | ErrorMessage;

export interface SessionStartMessage {
  type: 'session_start';
  payload: {
    tabId: number;
    tabTitle: string;
    audioFormat: AudioFormat;
  };
}

export interface SessionStopMessage {
  type: 'session_stop';
  payload: {
    sessionId: string;
  };
}

export interface SessionPauseMessage {
  type: 'session_pause';
  payload: {
    sessionId: string;
  };
}

export interface SessionResumeMessage {
  type: 'session_resume';
  payload: {
    sessionId: string;
  };
}

export interface AudioChunkMessage {
  type: 'audio_chunk';
  payload: AudioChunk;
}

export interface StatusUpdateMessage {
  type: 'status_update';
  payload: {
    sessionId: string;
    status: AudioSession['status'];
    progress?: {
      duration: number;
      fileSize: number;
    };
  };
}

export interface ErrorMessage {
  type: 'error';
  payload: {
    sessionId?: string;
    error: string;
    code: string;
  };
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SessionListResponse {
  sessions: AudioSession[];
  total: number;
}

export interface DownloadInfo {
  sessionId: string;
  filename: string;
  fileSize: number;
  downloadUrl: string;
}

// Tab information
export interface TabInfo {
  id: number;
  title: string;
  url: string;
  audible: boolean;
  favIconUrl?: string;
}