import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { RecordingSettings } from '@audio-tab-capture/shared';

const RECORDINGS_DIR = 'recordings';

interface SessionData {
  chunks: Buffer[];
  settings: RecordingSettings;
  startTime: number;
  totalSize: number;
}

export class AudioProcessor {
  private sessions = new Map<string, SessionData>();
  private recordingsPath: string;

  constructor() {
    this.recordingsPath = path.join(process.cwd(), RECORDINGS_DIR);
    this.ensureDirectories();
  }

  private ensureDirectories() {
    if (!fs.existsSync(this.recordingsPath)) {
      fs.mkdirSync(this.recordingsPath, { recursive: true });
    }
  }

  public startSession(sessionId: string, settings: RecordingSettings) {
    console.log(`Starting audio processing session: ${sessionId}`);
    
    this.sessions.set(sessionId, {
      chunks: [],
      settings,
      startTime: Date.now(),
      totalSize: 0,
    });
  }

  public async processChunk(sessionId: string, chunk: Buffer): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Add chunk to buffer
    session.chunks.push(chunk);
    session.totalSize += chunk.length;

    console.log(`Processed chunk for session ${sessionId}: ${chunk.length} bytes (total: ${session.totalSize})`);

    // Optional: Write chunks to temporary file for large recordings
    if (session.totalSize > 10 * 1024 * 1024) { // 10MB threshold
      await this.flushChunksToTemp(sessionId);
    }
  }

  private async flushChunksToTemp(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.chunks.length === 0) {
      return;
    }

    const tempPath = path.join(this.recordingsPath, `${sessionId}.tmp`);
    const combinedBuffer = Buffer.concat(session.chunks);
    
    // Append to temporary file
    fs.appendFileSync(tempPath, combinedBuffer);
    
    // Clear chunks from memory
    session.chunks = [];
    
    console.log(`Flushed ${combinedBuffer.length} bytes to temp file for session ${sessionId}`);
  }

  public async finalizeSession(sessionId: string): Promise<{ filePath: string; fileSize: number }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    console.log(`Finalizing audio session: ${sessionId}`);

    const finalPath = path.join(this.recordingsPath, `${sessionId}.webm`);
    const tempPath = path.join(this.recordingsPath, `${sessionId}.tmp`);

    let finalBuffer: Buffer;

    // Combine remaining chunks with temp file if it exists
    if (fs.existsSync(tempPath)) {
      const tempBuffer = fs.readFileSync(tempPath);
      const remainingBuffer = Buffer.concat(session.chunks);
      finalBuffer = Buffer.concat([tempBuffer, remainingBuffer]);
      
      // Clean up temp file
      fs.unlinkSync(tempPath);
    } else {
      finalBuffer = Buffer.concat(session.chunks);
    }

    // Write final file
    fs.writeFileSync(finalPath, finalBuffer);

    // Create metadata file
    const metadataPath = path.join(this.recordingsPath, `${sessionId}.json`);
    const metadata = {
      sessionId,
      settings: session.settings,
      startTime: session.startTime,
      endTime: Date.now(),
      duration: Date.now() - session.startTime,
      fileSize: finalBuffer.length,
      chunkCount: session.chunks.length,
      filePath: finalPath,
    };
    
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    // Clean up session
    this.sessions.delete(sessionId);

    console.log(`Session ${sessionId} finalized: ${finalBuffer.length} bytes written to ${finalPath}`);

    return {
      filePath: finalPath,
      fileSize: finalBuffer.length,
    };
  }

  public getActiveSessionCount(): number {
    return this.sessions.size;
  }

  public getSessionInfo(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  public async cleanupSession(sessionId: string): Promise<void> {
    // Remove session from memory
    this.sessions.delete(sessionId);

    // Clean up any temporary files
    const tempPath = path.join(this.recordingsPath, `${sessionId}.tmp`);
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    console.log(`Cleaned up session: ${sessionId}`);
  }

  public async listRecordings(): Promise<any[]> {
    const recordings: any[] = [];
    
    try {
      const files = fs.readdirSync(this.recordingsPath);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const metadataPath = path.join(this.recordingsPath, file);
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
          recordings.push(metadata);
        }
      }
    } catch (error) {
      console.error('Error listing recordings:', error);
    }

    return recordings.sort((a, b) => b.startTime - a.startTime);
  }

  public async deleteRecording(sessionId: string): Promise<boolean> {
    try {
      const audioPath = path.join(this.recordingsPath, `${sessionId}.webm`);
      const metadataPath = path.join(this.recordingsPath, `${sessionId}.json`);
      
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
      
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
      }
      
      console.log(`Deleted recording: ${sessionId}`);
      return true;
    } catch (error) {
      console.error(`Error deleting recording ${sessionId}:`, error);
      return false;
    }
  }

  public getStorageStats(): { totalFiles: number; totalSize: number } {
    let totalFiles = 0;
    let totalSize = 0;

    try {
      const files = fs.readdirSync(this.recordingsPath);
      
      for (const file of files) {
        if (file.endsWith('.webm')) {
          const filePath = path.join(this.recordingsPath, file);
          const stats = fs.statSync(filePath);
          totalSize += stats.size;
          totalFiles++;
        }
      }
    } catch (error) {
      console.error('Error calculating storage stats:', error);
    }

    return { totalFiles, totalSize };
  }
}