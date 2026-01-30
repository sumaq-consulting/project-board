'use client';

import { useState, useEffect, useCallback } from 'react';
import { getRelativeTime } from '@/utils/time';

interface ActivityEntry {
  timestamp: string;
  action: string;
  description: string;
  source: string;
  projectId: string;
  projectName: string;
}

const PIN_STORAGE_KEY = 'project-board-pin';

function getPin(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PIN_STORAGE_KEY);
}

const ACTION_ICONS: Record<string, string> = {
  status_change: '🔄',
  work_completed: '✅',
  docs_updated: '📝',
  note: '💬',
  blocked: '🔴',
  unblocked: '🟢',
  research: '🔍',
  feature_start: '🚀',
};

export function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    try {
      const pin = getPin();
      const headers: HeadersInit = {};
      if (pin) headers['x-app-pin'] = pin;

      const response = await fetch('/api/activity?limit=20', { headers });
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
        setError(null);
      } else {
        setError('Failed to load');
      }
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError('Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
    // Poll every 30 seconds
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, [fetchActivities]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span>🌀</span> Eric&apos;s Activity
        </h3>
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span>🌀</span> Eric&apos;s Activity
        </h3>
        <div className="text-red-500 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <span>🌀</span> Eric&apos;s Activity
        <span className="text-xs font-normal text-gray-400 ml-auto">
          Last 20 actions
        </span>
      </h3>

      {activities.length === 0 ? (
        <div className="text-gray-500 text-sm">No recent activity</div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {activities.map((activity, index) => {
            const uniqueId = `${activity.timestamp}-${index}`;
            const isExpanded = expandedId === uniqueId;
            const icon = ACTION_ICONS[activity.action] || '📌';
            
            return (
              <div
                key={uniqueId}
                className="border-l-2 border-gray-200 pl-3 py-1 hover:border-blue-400 cursor-pointer transition-colors"
                onClick={() => toggleExpand(uniqueId)}
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <span className="font-medium text-gray-700 truncate max-w-[120px]">
                        {activity.projectName}
                      </span>
                      <span>·</span>
                      <span>{getRelativeTime(activity.timestamp)}</span>
                    </div>
                    <p className={`text-sm text-gray-800 ${isExpanded ? '' : 'line-clamp-2'}`}>
                      {activity.description}
                    </p>
                    {isExpanded && (
                      <div className="mt-1 text-xs text-gray-400">
                        Source: {activity.source} · {new Date(activity.timestamp).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
