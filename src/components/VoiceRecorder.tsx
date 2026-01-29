'use client';

import { useState, useRef, useEffect } from 'react';

interface VoiceRecorderProps {
  pin: string;
  projectId?: string;
  projectName?: string;
  compact?: boolean;
}

export function VoiceRecorder({ pin, projectId, projectName, compact = false }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const MAX_DURATION = 600; // 10 minutes

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    // Auto-stop at max duration
    if (recordingTime >= MAX_DURATION && isRecording) {
      stopRecording();
    }
  }, [recordingTime, isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await sendToTranscription(blob);
        
        // Cleanup stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);
      setStatus('idle');
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setStatus('error');
      setStatusMessage('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      chunksRef.current = []; // Clear chunks so nothing gets sent
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const sendToTranscription = async (blob: Blob) => {
    if (blob.size === 0) return; // Cancelled recording
    
    setIsProcessing(true);
    setStatus('idle');
    
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'voice-note.webm');
      if (projectId) formData.append('projectId', projectId);
      if (projectName) formData.append('projectName', projectName);
      
      const response = await fetch(`/api/voice?pin=${pin}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      setStatus('success');
      setStatusMessage(`Sent to Eric ✓`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setStatus('idle');
        setStatusMessage('');
      }, 3000);
      
    } catch (err) {
      console.error('Transcription error:', err);
      setStatus('error');
      setStatusMessage('Failed to send voice note');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
      {/* Status indicator */}
      {status === 'success' && (
        <span className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg text-center">
          {statusMessage}
        </span>
      )}
      {status === 'error' && (
        <span className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg text-center">
          {statusMessage}
        </span>
      )}
      
      {/* Recording UI */}
      {isRecording && (
        <div className="flex items-center justify-between gap-3 bg-red-50 px-3 py-2 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-red-600">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="font-mono">{formatTime(recordingTime)}</span>
          </div>
          <button
            onClick={cancelRecording}
            className="px-3 py-1 text-sm bg-white text-gray-700 rounded hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
      
      {/* Processing indicator */}
      {isProcessing && (
        <div className="flex items-center justify-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Transcribing...</span>
        </div>
      )}
      
      {/* Main record/stop button */}
      {!isProcessing && (
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`
            flex items-center justify-center gap-2 rounded-lg font-medium transition-all
            px-4 py-3 text-base w-full
            ${isRecording 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'}
          `}
        >
          {isRecording ? (
            <>
              <span className="w-3 h-3 bg-white rounded-sm" />
              Stop Recording
            </>
          ) : (
            <>
              🎤 Record Voice Note
            </>
          )}
        </button>
      )}
    </div>
  );
}
