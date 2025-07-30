import { 
  ExtensionState, 
  TabInfo, 
  CaptureSession
} from './shared/types';
import {
  generateSessionId,
  createWebSocketMessage
} from './shared/utils';
import type {
  SessionStartMessage,
  SessionEndMessage,
  AudioStreamMessage
} from './shared/types';

class AudioTabCaptureExtension {
  private state: ExtensionState = {
    isCapturing: false,
    availableTabs: []
  };
  private websocket: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private currentStream: MediaStream | null = null;
  private readonly wsUrl = 'ws://localhost:8080';

  constructor() {
    this.setupEventListeners();
    this.connectWebSocket();
  }

  private setupEventListeners(): void {
    // Listen for tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.audible !== undefined) {
        this.updateAvailableTabs();
      }
    });

    // Listen for tab removal
    chrome.tabs.onRemoved.addListener(() => {
      this.updateAvailableTabs();
    });

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });
  }

  private async handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void): Promise<void> {
    try {
      switch (message.type) {
        case 'get-state':
          await this.updateAvailableTabs();
          sendResponse({ state: this.state });
          break;
        
        case 'start-capture':
          const result = await this.startCapture(message.tabId);
          sendResponse({ success: result.success, error: result.error });
          break;
        
        case 'stop-capture':
          this.stopCapture();
          sendResponse({ success: true });
          break;
        
        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async updateAvailableTabs(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({});
      this.state.availableTabs = tabs
        .filter(tab => tab.id !== undefined && tab.audible === true)
        .map(tab => ({
          id: tab.id!,
          title: tab.title || 'Unknown',
          url: tab.url || '',
          hasAudio: tab.audible || false,
          isActive: tab.active || false
        }));
    } catch (error) {
      console.error('Error updating available tabs:', error);
    }
  }

  private async startCapture(tabId: number): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.state.isCapturing) {
        return { success: false, error: 'Already capturing' };
      }

      const tab = await chrome.tabs.get(tabId);
      if (!tab) {
        return { success: false, error: 'Tab not found' };
      }

      // Start tab capture
      const stream = await chrome.tabCapture.capture({
        audio: true,
        video: false
      });

      if (!stream) {
        return { success: false, error: 'Failed to capture tab audio' };
      }

      this.currentStream = stream;
      
      // Create capture session
      const session: CaptureSession = {
        id: generateSessionId(),
        tabId,
        tabTitle: tab.title || 'Unknown',
        isActive: true,
        startTime: Date.now()
      };

      this.state.currentSession = session;
      this.state.isCapturing = true;

      // Setup MediaRecorder
      this.setupMediaRecorder(stream, session);

      // Notify server about session start
      this.sendSessionStart(session);

      console.log('Started capturing audio from tab:', tab.title);
      return { success: true };

    } catch (error) {
      console.error('Error starting capture:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private setupMediaRecorder(stream: MediaStream, session: CaptureSession): void {
    try {
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
        audioBitsPerSecond: 128000
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.websocket?.readyState === WebSocket.OPEN) {
          // Convert blob to ArrayBuffer and send
          event.data.arrayBuffer().then(arrayBuffer => {
            const message: AudioStreamMessage = createWebSocketMessage('audio-stream', {
              audioData: arrayBuffer,
              tabId: session.tabId,
              sessionId: session.id
            });
            
            this.websocket?.send(JSON.stringify({
              ...message,
              data: {
                ...message.data,
                audioData: Array.from(new Uint8Array(arrayBuffer))
              }
            }));
          });
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        this.stopCapture();
      };

      this.mediaRecorder.start(100); // Capture in 100ms chunks
    } catch (error) {
      console.error('Error setting up MediaRecorder:', error);
      this.stopCapture();
    }
  }

  private stopCapture(): void {
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      if (this.currentStream) {
        this.currentStream.getTracks().forEach(track => track.stop());
        this.currentStream = null;
      }

      if (this.state.currentSession) {
        this.sendSessionEnd(this.state.currentSession);
        this.state.currentSession = undefined;
      }

      this.state.isCapturing = false;
      this.mediaRecorder = null;

      console.log('Stopped audio capture');
    } catch (error) {
      console.error('Error stopping capture:', error);
    }
  }

  private connectWebSocket(): void {
    try {
      this.websocket = new WebSocket(this.wsUrl);

      this.websocket.onopen = () => {
        console.log('Connected to WebSocket server');
      };

      this.websocket.onclose = () => {
        console.log('WebSocket connection closed');
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.connectWebSocket(), 5000);
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      // Retry connection after 5 seconds
      setTimeout(() => this.connectWebSocket(), 5000);
    }
  }

  private sendSessionStart(session: CaptureSession): void {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      const message: SessionStartMessage = createWebSocketMessage('session-start', {
        tabId: session.tabId,
        tabTitle: session.tabTitle,
        sessionId: session.id
      });
      
      this.websocket.send(JSON.stringify(message));
    }
  }

  private sendSessionEnd(session: CaptureSession): void {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      const message: SessionEndMessage = createWebSocketMessage('session-end', {
        sessionId: session.id
      });
      
      this.websocket.send(JSON.stringify(message));
    }
  }
}

// Initialize extension
new AudioTabCaptureExtension();