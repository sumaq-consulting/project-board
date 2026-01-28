'use client';

import { useState, useEffect } from 'react';

const PIN_STORAGE_KEY = 'project-board-pin';

interface PinGateProps {
  children: React.ReactNode;
}

export function PinGate({ children }: PinGateProps) {
  const [pin, setPin] = useState('');
  const [enteredPin, setEnteredPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check stored PIN on mount
  useEffect(() => {
    const storedPin = localStorage.getItem(PIN_STORAGE_KEY);
    if (storedPin) {
      setPin(storedPin);
      verifyPin(storedPin);
    } else {
      setIsLoading(false);
    }
  }, []);

  const verifyPin = async (pinToVerify: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/projects', {
        headers: {
          'x-app-pin': pinToVerify,
        },
      });

      if (response.ok) {
        localStorage.setItem(PIN_STORAGE_KEY, pinToVerify);
        setPin(pinToVerify);
        setIsAuthenticated(true);
      } else if (response.status === 401) {
        localStorage.removeItem(PIN_STORAGE_KEY);
        setError('Invalid PIN');
        setIsAuthenticated(false);
      } else {
        setError('Server error');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPin.trim()) {
      verifyPin(enteredPin.trim());
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🔐</div>
            <h1 className="text-xl font-bold text-gray-900">Project Board</h1>
            <p className="text-sm text-gray-500 mt-1">Enter PIN to continue</p>
          </div>
          
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value)}
              placeholder="Enter PIN"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-center text-lg tracking-widest"
              autoFocus
            />
            
            {error && (
              <p className="text-red-500 text-sm text-center mt-2">{error}</p>
            )}
            
            <button
              type="submit"
              className="w-full mt-4 bg-gray-900 text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Pass the PIN down via context or props if needed
  return <>{children}</>;
}

// Export a hook to get the PIN for API calls
export function usePin(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PIN_STORAGE_KEY);
}
