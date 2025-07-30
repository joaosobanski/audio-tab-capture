"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSessionId = generateSessionId;
exports.validateTabId = validateTabId;
exports.createWebSocketMessage = createWebSocketMessage;
exports.isAudioStreamMessage = isAudioStreamMessage;
exports.isSessionStartMessage = isSessionStartMessage;
exports.isSessionEndMessage = isSessionEndMessage;
exports.formatDuration = formatDuration;
function generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
function validateTabId(tabId) {
    return typeof tabId === 'number' && tabId > 0;
}
function createWebSocketMessage(type, data) {
    return {
        type,
        data,
        timestamp: Date.now()
    };
}
function isAudioStreamMessage(message) {
    return message?.type === 'audio-stream' && message?.data?.audioData && message?.data?.tabId;
}
function isSessionStartMessage(message) {
    return message?.type === 'session-start' && message?.data?.tabId && message?.data?.sessionId;
}
function isSessionEndMessage(message) {
    return message?.type === 'session-end' && message?.data?.sessionId;
}
function formatDuration(startTime, endTime) {
    const duration = (endTime || Date.now()) - startTime;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
        return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}
//# sourceMappingURL=utils.js.map