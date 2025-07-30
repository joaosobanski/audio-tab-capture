export declare function generateSessionId(): string;
export declare function validateTabId(tabId: any): boolean;
import { WebSocketMessage, AudioStreamMessage, SessionStartMessage, SessionEndMessage } from './types';
export declare function createWebSocketMessage<T extends WebSocketMessage>(type: T['type'], data?: T['data']): T;
export declare function isAudioStreamMessage(message: any): message is AudioStreamMessage;
export declare function isSessionStartMessage(message: any): message is SessionStartMessage;
export declare function isSessionEndMessage(message: any): message is SessionEndMessage;
export declare function formatDuration(startTime: number, endTime?: number): string;
//# sourceMappingURL=utils.d.ts.map