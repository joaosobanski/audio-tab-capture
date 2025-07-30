import type { 
  AudioSession, 
  AudioFormat, 
  AudioChunk, 
  DownloadInfo,
  generateFilename,
  CONSTANTS
} from '@audio-tab-capture/shared';
import { AudioSessionModel, type AudioSessionDocument } from '../database/models.js';

export class AudioProcessor {
  private audioChunks = new Map<string, Map<number, ArrayBuffer>>();

  constructor() {
    // No need for storage directory initialization with MongoDB
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

    // Create session in MongoDB
    const sessionDoc = new AudioSessionModel(session);
    await sessionDoc.save();

    this.audioChunks.set(sessionId, new Map());

    console.log(`Started audio session ${sessionId} for tab ${tabId}: ${tabTitle}`);
    return session;
  }

  async stopSession(sessionId: string): Promise<AudioSession> {
    const sessionDoc = await AudioSessionModel.findBySessionId(sessionId);
    if (!sessionDoc) {
      throw new Error(`Session ${sessionId} not found`);
    }

    sessionDoc.status = 'stopped';
    sessionDoc.endTime = new Date();

    // Process and save audio file as blob
    await this.finalizeAudioFile(sessionId);

    await sessionDoc.save();

    console.log(`Stopped audio session ${sessionId}`);
    return sessionDoc.toAudioSession();
  }

  async pauseSession(sessionId: string): Promise<AudioSession> {
    const sessionDoc = await AudioSessionModel.findBySessionId(sessionId);
    if (!sessionDoc) {
      throw new Error(`Session ${sessionId} not found`);
    }

    sessionDoc.status = 'paused';
    await sessionDoc.save();

    console.log(`Paused audio session ${sessionId}`);
    return sessionDoc.toAudioSession();
  }

  async resumeSession(sessionId: string): Promise<AudioSession> {
    const sessionDoc = await AudioSessionModel.findBySessionId(sessionId);
    if (!sessionDoc) {
      throw new Error(`Session ${sessionId} not found`);
    }

    sessionDoc.status = 'recording';
    await sessionDoc.save();

    console.log(`Resumed audio session ${sessionId}`);
    return sessionDoc.toAudioSession();
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
    const sessionDoc = await AudioSessionModel.findBySessionId(sessionId);
    const chunks = this.audioChunks.get(sessionId);
    
    if (!sessionDoc || !chunks) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
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

      // Store binary data in MongoDB
      sessionDoc.audioData = Buffer.from(combinedBuffer);
      await sessionDoc.save();

      console.log(`Saved audio data to MongoDB: ${sessionId} (${totalSize} bytes)`);
    } catch (error) {
      sessionDoc.status = 'error';
      await sessionDoc.save();
      console.error(`Failed to finalize audio file for session ${sessionId}:`, error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<AudioSession | undefined> {
    const sessionDoc = await AudioSessionModel.findBySessionId(sessionId);
    return sessionDoc?.toAudioSession();
  }

  async getAllSessions(): Promise<AudioSession[]> {
    const sessionDocs = await AudioSessionModel.find().sort({ startTime: -1 });
    return sessionDocs.map(doc => doc.toAudioSession());
  }

  async getDownloadInfo(sessionId: string): Promise<DownloadInfo | undefined> {
    const sessionDoc = await AudioSessionModel.findBySessionId(sessionId);
    if (!sessionDoc || sessionDoc.status !== 'stopped' || !sessionDoc.audioData) {
      return undefined;
    }

    const { generateFilename } = await import('@audio-tab-capture/shared');
    const filename = generateFilename(sessionDoc.tabTitle, sessionDoc.audioFormat.codec);

    return {
      sessionId,
      filename,
      fileSize: sessionDoc.audioData.length,
      downloadUrl: `/api/files/${sessionId}`,
    };
  }

  async getAudioData(sessionId: string): Promise<Buffer | undefined> {
    const sessionDoc = await AudioSessionModel.findBySessionId(sessionId);
    return sessionDoc?.audioData;
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
    const sessionDoc = await AudioSessionModel.findBySessionId(sessionId);
    if (!sessionDoc) {
      return false;
    }

    // Delete from database
    await AudioSessionModel.deleteOne({ id: sessionId });

    // Clean up memory
    this.audioChunks.delete(sessionId);

    console.log(`Deleted session ${sessionId}`);
    return true;
  }
}