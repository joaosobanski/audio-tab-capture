import { ExtensionState, TabInfo } from '../shared/types';
import { formatDuration } from '../shared/utils';

class PopupManager {
  private state: ExtensionState | null = null;
  private durationInterval: number | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    await this.loadState();
    this.setupEventListeners();
    this.updateUI();
    this.checkServerStatus();
  }

  private async loadState(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'get-state' });
      if (response && response.state) {
        this.state = response.state;
      }
    } catch (error) {
      console.error('Error loading state:', error);
    }
  }

  private setupEventListeners(): void {
    const stopCaptureBtn = document.getElementById('stop-capture');
    if (stopCaptureBtn) {
      stopCaptureBtn.addEventListener('click', () => this.stopCapture());
    }
  }

  private updateUI(): void {
    if (!this.state) {
      this.showLoading();
      return;
    }

    if (this.state.isCapturing && this.state.currentSession) {
      this.showCaptureSession();
    } else if (this.state.availableTabs.length > 0) {
      this.showTabsList();
    } else {
      this.showNoTabs();
    }

    this.updateStatusIndicator();
  }

  private showLoading(): void {
    this.hideAllSections();
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'block';
  }

  private showNoTabs(): void {
    this.hideAllSections();
    const noTabsEl = document.getElementById('no-tabs');
    if (noTabsEl) noTabsEl.style.display = 'block';
  }

  private showTabsList(): void {
    this.hideAllSections();
    const tabsListEl = document.getElementById('tabs-list');
    if (tabsListEl) tabsListEl.style.display = 'block';

    this.renderTabs();
  }

  private showCaptureSession(): void {
    this.hideAllSections();
    const captureSessionEl = document.getElementById('capture-session');
    if (captureSessionEl) captureSessionEl.style.display = 'block';

    if (this.state?.currentSession) {
      const titleEl = document.getElementById('session-title');
      if (titleEl) titleEl.textContent = this.state.currentSession.tabTitle;

      this.startDurationTimer();
    }
  }

  private hideAllSections(): void {
    const sections = ['loading', 'no-tabs', 'tabs-list', 'capture-session'];
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  private renderTabs(): void {
    const container = document.getElementById('tabs-container');
    if (!container || !this.state) return;

    container.innerHTML = '';

    this.state.availableTabs.forEach(tab => {
      const tabEl = this.createTabElement(tab);
      container.appendChild(tabEl);
    });
  }

  private createTabElement(tab: TabInfo): HTMLElement {
    const tabEl = document.createElement('div');
    tabEl.className = `tab-item ${tab.isActive ? 'active' : ''}`;
    tabEl.onclick = () => this.startCapture(tab.id);

    tabEl.innerHTML = `
      <div class="tab-title">${this.escapeHtml(tab.title)}</div>
      <div class="tab-url">${this.escapeHtml(tab.url)}</div>
      ${tab.hasAudio ? '<div class="tab-audio-indicator">Audio playing</div>' : ''}
    `;

    return tabEl;
  }

  private async startCapture(tabId: number): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ 
        type: 'start-capture', 
        tabId 
      });

      if (response.success) {
        await this.loadState();
        this.updateUI();
      } else {
        console.error('Failed to start capture:', response.error);
        this.showError(response.error || 'Failed to start capture');
      }
    } catch (error) {
      console.error('Error starting capture:', error);
      this.showError('Error starting capture');
    }
  }

  private async stopCapture(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'stop-capture' });

      if (response.success) {
        await this.loadState();
        this.updateUI();
        this.stopDurationTimer();
      } else {
        console.error('Failed to stop capture');
      }
    } catch (error) {
      console.error('Error stopping capture:', error);
    }
  }

  private startDurationTimer(): void {
    this.stopDurationTimer();
    
    if (!this.state?.currentSession) return;

    const updateDuration = () => {
      if (this.state?.currentSession) {
        const duration = formatDuration(this.state.currentSession.startTime);
        const durationEl = document.getElementById('session-duration');
        if (durationEl) durationEl.textContent = duration;
      }
    };

    updateDuration();
    this.durationInterval = window.setInterval(updateDuration, 1000);
  }

  private stopDurationTimer(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  private updateStatusIndicator(): void {
    const statusEl = document.getElementById('status');
    if (!statusEl) return;

    if (this.state?.isCapturing) {
      statusEl.className = 'status-indicator capturing';
    } else {
      statusEl.className = 'status-indicator';
    }
  }

  private async checkServerStatus(): Promise<void> {
    const statusEl = document.getElementById('server-status');
    if (!statusEl) return;

    try {
      const response = await fetch('http://localhost:3000/health');
      if (response.ok) {
        statusEl.textContent = 'Connected to server';
        statusEl.className = 'server-status connected';
      } else {
        throw new Error('Server not responding');
      }
    } catch (error) {
      statusEl.textContent = 'Server disconnected';
      statusEl.className = 'server-status disconnected';
    }
  }

  private showError(message: string): void {
    // You could implement a toast/notification system here
    console.error(message);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});