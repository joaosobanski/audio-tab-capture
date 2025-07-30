import { AudioFormat, RecordingSettings } from './types';

// Audio format constants
export const AUDIO_FORMATS: Record<string, AudioFormat> = {
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

// Quality presets
export const QUALITY_PRESETS: Record<string, Partial<AudioFormat>> = {
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

// Default settings
export const DEFAULT_RECORDING_SETTINGS: RecordingSettings = {
  format: AUDIO_FORMATS.WEBM_OPUS,
  quality: 'medium',
  chunkDuration: 1500, // 1.5 seconds
  maxDuration: 3600000, // 1 hour
};

// WebSocket constants
export const WS_RECONNECT_INTERVAL = 3000;
export const WS_MAX_RECONNECT_ATTEMPTS = 5;
export const WS_HEARTBEAT_INTERVAL = 30000;

// File storage constants
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const RECORDINGS_DIR = 'recordings';
export const TEMP_DIR = 'temp';

// Utility functions
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function formatDuration(milliseconds: number): string {
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

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function isValidAudioFormat(mimeType: string): boolean {
  return Object.values(AUDIO_FORMATS).some(format => format.mimeType === mimeType);
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9.-]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function validateRecordingSettings(settings: Partial<RecordingSettings>): string[] {
  const errors: string[] = [];

  if (settings.chunkDuration && (settings.chunkDuration < 500 || settings.chunkDuration > 5000)) {
    errors.push('Chunk duration must be between 500ms and 5000ms');
  }

  if (settings.maxDuration && settings.maxDuration > 7200000) {
    // 2 hours max
    errors.push('Maximum recording duration cannot exceed 2 hours');
  }

  if (settings.format && !isValidAudioFormat(settings.format.mimeType)) {
    errors.push('Invalid audio format specified');
  }

  return errors;
}

export function mergeRecordingSettings(
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

export function createTimestamp(): number {
  return Date.now();
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}