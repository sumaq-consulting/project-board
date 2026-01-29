export type ProjectStatus = 'active' | 'blocked' | 'queued' | 'done';
export type ProjectCategory = 'work' | 'personal';

export type ActivityAction = 
  | 'status_change'
  | 'work_completed'
  | 'docs_updated'
  | 'note'
  | 'blocked'
  | 'unblocked';

export interface ActivityEntry {
  timestamp: string;
  action: ActivityAction;
  description: string;
  source: 'board' | 'eric' | 'api';
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  category: ProjectCategory;
  order: number;
  summary?: string;
  blockedReason?: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  questionsForHuman?: string[];
  nextSteps?: string[];
  // Document links (Google Docs)
  summaryUrl?: string;  // Link to Google Doc SUMMARY.md
  prdUrl?: string;      // Link to Google Doc PRD.md
  notes?: string;       // Short freeform notes
  // Activity tracking
  lastActivity?: string;
  lastActivityAt?: string;
  activityLog?: ActivityEntry[];
}

export const STATUS_CONFIG: Record<ProjectStatus, { emoji: string; label: string; color: string }> = {
  active: { emoji: '🟢', label: 'Active', color: 'bg-green-500' },
  blocked: { emoji: '🔴', label: 'Blocked', color: 'bg-red-500' },
  queued: { emoji: '⚪', label: 'Queued', color: 'bg-gray-400' },
  done: { emoji: '✅', label: 'Done', color: 'bg-blue-500' },
};
