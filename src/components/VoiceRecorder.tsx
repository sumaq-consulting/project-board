'use client';

import { useState, useRef, useEffect } from 'react';

interface VoiceRecorderProps {
  pin: string;
}

export function VoiceRecorder({ pin }: VoiceRecorderProps) {
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
    <div className="flex items-center gap-2">
      {/* Status indicator */}
      {status === 'success' && (
        <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded animate-fade-in">
          {statusMessage}
        </span>
      )}
      {status === 'error' && (
        <span className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded">
          {statusMessage}
        </span>
      )}
      
      {/* Recording timer */}
      {isRecording && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span>{formatTime(recordingTime)} / {formatTime(MAX_DURATION)}</span>
        </div>
      )}
      
      {/* Processing indicator */}
      {isProcessing && (
        <span className="text-sm text-blue-600">
          Sending...
        </span>
      )}
      
      {/* Cancel button (during recording) */}
      {isRecording && (
        <button
          onClick={cancelRecording}
          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      )}
      
      {/* Main record/stop button */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all
          ${isRecording 
            ? 'bg-red-500 hover:bg-red-600 text-white' 
            : 'bg-blue-500 hover:bg-blue-600 text-white'}
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {isRecording ? (
          <>
            <span className="w-3 h-3 bg-white rounded-sm" />
            Stop
          </>
        ) : (
          <>
            🎤 Voice Note
          </>
        )}
      </button>
    </div>
  );
}
