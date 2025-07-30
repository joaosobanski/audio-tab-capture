import type {
  WebSocketMessage,
  SessionStartMessage,
  SessionEndMessage,
  AudioStreamMessage
} from './shared/types';
import {
  isSessionStartMessage,
  isSessionEndMessage,
  isAudioStreamMessage,
  formatDuration
} from './shared/utils';

interface SessionData {
  id: string;
  tabId: number;
  tabTitle: string;
  startTime: number;
  isActive: boolean;
  audioContext?: AudioContext;
  sourceNode?: MediaStreamAudioSourceNode;
  gainNode?: GainNode;
  isPlaying: boolean;
  volume: number;
}

class AudioTabCaptureDashboard {
  private websocket: WebSocket | null = null;
  private sessions: Map<string, SessionData> = new Map();
  private isConnected = false;
  private readonly wsUrl = 'ws://localhost:8080';
  private logContainer: HTMLElement | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    this.logContainer = document.getElementById('log-container');
    this.setupInitialTime();
    this.connectWebSocket();
    this.updateUI();
    this.fetchServerStats();
    
    // Update server stats every 30 seconds
    setInterval(() => this.fetchServerStats(), 30000);
    
    // Update session durations every second
    setInterval(() => this.updateSessionDurations(), 1000);
  }

  private setupInitialTime(): void {
    const timeEl = document.getElementById('initial-log-time');
    if (timeEl) {
      timeEl.textContent = new Date().toLocaleTimeString();
    }
  }

  private connectWebSocket(): void {
    try {
      this.websocket = new WebSocket(this.wsUrl);

      this.websocket.onopen = () => {
        this.isConnected = true;
        this.updateConnectionStatus();
        this.addLogEntry('Connected to WebSocket server', 'success');
      };

      this.websocket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.websocket.onclose = () => {
        this.isConnected = false;
        this.updateConnectionStatus();
        this.addLogEntry('WebSocket connection closed', 'error');
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.connectWebSocket(), 5000);
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.addLogEntry('WebSocket connection error', 'error');
      };

    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.addLogEntry('Failed to connect to WebSocket', 'error');
      setTimeout(() => this.connectWebSocket(), 5000);
    }
  }

  private handleWebSocketMessage(message: WebSocketMessage): void {
    if (isSessionStartMessage(message)) {
      this.handleSessionStart(message);
    } else if (isSessionEndMessage(message)) {
      this.handleSessionEnd(message);
    } else if (isAudioStreamMessage(message)) {
      this.handleAudioStream(message);
    } else if (message.type === 'active-sessions') {
      this.handleActiveSessions(message.data.sessions);
    }
  }

  private handleSessionStart(message: SessionStartMessage): void {
    const { sessionId, tabId, tabTitle } = message.data;
    
    const session: SessionData = {
      id: sessionId,
      tabId,
      tabTitle,
      startTime: Date.now(),
      isActive: true,
      isPlaying: false,
      volume: 0.5
    };

    this.sessions.set(sessionId, session);
    this.addLogEntry(`Session started: ${tabTitle}`, 'info');
    this.updateUI();
  }

  private handleSessionEnd(message: SessionEndMessage): void {
    const { sessionId } = message.data;
    const session = this.sessions.get(sessionId);
    
    if (session) {
      // Clean up audio context
      if (session.audioContext) {
        session.audioContext.close();
      }
      
      this.sessions.delete(sessionId);
      this.addLogEntry(`Session ended: ${session.tabTitle}`, 'info');
      this.updateUI();
    }
  }

  private async handleAudioStream(message: AudioStreamMessage): Promise<void> {
    const { sessionId, audioData } = message.data;
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.isPlaying) {
      return;
    }

    try {
      // Convert array back to ArrayBuffer
      const buffer = new Uint8Array(audioData).buffer;
      
      // Create audio context if not exists
      if (!session.audioContext) {
        session.audioContext = new AudioContext();
        session.gainNode = session.audioContext.createGain();
        session.gainNode.connect(session.audioContext.destination);
        session.gainNode.gain.value = session.volume;
      }

      // Decode and play audio
      const audioBuffer = await session.audioContext.decodeAudioData(buffer);
      const source = session.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(session.gainNode!);
      source.start();

    } catch (error) {
      console.error('Error playing audio stream:', error);
    }
  }

  private handleActiveSessions(sessions: any[]): void {
    // Update with existing sessions from server
    sessions.forEach(sessionData => {
      if (!this.sessions.has(sessionData.id)) {
        const session: SessionData = {
          id: sessionData.id,
          tabId: sessionData.tabId,
          tabTitle: sessionData.tabTitle,
          startTime: sessionData.startTime,
          isActive: true,
          isPlaying: false,
          volume: 0.5
        };
        this.sessions.set(sessionData.id, session);
      }
    });

    this.updateUI();
  }

  private updateUI(): void {
    this.updateSessionsList();
    this.updateSessionCount();
  }

  private updateSessionsList(): void {
    const container = document.getElementById('sessions-container');
    if (!container) return;

    const activeSessions = Array.from(this.sessions.values()).filter(s => s.isActive);

    if (activeSessions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No active sessions</h3>
          <p>Start capturing audio from a browser tab using the Chrome extension</p>
        </div>
      `;
      return;
    }

    container.innerHTML = activeSessions.map(session => this.createSessionHTML(session)).join('');

    // Add event listeners
    activeSessions.forEach(session => {
      this.attachSessionEventListeners(session);
    });
  }

  private createSessionHTML(session: SessionData): string {
    const duration = formatDuration(session.startTime);
    
    return `
      <div class="session-item ${session.isActive ? 'active' : ''}" data-session-id="${session.id}">
        <div class="session-header">
          <div class="session-title">${this.escapeHtml(session.tabTitle)}</div>
          <div class="session-duration">${duration}</div>
        </div>
        <div class="session-meta">
          <span>Tab ID: ${session.tabId}</span>
          <span>Session: ${session.id}</span>
        </div>
        <div class="audio-player">
          <div class="audio-controls">
            <button class="play-button" data-action="toggle-play" data-session-id="${session.id}">
              ${session.isPlaying ? 'Stop' : 'Play'}
            </button>
            <div class="volume-control">
              <span>Volume:</span>
              <input type="range" class="volume-slider" min="0" max="1" step="0.1" value="${session.volume}" 
                     data-action="volume" data-session-id="${session.id}">
              <span>${Math.round(session.volume * 100)}%</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private attachSessionEventListeners(session: SessionData): void {
    const playButton = document.querySelector(`[data-action="toggle-play"][data-session-id="${session.id}"]`) as HTMLButtonElement;
    const volumeSlider = document.querySelector(`[data-action="volume"][data-session-id="${session.id}"]`) as HTMLInputElement;

    if (playButton) {
      playButton.addEventListener('click', () => this.togglePlayback(session.id));
    }

    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        this.setVolume(session.id, parseFloat(target.value));
      });
    }
  }

  private togglePlayback(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.isPlaying = !session.isPlaying;
    this.updateUI();
    
    this.addLogEntry(
      `${session.isPlaying ? 'Started' : 'Stopped'} playback for: ${session.tabTitle}`,
      'info'
    );
  }

  private setVolume(sessionId: string, volume: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.volume = volume;
    
    if (session.gainNode) {
      session.gainNode.gain.value = volume;
    }

    // Update volume display
    const volumeSlider = document.querySelector(`[data-action="volume"][data-session-id="${sessionId}"]`) as HTMLInputElement;
    if (volumeSlider) {
      const volumeDisplay = volumeSlider.nextElementSibling;
      if (volumeDisplay) {
        volumeDisplay.textContent = `${Math.round(volume * 100)}%`;
      }
    }
  }

  private updateSessionDurations(): void {
    this.sessions.forEach(session => {
      const durationEl = document.querySelector(`[data-session-id="${session.id}"] .session-duration`);
      if (durationEl) {
        durationEl.textContent = formatDuration(session.startTime);
      }
    });
  }

  private updateConnectionStatus(): void {
    const statusDot = document.getElementById('connection-status');
    const statusText = document.getElementById('connection-text');

    if (statusDot && statusText) {
      if (this.isConnected) {
        statusDot.className = 'status-dot connected';
        statusText.textContent = 'Connected';
      } else {
        statusDot.className = 'status-dot';
        statusText.textContent = 'Disconnected';
      }
    }
  }

  private updateSessionCount(): void {
    const countEl = document.getElementById('session-count');
    if (countEl) {
      const activeCount = Array.from(this.sessions.values()).filter(s => s.isActive).length;
      countEl.textContent = activeCount.toString();
    }
  }

  private async fetchServerStats(): Promise<void> {
    try {
      const response = await fetch('/api/stats');
      if (response.ok) {
        const stats = await response.json();
        this.updateServerUptime(stats.uptime);
      }
    } catch (error) {
      console.error('Error fetching server stats:', error);
    }
  }

  private updateServerUptime(uptime: number): void {
    const uptimeEl = document.getElementById('server-uptime');
    if (uptimeEl) {
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      uptimeEl.textContent = `${hours}h ${minutes}m`;
    }
  }

  private addLogEntry(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    if (!this.logContainer) return;

    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    
    const timestamp = new Date().toLocaleTimeString();
    logEntry.innerHTML = `
      <div class="log-timestamp">${timestamp}</div>
      <div>${this.escapeHtml(message)}</div>
    `;

    this.logContainer.insertBefore(logEntry, this.logContainer.firstChild);

    // Keep only last 50 log entries
    const entries = this.logContainer.querySelectorAll('.log-entry');
    if (entries.length > 50) {
      entries[entries.length - 1].remove();
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new AudioTabCaptureDashboard();
});