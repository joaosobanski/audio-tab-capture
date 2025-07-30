// Content script for page interaction and visual feedback

interface ContentMessage {
  type: string;
  data?: any;
}

class ContentScriptManager {
  private isRecording = false;
  private recordingIndicator: HTMLElement | null = null;

  constructor() {
    this.setupMessageListener();
    this.createRecordingIndicator();
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener(
      (request: ContentMessage, sender, sendResponse) => {
        this.handleMessage(request, sendResponse);
        return true;
      }
    );
  }

  private handleMessage(message: ContentMessage, sendResponse: (response: any) => void): void {
    switch (message.type) {
      case 'recording-started':
        this.showRecordingIndicator();
        this.isRecording = true;
        sendResponse({ success: true });
        break;

      case 'recording-stopped':
        this.hideRecordingIndicator();
        this.isRecording = false;
        sendResponse({ success: true });
        break;

      case 'get-page-info':
        sendResponse({
          title: document.title,
          url: window.location.href,
          hasAudio: this.detectAudioElements(),
        });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  }

  private createRecordingIndicator(): void {
    // Create recording indicator element
    this.recordingIndicator = document.createElement('div');
    this.recordingIndicator.id = 'audio-tab-capture-indicator';
    this.recordingIndicator.innerHTML = `
      <div style="
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 10000;
        background: #ff4444;
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-family: Arial, sans-serif;
        font-size: 12px;
        font-weight: bold;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: none;
        align-items: center;
        gap: 6px;
      " id="recording-badge">
        <div style="
          width: 8px;
          height: 8px;
          background: white;
          border-radius: 50%;
          animation: pulse 1s infinite;
        "></div>
        Recording Audio
      </div>
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      </style>
    `;
  }

  private showRecordingIndicator(): void {
    if (!this.recordingIndicator) {
      this.createRecordingIndicator();
    }

    // Add to DOM if not already present
    if (!document.getElementById('audio-tab-capture-indicator')) {
      document.body.appendChild(this.recordingIndicator!);
    }

    const badge = document.getElementById('recording-badge');
    if (badge) {
      badge.style.display = 'flex';
    }

    console.log('Audio recording indicator shown');
  }

  private hideRecordingIndicator(): void {
    const badge = document.getElementById('recording-badge');
    if (badge) {
      badge.style.display = 'none';
    }

    console.log('Audio recording indicator hidden');
  }

  private detectAudioElements(): boolean {
    // Check for audio/video elements
    const audioElements = document.querySelectorAll('audio, video');
    const hasPlayingMedia = Array.from(audioElements).some(
      (element: any) => !element.paused && !element.muted
    );

    // Check for Web Audio API usage
    const hasWebAudio = 'AudioContext' in window || 'webkitAudioContext' in window;

    // Check for media source extensions
    const hasMediaSource = 'MediaSource' in window;

    return hasPlayingMedia || hasWebAudio || hasMediaSource;
  }

  public getPageMetadata() {
    return {
      title: document.title,
      url: window.location.href,
      hasAudio: this.detectAudioElements(),
      timestamp: Date.now(),
    };
  }
}

// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ContentScriptManager();
  });
} else {
  new ContentScriptManager();
}

// Export for potential use by other scripts
(window as any).audioTabCaptureContent = new ContentScriptManager();