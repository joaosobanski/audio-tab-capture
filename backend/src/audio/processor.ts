import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { 
  AudioSession, 
  AudioFormat, 
  AudioChunk, 
  DownloadInfo,
  generateFilename,
  CONSTANTS
} from '@audio-tab-capture/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class AudioProcessor {
  private sessions = new Map<string, AudioSession>();
  private audioChunks = new Map<string, Map<number, ArrayBuffer>>();
  private storageDir: string;

  constructor() {
    this.storageDir = join(__dirname, '../../storage');
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      console.error('Failed to initialize storage directory:', error);
    }
  }

  async startSession(
    sessionId: string,
    tabId: number,
    tabTitle: string,
    audioFormat: AudioFormat
  ): Promise<AudioSession> {
    const session: AudioSession = {
      id: sessionId,
      tabId,
      tabTitle,
      startTime: new Date(),
      status: 'recording',
      audioFormat,
    };

    this.sessions.set(sessionId, session);
    this.audioChunks.set(sessionId, new Map());

    console.log(`Started audio session ${sessionId} for tab ${tabId}: ${tabTitle}`);
    return session;
  }

  async stopSession(sessionId: string): Promise<AudioSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = 'stopped';
    session.endTime = new Date();

    // Process and save audio file
    await this.finalizeAudioFile(sessionId);

    console.log(`Stopped audio session ${sessionId}`);
    return session;
  }

  async pauseSession(sessionId: string): Promise<AudioSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = 'paused';
    console.log(`Paused audio session ${sessionId}`);
    return session;
  }

  async resumeSession(sessionId: string): Promise<AudioSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = 'recording';
    console.log(`Resumed audio session ${sessionId}`);
    return session;
  }

  async processAudioChunk(chunk: AudioChunk): Promise<void> {
    const chunks = this.audioChunks.get(chunk.sessionId);
    if (!chunks) {
      throw new Error(`Session ${chunk.sessionId} not found`);
    }

    chunks.set(chunk.sequenceNumber, chunk.data);

    // Check if this is the last chunk
    if (chunk.isLast) {
      await this.finalizeAudioFile(chunk.sessionId);
    }
  }

  private async finalizeAudioFile(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    const chunks = this.audioChunks.get(sessionId);
    
    if (!session || !chunks) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      const { generateFilename } = await import('@audio-tab-capture/shared');
      const filename = generateFilename(session.tabTitle, session.audioFormat.codec);
      const filePath = join(this.storageDir, filename);

      // Sort chunks by sequence number and combine
      const sortedChunks = Array.from(chunks.entries())
        .sort(([a], [b]) => a - b)
        .map(([, data]) => data);

      // Calculate total size
      const totalSize = sortedChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      
      const { CONSTANTS } = await import('@audio-tab-capture/shared');
      if (totalSize > CONSTANTS.MAX_FILE_SIZE) {
        throw new Error('Audio file exceeds maximum size limit');
      }

      // Combine all chunks into a single buffer
      const combinedBuffer = new Uint8Array(totalSize);
      let offset = 0;
      
      for (const chunk of sortedChunks) {
        combinedBuffer.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }

      // Write to file
      await fs.writeFile(filePath, combinedBuffer);

      // Store filename in session
      (session as AudioSession & { filename?: string }).filename = filename;

      console.log(`Saved audio file: ${filename} (${totalSize} bytes)`);
    } catch (error) {
      session.status = 'error';
      console.error(`Failed to finalize audio file for session ${sessionId}:`, error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<AudioSession | undefined> {
    return this.sessions.get(sessionId);
  }

  async getAllSessions(): Promise<AudioSession[]> {
    return Array.from(this.sessions.values());
  }

  async getDownloadInfo(sessionId: string): Promise<DownloadInfo | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'stopped') {
      return undefined;
    }

    const filename = (session as AudioSession & { filename?: string }).filename;
    if (!filename) {
      return undefined;
    }

    const filePath = join(this.storageDir, filename);
    try {
      const stats = await fs.stat(filePath);
      return {
        sessionId,
        filename,
        fileSize: stats.size,
        downloadUrl: `/api/files/${filename}`,
      };
    } catch {
      return undefined;
    }
  }

  async getFilePath(filename: string): Promise<string | undefined> {
    const filePath = join(this.storageDir, filename);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      return undefined;
    }
  }

  async getSessionFileSize(sessionId: string): Promise<number> {
    const chunks = this.audioChunks.get(sessionId);
    if (!chunks) {
      return 0;
    }

    return Array.from(chunks.values()).reduce(
      (sum, chunk) => sum + chunk.byteLength,
      0
    );
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Delete audio file if it exists
    const filename = (session as AudioSession & { filename?: string }).filename;
    if (filename) {
      const filePath = join(this.storageDir, filename);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.error(`Failed to delete file ${filename}:`, error);
      }
    }

    // Clean up memory
    this.sessions.delete(sessionId);
    this.audioChunks.delete(sessionId);

    console.log(`Deleted session ${sessionId}`);
    return true;
  }
}