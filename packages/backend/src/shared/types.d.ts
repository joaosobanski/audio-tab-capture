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
export interface ExtensionState {
    isCapturing: boolean;
    currentSession?: CaptureSession;
    availableTabs: TabInfo[];
}
export interface ServerSession {
    id: string;
    tabId: number;
    tabTitle: string;
    websocket: any;
    isActive: boolean;
    startTime: number;
    lastActivity: number;
}
export interface AudioConfig {
    sampleRate: number;
    channels: number;
    format: 'webm' | 'opus';
}
export declare const DEFAULT_AUDIO_CONFIG: AudioConfig;
//# sourceMappingURL=types.d.ts.map