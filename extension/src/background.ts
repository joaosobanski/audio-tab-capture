import type { 
  WebSocketMessage, 
  AudioSession, 
  AudioChunk,
  TabInfo,
  createAudioFormat,
  generateSessionId,
  CONSTANTS
} from '@audio-tab-capture/shared';

interface CaptureSession {
  sessionId: string;
  tabId: number;
  mediaStream?: MediaStream;
  audioContext?: AudioContext;
  mediaRecorder?: MediaRecorder;
  websocket?: WebSocket;
  chunks: Blob[];
  sequenceNumber: number;
}

class AudioCaptureService {
  private activeSessions = new Map<number, CaptureSession>();
  private websocketUrl = 'ws://localhost:3001/ws';

  constructor() {
    this.setupMessageListeners();
  }

  private setupMessageListeners(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
      this.stopCapture(tabId);
    });
  }

  private async handleMessage(
    message: unknown, 
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ): Promise<void> {
    try {
      const msg = message as { type: string; payload?: unknown };
      
      switch (msg.type) {
        case 'get_tabs':
          const tabs = await this.getAudibleTabs();
          sendResponse({ success: true, data: tabs });
          break;
          
        case 'start_capture':
          const payload = msg.payload as { tabId: number };
          const session = await this.startCapture(payload.tabId);
          sendResponse({ success: true, data: session });
          break;
          
        case 'stop_capture':
          const stopPayload = msg.payload as { tabId: number };
          await this.stopCapture(stopPayload.tabId);
          sendResponse({ success: true });
          break;
          
        case 'get_sessions':
          const sessions = Array.from(this.activeSessions.values()).map(s => ({
            sessionId: s.sessionId,
            tabId: s.tabId,
            status: 'recording'
          }));
          sendResponse({ success: true, data: sessions });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  private async getAudibleTabs(): Promise<TabInfo[]> {
    const tabs = await chrome.tabs.query({});
    return tabs
      .filter(tab => tab.audible && tab.id !== undefined)
      .map(tab => ({
        id: tab.id!,
        title: tab.title || 'Unknown Tab',
        url: tab.url || '',
        audible: tab.audible || false,
        favIconUrl: tab.favIconUrl,
      }));
  }

  private async startCapture(tabId: number): Promise<{ sessionId: string }> {
    // Stop existing capture for this tab
    await this.stopCapture(tabId);

    const { generateSessionId } = await import('@audio-tab-capture/shared');
    const sessionId = generateSessionId();
    
    // Get tab info
    const tab = await chrome.tabs.get(tabId);
    if (!tab) {
      throw new Error('Tab not found');
    }

    // Create capture session
    const session: CaptureSession = {
      sessionId,
      tabId,
      chunks: [],
      sequenceNumber: 0,
    };

    // Request screen capture with audio
    const streamId = await new Promise<string>((resolve, reject) => {
      chrome.desktopCapture.chooseDesktopMedia(
        ['tab'],
        tab,
        (streamId: string | null) => {
          if (streamId) {
            resolve(streamId);
          } else {
            reject(new Error('User cancelled screen capture'));
          }
        }
      );
    });

    // Get media stream
    session.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
        },
      } as MediaTrackConstraints,
      video: false,
    });

    // Setup audio context for processing
    session.audioContext = new AudioContext();
    const source = session.audioContext.createMediaStreamSource(session.mediaStream);
    
    // Setup WebSocket connection
    session.websocket = new WebSocket(this.websocketUrl);
    
    await new Promise<void>((resolve, reject) => {
      session.websocket!.onopen = () => {
        console.log('WebSocket connected for session', sessionId);
        resolve();
      };
      
      session.websocket!.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(new Error('WebSocket connection failed'));
      };
      
      session.websocket!.onmessage = (event) => {
        this.handleWebSocketMessage(sessionId, event);
      };
    });

    // Start session on server
    const { createAudioFormat } = await import('@audio-tab-capture/shared');
    const startMessage: WebSocketMessage = {
      type: 'session_start',
      payload: {
        tabId,
        tabTitle: tab.title || 'Unknown Tab',
        audioFormat: createAudioFormat(),
      },
    };
    
    session.websocket.send(JSON.stringify(startMessage));

    // Setup MediaRecorder for audio chunks
    session.mediaRecorder = new MediaRecorder(session.mediaStream, {
      mimeType: 'audio/webm;codecs=opus',
    });

    session.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.handleAudioData(sessionId, event.data);
      }
    };

    // Start recording with 1-second time slices
    const { CONSTANTS } = await import('@audio-tab-capture/shared');
    session.mediaRecorder.start(CONSTANTS.CHUNK_DURATION_MS);

    this.activeSessions.set(tabId, session);
    
    console.log(`Started audio capture for tab ${tabId}, session ${sessionId}`);
    return { sessionId };
  }

  private async handleAudioData(sessionId: string, data: Blob): Promise<void> {
    const session = Array.from(this.activeSessions.values())
      .find(s => s.sessionId === sessionId);
    
    if (!session || !session.websocket) {
      return;
    }

    // Convert blob to ArrayBuffer
    const arrayBuffer = await data.arrayBuffer();
    
    const audioChunk: AudioChunk = {
      sessionId,
      sequenceNumber: session.sequenceNumber++,
      timestamp: Date.now(),
      data: arrayBuffer,
      isLast: false,
    };

    const message: WebSocketMessage = {
      type: 'audio_chunk',
      payload: audioChunk,
    };

    session.websocket.send(JSON.stringify(message));
  }

  private handleWebSocketMessage(sessionId: string, event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data as string) as WebSocketMessage;
      
      switch (message.type) {
        case 'status_update':
          console.log('Session status update:', message.payload);
          // Notify popup about status changes
          chrome.runtime.sendMessage({
            type: 'session_status',
            payload: message.payload,
          }).catch(() => {
            // Popup might not be open, ignore error
          });
          break;
          
        case 'error':
          console.error('Session error:', message.payload);
          // Handle error by stopping the session
          const session = Array.from(this.activeSessions.values())
            .find(s => s.sessionId === sessionId);
          if (session) {
            this.stopCapture(session.tabId);
          }
          break;
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private async stopCapture(tabId: number): Promise<void> {
    const session = this.activeSessions.get(tabId);
    if (!session) {
      return;
    }

    try {
      // Stop media recorder
      if (session.mediaRecorder && session.mediaRecorder.state !== 'inactive') {
        session.mediaRecorder.stop();
      }

      // Close audio context
      if (session.audioContext) {
        await session.audioContext.close();
      }

      // Stop media stream
      if (session.mediaStream) {
        session.mediaStream.getTracks().forEach(track => track.stop());
      }

      // Send stop message to server
      if (session.websocket && session.websocket.readyState === WebSocket.OPEN) {
        const stopMessage: WebSocketMessage = {
          type: 'session_stop',
          payload: {
            sessionId: session.sessionId,
          },
        };
        
        session.websocket.send(JSON.stringify(stopMessage));
        session.websocket.close();
      }

      console.log(`Stopped audio capture for tab ${tabId}, session ${session.sessionId}`);
    } catch (error) {
      console.error('Error stopping capture:', error);
    } finally {
      this.activeSessions.delete(tabId);
    }
  }
}

// Initialize service when background script loads
const audioCaptureService = new AudioCaptureService();

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('Audio Tab Capture extension started');
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Audio Tab Capture extension installed');
});