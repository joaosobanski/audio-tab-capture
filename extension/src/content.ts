// Content script for audio tab capture
// This script runs in the context of web pages

interface ContentMessage {
  type: string;
  payload?: unknown;
}

class AudioTabCaptureContent {
  private isInjected = false;

  constructor() {
    this.init();
  }

  private init(): void {
    // Prevent multiple injections
    if (this.isInjected) {
      return;
    }
    this.isInjected = true;

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      this.handleMessage(message, sendResponse);
      return true;
    });

    // Inject audio capture capabilities if needed
    this.injectAudioCapture();

    console.log('Audio Tab Capture content script loaded');
  }

  private handleMessage(message: ContentMessage, sendResponse: (response: unknown) => void): void {
    try {
      switch (message.type) {
        case 'check_audio':
          const hasAudio = this.checkForAudioElements();
          sendResponse({ success: true, hasAudio });
          break;

        case 'get_page_info':
          const pageInfo = this.getPageInfo();
          sendResponse({ success: true, data: pageInfo });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  private checkForAudioElements(): boolean {
    // Check for audio/video elements
    const audioElements = document.querySelectorAll('audio, video');
    const hasAudioElements = audioElements.length > 0;

    // Check for Web Audio API usage
    const hasWebAudio = 'AudioContext' in window || 'webkitAudioContext' in window;

    // Check for media elements that might be playing
    const playingMedia = Array.from(audioElements).some(
      element => !element.paused && !element.muted
    );

    return hasAudioElements || hasWebAudio || playingMedia;
  }

  private getPageInfo(): {
    title: string;
    url: string;
    hasAudio: boolean;
    audioElements: number;
    videoElements: number;
  } {
    const audioElements = document.querySelectorAll('audio');
    const videoElements = document.querySelectorAll('video');
    
    return {
      title: document.title,
      url: window.location.href,
      hasAudio: this.checkForAudioElements(),
      audioElements: audioElements.length,
      videoElements: videoElements.length,
    };
  }

  private injectAudioCapture(): void {
    // Monitor for audio/video elements being added
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.tagName === 'AUDIO' || element.tagName === 'VIDEO') {
              console.log('New audio/video element detected:', element);
              this.enhanceMediaElement(element as HTMLMediaElement);
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Enhance existing media elements
    document.querySelectorAll('audio, video').forEach((element) => {
      this.enhanceMediaElement(element as HTMLMediaElement);
    });
  }

  private enhanceMediaElement(element: HTMLMediaElement): void {
    // Add event listeners to track playback
    element.addEventListener('play', () => {
      console.log('Media element started playing:', element.src || element.currentSrc);
      
      // Notify background script about audio activity
      chrome.runtime.sendMessage({
        type: 'media_play',
        payload: {
          src: element.src || element.currentSrc,
          type: element.tagName.toLowerCase(),
          currentTime: element.currentTime,
          duration: element.duration,
        },
      }).catch(() => {
        // Background script might not be ready, ignore
      });
    });

    element.addEventListener('pause', () => {
      console.log('Media element paused:', element.src || element.currentSrc);
      
      chrome.runtime.sendMessage({
        type: 'media_pause',
        payload: {
          src: element.src || element.currentSrc,
          type: element.tagName.toLowerCase(),
          currentTime: element.currentTime,
        },
      }).catch(() => {
        // Background script might not be ready, ignore
      });
    });

    element.addEventListener('ended', () => {
      console.log('Media element ended:', element.src || element.currentSrc);
      
      chrome.runtime.sendMessage({
        type: 'media_ended',
        payload: {
          src: element.src || element.currentSrc,
          type: element.tagName.toLowerCase(),
        },
      }).catch(() => {
        // Background script might not be ready, ignore
      });
    });
  }
}

// Initialize content script
new AudioTabCaptureContent();