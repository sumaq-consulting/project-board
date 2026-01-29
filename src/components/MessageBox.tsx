'use client';

import { useState } from 'react';

interface MessageBoxProps {
  pin: string;
  projectId?: string;
  projectName?: string;
}

export function MessageBox({ pin, projectId, projectName }: MessageBoxProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const sendMessage = async () => {
    if (!message.trim()) return;
    
    setIsSending(true);
    setStatus('idle');
    
    try {
      const response = await fetch(`/api/voice?pin=${pin}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: message.trim(),
          projectId,
          projectName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setStatus('success');
      setMessage('');
      
      // Clear success after 3 seconds
      setTimeout(() => setStatus('idle'), 3000);
      
    } catch (err) {
      console.error('Error sending message:', err);
      setStatus('error');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="mt-3">
      <div className="flex flex-col gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message to Eric..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isSending}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {status === 'success' && '✓ Sent to Eric'}
            {status === 'error' && '⚠️ Failed to send'}
            {status === 'idle' && 'Press Enter to send'}
          </span>
          <button
            onClick={sendMessage}
            disabled={isSending || !message.trim()}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${isSending || !message.trim()
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'}
            `}
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
