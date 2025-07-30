import type { TabInfo, formatDuration, formatFileSize } from '@audio-tab-capture/shared';

interface SessionInfo {
  sessionId: string;
  tabId: number;
  status: string;
  startTime?: number;
  fileSize?: number;
}

class AudioCapturePopup {
  private tabs: TabInfo[] = [];
  private sessions: SessionInfo[] = [];
  private statusElement: HTMLElement;
  private tabListElement: HTMLElement;
  private sessionListElement: HTMLElement;

  constructor() {
    this.statusElement = document.getElementById('status')!;
    this.tabListElement = document.getElementById('tabList')!;
    this.sessionListElement = document.getElementById('sessionList')!;
    
    this.init();
  }

  private async init(): Promise<void> {
    await this.loadTabs();
    await this.loadSessions();
    this.setupMessageListener();
    
    // Refresh data periodically
    setInterval(() => {
      this.loadTabs();
      this.loadSessions();
    }, 2000);
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'session_status') {
        this.handleSessionStatusUpdate(message.payload);
      }
    });
  }

  private async loadTabs(): Promise<void> {
    try {
      const response = await this.sendMessage({ type: 'get_tabs' });
      if (response.success) {
        this.tabs = response.data as TabInfo[];
        this.renderTabs();
      }
    } catch (error) {
      console.error('Failed to load tabs:', error);
      this.showError('Failed to load tabs');
    }
  }

  private async loadSessions(): Promise<void> {
    try {
      const response = await this.sendMessage({ type: 'get_sessions' });
      if (response.success) {
        this.sessions = response.data as SessionInfo[];
        this.renderSessions();
        this.updateStatus();
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }

  private renderTabs(): void {
    if (this.tabs.length === 0) {
      this.tabListElement.innerHTML = `
        <div class="empty-state">
          No audible tabs found
        </div>
      `;
      return;
    }

    this.tabListElement.innerHTML = this.tabs.map(tab => {
      const isRecording = this.sessions.some(s => s.tabId === tab.id);
      const faviconUrl = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23666"/></svg>';
      
      return `
        <div class="tab-item ${isRecording ? 'recording' : ''}" data-tab-id="${tab.id}">
          <img src="${faviconUrl}" alt="" class="tab-favicon" onerror="this.src='data:image/svg+xml,<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; viewBox=&quot;0 0 16 16&quot;><rect width=&quot;16&quot; height=&quot;16&quot; fill=&quot;%23666&quot;/></svg>'">
          <div class="tab-info">
            <div class="tab-title">${this.escapeHtml(tab.title)}</div>
            <div class="tab-url">${this.escapeHtml(this.getDomain(tab.url))}</div>
          </div>
          <div class="tab-actions">
            ${isRecording 
              ? `<button class="btn btn-stop" data-action="stop" data-tab-id="${tab.id}">Stop</button>`
              : `<button class="btn btn-start" data-action="start" data-tab-id="${tab.id}">Record</button>`
            }
          </div>
        </div>
      `;
    }).join('');

    // Add event listeners
    this.tabListElement.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.classList.contains('btn')) {
        const action = target.dataset.action;
        const tabId = parseInt(target.dataset.tabId || '0');
        
        if (action === 'start') {
          this.startCapture(tabId);
        } else if (action === 'stop') {
          this.stopCapture(tabId);
        }
      }
    });
  }

  private renderSessions(): void {
    if (this.sessions.length === 0) {
      this.sessionListElement.innerHTML = `
        <div class="empty-state">No active recording sessions</div>
      `;
      return;
    }

    this.sessionListElement.innerHTML = this.sessions.map(session => {
      const tab = this.tabs.find(t => t.id === session.tabId);
      const tabTitle = tab?.title || `Tab ${session.tabId}`;
      const duration = session.startTime ? Date.now() - session.startTime : 0;
      
      return `
        <div class="session-item">
          <div class="session-info">
            <div class="session-title">${this.escapeHtml(tabTitle)}</div>
            <div class="session-status">${session.status}</div>
          </div>
          <div class="session-details">
            Duration: ${this.formatDuration(duration)}
            ${session.fileSize ? ` • Size: ${this.formatFileSize(session.fileSize)}` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  private updateStatus(): void {
    if (this.sessions.length === 0) {
      this.statusElement.className = 'status idle';
      this.statusElement.textContent = 'Ready to capture audio';
    } else {
      this.statusElement.className = 'status recording';
      this.statusElement.textContent = `Recording ${this.sessions.length} session${this.sessions.length === 1 ? '' : 's'}`;
    }
  }

  private async startCapture(tabId: number): Promise<void> {
    try {
      const button = document.querySelector(`button[data-action="start"][data-tab-id="${tabId}"]`) as HTMLButtonElement;
      if (button) {
        button.disabled = true;
        button.textContent = 'Starting...';
      }

      const response = await this.sendMessage({
        type: 'start_capture',
        payload: { tabId }
      });

      if (response.success) {
        await this.loadSessions();
        this.showSuccess('Recording started');
      } else {
        throw new Error(response.error || 'Failed to start capture');
      }
    } catch (error) {
      console.error('Failed to start capture:', error);
      this.showError(error instanceof Error ? error.message : 'Failed to start capture');
    } finally {
      await this.loadTabs(); // Refresh to update button states
    }
  }

  private async stopCapture(tabId: number): Promise<void> {
    try {
      const button = document.querySelector(`button[data-action="stop"][data-tab-id="${tabId}"]`) as HTMLButtonElement;
      if (button) {
        button.disabled = true;
        button.textContent = 'Stopping...';
      }

      const response = await this.sendMessage({
        type: 'stop_capture',
        payload: { tabId }
      });

      if (response.success) {
        await this.loadSessions();
        this.showSuccess('Recording stopped');
      } else {
        throw new Error(response.error || 'Failed to stop capture');
      }
    } catch (error) {
      console.error('Failed to stop capture:', error);
      this.showError(error instanceof Error ? error.message : 'Failed to stop capture');
    } finally {
      await this.loadTabs(); // Refresh to update button states
    }
  }

  private handleSessionStatusUpdate(payload: unknown): void {
    // Update session status in real-time
    this.loadSessions();
  }

  private sendMessage(message: unknown): Promise<{ success: boolean; data?: unknown; error?: string }> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, resolve);
    });
  }

  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  private getDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private showSuccess(message: string): void {
    // Could implement toast notifications here
    console.log('Success:', message);
  }

  private showError(message: string): void {
    // Could implement toast notifications here
    console.error('Error:', message);
  }
}

// Initialize popup when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new AudioCapturePopup();
  });
} else {
  new AudioCapturePopup();
}