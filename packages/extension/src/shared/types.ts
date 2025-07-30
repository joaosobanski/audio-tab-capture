// WebSocket message types
export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp: number;
}

export interface AudioStreamMessage extends WebSocketMessage {
  type: 'audio-stream';
  data: {
    audioData: ArrayBuffer;
    tabId: number;
    sessionId: string;
  };
}

export interface SessionStartMessage extends WebSocketMessage {
  type: 'session-start';
  data: {
    tabId: number;
    tabTitle: string;
    sessionId: string;
  };
}

export interface SessionEndMessage extends WebSocketMessage {
  type: 'session-end';
  data: {
    sessionId: string;
  };
}

export interface ErrorMessage extends WebSocketMessage {
  type: 'error';
  data: {
    message: string;
    code?: string;
  };
}

// Tab capture types
export interface TabInfo {
  id: number;
  title: string;
  url: string;
  hasAudio: boolean;
  isActive: boolean;
}

export interface CaptureSession {
  id: string;
  tabId: number;
  tabTitle: string;
  isActive: boolean;
  startTime: number;
  endTime?: number;
}

// Extension state
export interface ExtensionState {
  isCapturing: boolean;
  currentSession?: CaptureSession;
  availableTabs: TabInfo[];
}

// Backend session management
export interface ServerSession {
  id: string;
  tabId: number;
  tabTitle: string;
  websocket: any; // WebSocket instance
  isActive: boolean;
  startTime: number;
  lastActivity: number;
}

// Audio configuration
export interface AudioConfig {
  sampleRate: number;
  channels: number;
  format: 'webm' | 'opus';
}

export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  sampleRate: 48000,
  channels: 2,
  format: 'webm'
};