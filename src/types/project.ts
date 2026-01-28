export type ProjectStatus = 'active' | 'blocked' | 'queued' | 'done';
export type ProjectCategory = 'work' | 'personal';

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
}

export const STATUS_CONFIG: Record<ProjectStatus, { emoji: string; label: string; color: string }> = {
  active: { emoji: '🟢', label: 'Active', color: 'bg-green-500' },
  blocked: { emoji: '🔴', label: 'Blocked', color: 'bg-red-500' },
  queued: { emoji: '⚪', label: 'Queued', color: 'bg-gray-400' },
  done: { emoji: '✅', label: 'Done', color: 'bg-blue-500' },
};
