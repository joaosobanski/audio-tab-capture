// Popup types and utilities
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

const AUDIO_FORMATS: Record<string, AudioFormat> = {
  WEBM_OPUS: {
    mimeType: 'audio/webm;codecs=opus',
    codec: 'opus',
    sampleRate: 48000,
    channels: 2,
    bitRate: 128000,
  },
  WEBM_VORBIS: {
    mimeType: 'audio/webm;codecs=vorbis',
    codec: 'vorbis',
    sampleRate: 44100,
    channels: 2,
    bitRate: 192000,
  },
  MP4_AAC: {
    mimeType: 'audio/mp4;codecs=mp4a.40.2',
    codec: 'aac',
    sampleRate: 44100,
    channels: 2,
    bitRate: 128000,
  },
};

const QUALITY_PRESETS: Record<string, Partial<AudioFormat>> = {
  low: {
    sampleRate: 22050,
    channels: 1,
    bitRate: 64000,
  },
  medium: {
    sampleRate: 44100,
    channels: 2,
    bitRate: 128000,
  },
  high: {
    sampleRate: 48000,
    channels: 2,
    bitRate: 256000,
  },
};

function mergeRecordingSettings(
  base: RecordingSettings,
  overrides: Partial<RecordingSettings>
): RecordingSettings {
  return {
    ...base,
    ...overrides,
    format: {
      ...base.format,
      ...(overrides.format || {}),
    },
  };
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60)
      .toString()
      .padStart(2, '0')}`;
  }
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}

interface PopupElements {
  connectionStatus: HTMLElement;
  errorMessage: HTMLElement;
  tabList: HTMLElement;
  connectBtn: HTMLButtonElement;
  recordBtn: HTMLButtonElement;
  stopBtn: HTMLButtonElement;
  qualitySelect: HTMLSelectElement;
  formatSelect: HTMLSelectElement;
}

class PopupManager {
  private elements: PopupElements;
  private selectedTabId: number | null = null;
  private isConnected = false;
  private isRecording = false;
  private currentSessionId: string | null = null;

  constructor() {
    this.elements = this.initializeElements();
    this.setupEventListeners();
    this.initialize();
  }

  private initializeElements(): PopupElements {
    return {
      connectionStatus: document.getElementById('connection-status')!,
      errorMessage: document.getElementById('error-message')!,
      tabList: document.getElementById('tab-list')!,
      connectBtn: document.getElementById('connect-btn') as HTMLButtonElement,
      recordBtn: document.getElementById('record-btn') as HTMLButtonElement,
      stopBtn: document.getElementById('stop-btn') as HTMLButtonElement,
      qualitySelect: document.getElementById('quality-select') as HTMLSelectElement,
      formatSelect: document.getElementById('format-select') as HTMLSelectElement,
    };
  }

  private setupEventListeners(): void {
    this.elements.connectBtn.addEventListener('click', () => this.toggleConnection());
    this.elements.recordBtn.addEventListener('click', () => this.startRecording());
    this.elements.stopBtn.addEventListener('click', () => this.stopRecording());

    // Listen for background script messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleBackgroundMessage(message);
      sendResponse({ received: true });
    });
  }

  private async initialize(): Promise<void> {
    try {
      await this.loadTabs();
      await this.checkConnectionStatus();
    } catch (error) {
      this.showError(`Initialization failed: ${error}`);
    }
  }

  private async checkConnectionStatus(): Promise<void> {
    try {
      const response = await this.sendMessageToBackground('get-status');
      this.updateConnectionStatus(response.connected);
      this.updateRecordingStatus(response.recording);
      this.currentSessionId = response.sessionId;
    } catch (error) {
      console.error('Failed to check status:', error);
      this.updateConnectionStatus(false);
    }
  }

  private async loadTabs(): Promise<void> {
    try {
      const response = await this.sendMessageToBackground('get-tabs');
      this.renderTabs(response.tabs);
    } catch (error) {
      this.showError(`Failed to load tabs: ${error}`);
    }
  }

  private renderTabs(tabs: any[]): void {
    if (tabs.length === 0) {
      this.elements.tabList.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #6b7280;">
          No tabs with audio found
        </div>
      `;
      return;
    }

    this.elements.tabList.innerHTML = tabs
      .map(
        (tab, index) => `
        <div class="tab-item" data-tab-id="${tab.id}">
          <img 
            class="tab-favicon" 
            src="${tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23e5e7eb"/></svg>'}" 
            onerror="this.src='data:image/svg+xml,<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;16&quot; height=&quot;16&quot; viewBox=&quot;0 0 16 16&quot;><rect width=&quot;16&quot; height=&quot;16&quot; fill=&quot;%23e5e7eb&quot;/></svg>'"
            alt="Tab icon"
          />
          <div class="tab-info">
            <div class="tab-title">${this.escapeHtml(tab.title || 'Untitled')}</div>
            <div class="tab-url">${this.escapeHtml(this.shortenUrl(tab.url || ''))}</div>
          </div>
          ${tab.audible ? '<div class="tab-audio-indicator" title="Audio playing"></div>' : ''}
        </div>
      `
      )
      .join('');

    // Add click listeners to tab items
    this.elements.tabList.querySelectorAll('.tab-item').forEach((item) => {
      item.addEventListener('click', () => {
        const tabId = parseInt(item.getAttribute('data-tab-id') || '0');
        this.selectTab(tabId);
      });
    });
  }

  private selectTab(tabId: number): void {
    // Remove previous selection
    this.elements.tabList.querySelectorAll('.tab-item').forEach((item) => {
      item.classList.remove('selected');
    });

    // Add selection to clicked tab
    const selectedItem = this.elements.tabList.querySelector(`[data-tab-id="${tabId}"]`);
    if (selectedItem) {
      selectedItem.classList.add('selected');
      this.selectedTabId = tabId;
      this.updateControlsState();
    }
  }

  private async toggleConnection(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.sendMessageToBackground('disconnect');
        this.updateConnectionStatus(false);
      } else {
        await this.sendMessageToBackground('connect');
        this.updateConnectionStatus(true);
      }
    } catch (error) {
      this.showError(`Connection failed: ${error}`);
    }
  }

  private async startRecording(): Promise<void> {
    if (!this.selectedTabId) {
      this.showError('Please select a tab to record');
      return;
    }

    try {
      const settings = this.getRecordingSettings();
      const response = await this.sendMessageToBackground('start-recording', {
        tabId: this.selectedTabId,
        settings,
      });

      this.currentSessionId = response.sessionId;
      this.updateRecordingStatus(true);
      this.hideError();
    } catch (error) {
      this.showError(`Failed to start recording: ${error}`);
    }
  }

  private async stopRecording(): Promise<void> {
    try {
      await this.sendMessageToBackground('stop-recording');
      this.updateRecordingStatus(false);
      this.currentSessionId = null;
    } catch (error) {
      this.showError(`Failed to stop recording: ${error}`);
    }
  }

  private getRecordingSettings(): any {
    const quality = this.elements.qualitySelect.value as 'low' | 'medium' | 'high';
    const formatKey = this.elements.formatSelect.value;
    
    let format;
    switch (formatKey) {
      case 'webm-opus':
        format = AUDIO_FORMATS.WEBM_OPUS;
        break;
      case 'webm-vorbis':
        format = AUDIO_FORMATS.WEBM_VORBIS;
        break;
      case 'mp4-aac':
        format = AUDIO_FORMATS.MP4_AAC;
        break;
      default:
        format = AUDIO_FORMATS.WEBM_OPUS;
    }

    return mergeRecordingSettings(DEFAULT_RECORDING_SETTINGS, {
      quality,
      format: {
        ...format,
        ...QUALITY_PRESETS[quality],
      },
    });
  }

  private updateConnectionStatus(connected: boolean): void {
    this.isConnected = connected;
    
    if (connected) {
      this.elements.connectionStatus.className = 'status connected';
      this.elements.connectionStatus.innerHTML = `
        <div class="status-indicator"></div>
        <span>Connected to backend</span>
      `;
      this.elements.connectBtn.textContent = 'Disconnect';
    } else {
      this.elements.connectionStatus.className = 'status disconnected';
      this.elements.connectionStatus.innerHTML = `
        <div class="status-indicator"></div>
        <span>Disconnected from backend</span>
      `;
      this.elements.connectBtn.textContent = 'Connect';
    }

    this.updateControlsState();
  }

  private updateRecordingStatus(recording: boolean): void {
    this.isRecording = recording;

    if (recording) {
      this.elements.connectionStatus.className = 'status recording';
      this.elements.connectionStatus.innerHTML = `
        <div class="status-indicator"></div>
        <span>Recording audio...</span>
      `;
    }

    this.updateControlsState();
  }

  private updateControlsState(): void {
    this.elements.recordBtn.disabled = !this.isConnected || this.isRecording || !this.selectedTabId;
    this.elements.stopBtn.disabled = !this.isRecording;
    this.elements.connectBtn.disabled = this.isRecording;
  }

  private handleBackgroundMessage(message: any): void {
    switch (message.type) {
      case 'connection-status':
        this.updateConnectionStatus(message.data.connected);
        break;

      case 'recording-started':
        this.updateRecordingStatus(true);
        break;

      case 'recording-stopped':
        this.updateRecordingStatus(false);
        break;

      case 'recording-status':
        if (message.data.status === 'completed') {
          this.showSuccess('Recording completed successfully!');
          this.updateRecordingStatus(false);
        }
        break;

      case 'error':
        this.showError(message.data.error);
        break;

      case 'tab-updated':
        this.loadTabs(); // Refresh tab list
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private async sendMessageToBackground(action: string, data?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action, ...data }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (response && response.success === false) {
          reject(new Error(response.error || 'Unknown error'));
        } else {
          resolve(response);
        }
      });
    });
  }

  private showError(message: string): void {
    this.elements.errorMessage.textContent = message;
    this.elements.errorMessage.style.display = 'block';
  }

  private hideError(): void {
    this.elements.errorMessage.style.display = 'none';
  }

  private showSuccess(message: string): void {
    // Create temporary success message
    const successElement = document.createElement('div');
    successElement.className = 'success';
    successElement.style.cssText = `
      padding: 12px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      color: #166534;
      font-size: 13px;
      margin-bottom: 16px;
    `;
    successElement.textContent = message;

    // Insert after error message
    this.elements.errorMessage.parentNode?.insertBefore(
      successElement,
      this.elements.errorMessage.nextSibling
    );

    // Auto-remove after 3 seconds
    setTimeout(() => {
      successElement.remove();
    }, 3000);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private shortenUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + urlObj.pathname;
    } catch {
      return url.length > 40 ? url.substring(0, 40) + '...' : url;
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});