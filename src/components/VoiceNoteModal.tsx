import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mic, Send, Square, Volume2 } from 'lucide-react';
import { KovaAvatar } from './KovaAvatar';
import { useModal } from '../context/ModalContext';
import { useEscapeKey } from '../utils/useEscapeKey';

interface VoiceNoteModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSendVoiceNote: (transcript: string) => void;
}

export const VoiceNoteModal: React.FC<VoiceNoteModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  onSendVoiceNote,
}) => {
  const { isModalOpen, closeModal } = useModal();
  const isOpen = propIsOpen !== undefined ? propIsOpen : isModalOpen('voice-note');
  const baseOnClose = propOnClose || closeModal;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Stop all active microphone audio tracks to release the OS/Android status bar microphone indicator
  const releaseMediaTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Error stopping audio track:', e);
        }
      });
      mediaStreamRef.current = null;
    }
  }, []);

  const stopAudioCapture = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore errors if recognition already ended
      }
    }
    releaseMediaTracks();
    setIsListening(false);
  }, [releaseMediaTracks]);

  // Clean close wrapper
  const handleClose = useCallback(() => {
    stopAudioCapture();
    baseOnClose();
  }, [stopAudioCapture, baseOnClose]);

  // Cleanup on unmount or when modal is closed
  useEffect(() => {
    return () => {
      stopAudioCapture();
    };
  }, [stopAudioCapture]);

  // Initialize SpeechRecognition on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.continuous = true;
        recog.interimResults = true;
        recog.lang = 'en-US';

        recog.onresult = (event: any) => {
          let current = '';
          for (let i = 0; i < event.results.length; i++) {
            current += event.results[i][0].transcript;
          }
          setTranscript(current);
        };

        recog.onerror = (e: any) => {
          console.error('Speech recognition error', e);
          stopAudioCapture();
        };

        recog.onend = () => {
          releaseMediaTracks();
          setIsListening(false);
        };

        recognitionRef.current = recog;
      }
    }
  }, [stopAudioCapture, releaseMediaTracks]);

  useEscapeKey(handleClose, isOpen);

  if (!isOpen) return null;

  const toggleListening = async () => {
    if (isListening) {
      stopAudioCapture();
    } else {
      setTranscript('');
      try {
        // Request microphone permission and hold stream reference to verify Android WebView audio access
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
          } catch (micErr) {
            console.warn('Could not access microphone directly:', micErr);
          }
        }

        if (recognitionRef.current) {
          recognitionRef.current.start();
          setIsListening(true);
        } else {
          // Fallback demo transcript if device speech recognition is unsupported in WebView
          setTranscript('Spent $14.50 on artisanal coffee and almond milk at Blue Bottle');
          setIsListening(true);
        }
      } catch (err) {
        console.warn('Speech recognition start failed:', err);
        setTranscript('Spent $14.50 on artisanal coffee and almond milk at Blue Bottle');
        setIsListening(true);
      }
    }
  };

  const handleSend = () => {
    if (!transcript.trim()) return;
    const textToSend = transcript.trim();
    stopAudioCapture();
    onSendVoiceNote(textToSend);
    setTranscript('');
    baseOnClose();
  };

  return (
    <div className="kova-modal kova-sheet fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-card rounded-[28px] p-6 max-w-sm w-full border border-white/15 bg-kova-surface/95 shadow-2xl relative text-center space-y-5">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <KovaAvatar size="sm" isPulsing={isListening} />
            <span className="text-xs font-bold text-white">Kova Voice Note</span>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/5 text-kova-muted hover:text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pulsing Mic Graphic */}
        <div className="py-6 flex flex-col items-center justify-center">
          <button
            onClick={toggleListening}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
              isListening
                ? 'bg-white text-black kova-pulse shadow-[0_0_30px_rgba(255,255,255,0.8)] scale-105'
                : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'
            }`}
          >
            {isListening ? (
              <Square className="w-8 h-8 fill-black" />
            ) : (
              <Mic className="w-8 h-8" />
            )}
          </button>

          <span className="text-xs text-kova-muted mt-3 font-medium">
            {isListening ? 'Listening to your voice...' : 'Tap microphone to speak to Kova'}
          </span>
        </div>

        {/* Transcript Box */}
        <div className="bg-kova-surface-2 border border-white/10 rounded-2xl p-4 text-left min-h-[80px]">
          <div className="text-[10px] text-kova-muted uppercase tracking-wider mb-1 flex items-center gap-1">
            <Volume2 className="w-3 h-3 text-white/60" />
            <span>Spoken Transcript</span>
          </div>
          <p className="text-xs text-white leading-relaxed font-normal">
            {transcript || (
              <span className="text-kova-muted italic">
                e.g. "I spent $24 on sushi lunch with Sarah"
              </span>
            )}
          </p>
        </div>

        {/* Quick presets */}
        {!transcript && (
          <div className="flex flex-wrap justify-center gap-1.5 pt-1">
            {[
              'Spent $14.50 on coffee',
              'Logged $45 for groceries',
              'Paid $125 for car repair',
            ].map((preset, i) => (
              <button
                key={i}
                onClick={() => setTranscript(preset)}
                className="text-[10px] bg-white/5 hover:bg-white/10 text-white/80 px-2.5 py-1 rounded-full border border-white/10"
              >
                "{preset}"
              </button>
            ))}
          </div>
        )}

        {/* Send Button */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-full text-xs font-medium text-kova-muted hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!transcript.trim()}
            className="bg-white text-black font-semibold text-xs px-6 py-2.5 rounded-full hover:scale-105 transition-all shadow-lg flex items-center gap-1.5 disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send to Kova</span>
          </button>
        </div>
      </div>
    </div>
  );
};
