// Types and utilities for the extension
interface WebSocketMessage {
  type: string;
  sessionId: string;
  timestamp: number;
}

interface ControlMessage extends WebSocketMessage {
  type: 'start-recording' | 'stop-recording' | 'pause-recording' | 'resume-recording';
  tabId?: number;
  settings?: any;
}

interface StatusMessage extends WebSocketMessage {
  type: 'status-update' | 'error' | 'connection-established';
  status?: string;
  message?: string;
  error?: string;
}

interface AudioFormat {
  mimeType: string;
  codec: string;
  sampleRate: number;
  channels: number;
  bitRate?: number;
}

interface RecordingSettings {
  format: AudioFormat;
  quality: 'low' | 'medium' | 'high';
  chunkDuration: number;
  maxDuration?: number;
}

const DEFAULT_RECORDING_SETTINGS: RecordingSettings = {
  format: {
    mimeType: 'audio/webm;codecs=opus',
    codec: 'opus',
    sampleRate: 48000,
    channels: 2,
    bitRate: 128000,
  },
  quality: 'medium',
  chunkDuration: 1500,
  maxDuration: 3600000,
};

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function createTimestamp(): number {
  return Date.now();
}

class WebSocketError extends Error {
  constructor(
    message: string,
    public code: string,
    public event?: Event
  ) {
    super(message);
    this.name = 'WebSocketError';
  }
}

class AudioCaptureManager {
  private ws: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private currentSession: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private serverUrl = 'ws://localhost:3001/ws';
  private isConnecting = false;

  constructor() {
    this.setupMessageListeners();
  }

  private setupMessageListeners() {
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener(
      (request, sender, sendResponse) => {
        this.handleMessage(request, sender, sendResponse);
        return true; // Keep message channel open for async responses
      }
    );

    // Listen for tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && this.currentSession) {
        // Notify popup of tab changes
        this.notifyPopup('tab-updated', { tabId, tab });
      }
    });
  }

  private async handleMessage(request: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
    try {
      switch (request.action) {
        case 'connect':
          await this.connect();
          sendResponse({ success: true, message: 'Connected to backend' });
          break;

        case 'disconnect':
          this.disconnect();
          sendResponse({ success: true, message: 'Disconnected from backend' });
          break;

        case 'start-recording':
          await this.startRecording(request.tabId, request.settings);
          sendResponse({ success: true, sessionId: this.currentSession });
          break;

        case 'stop-recording':
          await this.stopRecording();
          sendResponse({ success: true, message: 'Recording stopped' });
          break;

        case 'get-status':
          sendResponse({
            connected: this.ws?.readyState === WebSocket.OPEN,
            recording: this.mediaRecorder?.state === 'recording',
            sessionId: this.currentSession,
          });
          break;

        case 'get-tabs':
          const tabs = await this.getAudioTabs();
          sendResponse({ tabs });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  private async connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        console.log('Connected to audio capture backend');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.notifyPopup('connection-status', { connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleServerMessage(message);
        } catch (error) {
          console.error('Error parsing server message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket connection closed');
        this.isConnecting = false;
        this.notifyPopup('connection-status', { connected: false });
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.reconnectAttempts++;
            console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
            this.connect();
          }, 3000);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.notifyPopup('error', { error: 'WebSocket connection error' });
      };

    } catch (error) {
      this.isConnecting = false;
      throw new WebSocketError('Failed to connect to backend', 'CONNECTION_FAILED');
    }
  }

  private disconnect(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.stopRecording();
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private handleServerMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'connection-established':
        console.log('Backend connection established');
        break;

      case 'status-update':
        const statusMessage = message as StatusMessage;
        this.notifyPopup('recording-status', { 
          status: statusMessage.status,
          message: statusMessage.message 
        });
        break;

      case 'error':
        const errorMessage = message as StatusMessage;
        console.error('Backend error:', errorMessage.error);
        this.notifyPopup('error', { error: errorMessage.error });
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private async startRecording(tabId: number, settings?: any): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to backend');
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      throw new Error('Already recording');
    }

    try {
      // Request tab capture with audio
      const streamId = await new Promise<string>((resolve, reject) => {
        chrome.desktopCapture.chooseDesktopMedia(
          ['tab', 'audio'],
          (streamId) => {
            if (streamId) {
              resolve(streamId);
            } else {
              reject(new Error('User cancelled screen capture'));
            }
          }
        );
      });

      // Get media stream
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: streamId,
          },
        } as any,
        video: false,
      } as any);

      // Create MediaRecorder
      const recordingSettings = settings || DEFAULT_RECORDING_SETTINGS;
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: recordingSettings.format.mimeType,
      });

      this.currentSession = generateSessionId();

      // Send start recording command to backend
      const startMessage: ControlMessage = {
        type: 'start-recording',
        sessionId: this.currentSession,
        timestamp: createTimestamp(),
        tabId,
        settings: recordingSettings,
      };

      this.ws.send(JSON.stringify(startMessage));

      // Handle recorded data
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
          // Send audio chunk to backend
          this.ws.send(event.data);
        }
      };

      this.mediaRecorder.onstart = () => {
        console.log('Recording started');
        this.notifyPopup('recording-started', { sessionId: this.currentSession });
      };

      this.mediaRecorder.onstop = () => {
        console.log('Recording stopped');
        this.notifyPopup('recording-stopped', {});
        this.cleanup();
      };

      // Start recording with chunked data
      this.mediaRecorder.start(recordingSettings.chunkDuration);

    } catch (error) {
      console.error('Error starting recording:', error);
      this.cleanup();
      throw error;
    }
  }

  private async stopRecording(): Promise<void> {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }

    if (this.currentSession && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const stopMessage: ControlMessage = {
        type: 'stop-recording',
        sessionId: this.currentSession,
        timestamp: createTimestamp(),
      };

      this.ws.send(JSON.stringify(stopMessage));
    }

    this.cleanup();
  }

  private cleanup(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.mediaRecorder = null;
    this.currentSession = null;
  }

  private async getAudioTabs(): Promise<any[]> {
    return new Promise((resolve) => {
      chrome.tabs.query({}, (tabs) => {
        const audioTabs = tabs
          .filter(tab => tab.audible || tab.url?.startsWith('http'))
          .map(tab => ({
            id: tab.id,
            title: tab.title,
            url: tab.url,
            favIconUrl: tab.favIconUrl,
            audible: tab.audible,
          }));
        resolve(audioTabs);
      });
    });
  }

  private notifyPopup(type: string, data: any): void {
    // Try to send message to popup if it's open
    chrome.runtime.sendMessage({ type, data }).catch(() => {
      // Popup not open, ignore error
    });
  }
}

// Initialize the audio capture manager
const audioCaptureManager = new AudioCaptureManager();

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('Audio Tab Capture extension started');
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Audio Tab Capture extension installed');
});