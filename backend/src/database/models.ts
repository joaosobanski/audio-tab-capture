import mongoose, { Schema, Document, Model } from 'mongoose';
import type { AudioSession, AudioFormat } from '@audio-tab-capture/shared';

// Extend AudioSession to include MongoDB-specific fields
export interface AudioSessionDocument extends Omit<AudioSession, 'id'>, Document {
  id: string; // Override the Document id
  audioData?: Buffer;
  createdAt: Date;
  updatedAt: Date;
  toAudioSession(): AudioSession;
}

const audioFormatSchema = new Schema<AudioFormat>({
  sampleRate: { type: Number, required: true },
  channels: { type: Number, required: true },
  bitDepth: { type: Number, required: true },
  codec: { 
    type: String, 
    required: true, 
    enum: ['webm', 'wav', 'mp3'] 
  },
}, { _id: false });

const audioSessionSchema = new Schema<AudioSessionDocument>({
  id: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  tabId: { 
    type: Number, 
    required: true 
  },
  tabTitle: { 
    type: String, 
    required: true 
  },
  startTime: { 
    type: Date, 
    required: true 
  },
  endTime: { 
    type: Date 
  },
  status: { 
    type: String, 
    required: true, 
    enum: ['recording', 'paused', 'stopped', 'error'],
    default: 'recording'
  },
  audioFormat: { 
    type: audioFormatSchema, 
    required: true 
  },
  audioData: { 
    type: Buffer 
  },
}, {
  timestamps: true,
  collection: 'audioSessions'
});

// Indexes for better query performance
audioSessionSchema.index({ status: 1 });
audioSessionSchema.index({ startTime: -1 });
audioSessionSchema.index({ tabId: 1 });

// Instance methods
audioSessionSchema.methods.toAudioSession = function(): AudioSession {
  return {
    id: this.id,
    tabId: this.tabId,
    tabTitle: this.tabTitle,
    startTime: this.startTime,
    endTime: this.endTime,
    status: this.status,
    audioFormat: this.audioFormat,
  };
};

// Static methods
audioSessionSchema.statics.findBySessionId = function(sessionId: string) {
  return this.findOne({ id: sessionId });
};

audioSessionSchema.statics.findActiveSessions = function() {
  return this.find({ status: { $in: ['recording', 'paused'] } });
};

audioSessionSchema.statics.findCompletedSessions = function() {
  return this.find({ status: 'stopped' });
};

// Virtual for file size
audioSessionSchema.virtual('fileSize').get(function() {
  return this.audioData ? this.audioData.length : 0;
});

// Ensure virtual fields are serialized
audioSessionSchema.set('toJSON', { virtuals: true });
audioSessionSchema.set('toObject', { virtuals: true });

// Interface for static methods
interface AudioSessionModel extends Model<AudioSessionDocument> {
  findBySessionId(sessionId: string): Promise<AudioSessionDocument | null>;
  findActiveSessions(): Promise<AudioSessionDocument[]>;
  findCompletedSessions(): Promise<AudioSessionDocument[]>;
}

export const AudioSessionModel = mongoose.model<AudioSessionDocument, AudioSessionModel>(
  'AudioSession', 
  audioSessionSchema
);