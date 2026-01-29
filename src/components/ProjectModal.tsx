'use client';

import { Project, STATUS_CONFIG, ProjectStatus } from '@/types/project';
import { getRelativeTime, getActivityEmoji } from '@/utils/time';
import { VoiceRecorder } from './VoiceRecorder';

const PIN_STORAGE_KEY = 'project-board-pin';

function getPin(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(PIN_STORAGE_KEY) || '';
}

interface ProjectModalProps {
  project: Project | null;
  onClose: () => void;
  onStatusChange: (id: string, status: ProjectStatus) => void;
}

export function ProjectModal({ project, onClose, onStatusChange }: ProjectModalProps) {
  if (!project) return null;

  const statusConfig = STATUS_CONFIG[project.status];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{statusConfig.emoji}</span>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{project.name}</h2>
              <span className={`inline-block px-2 py-0.5 rounded text-xs text-white ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Description */}
          <div>
            <h3 className="font-semibold text-gray-700 mb-1">Description</h3>
            <p className="text-gray-600">{project.description}</p>
          </div>

          {/* Summary */}
          {project.summary && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-1">Summary</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{project.summary}</p>
            </div>
          )}

          {/* Blocked Reason */}
          {project.blockedReason && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-100">
              <h3 className="font-semibold text-red-700 mb-1">⚠️ Blocked</h3>
              <p className="text-red-600">{project.blockedReason}</p>
            </div>
          )}

          {/* Questions for Human */}
          {project.questionsForHuman && project.questionsForHuman.length > 0 && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
              <h3 className="font-semibold text-amber-700 mb-2">❓ Questions for You</h3>
              <ul className="space-y-1">
                {project.questionsForHuman.map((q, i) => (
                  <li key={i} className="text-amber-700 text-sm">• {q}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Next Steps */}
          {project.nextSteps && project.nextSteps.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">📋 Next Steps</h3>
              <ul className="space-y-1">
                {project.nextSteps.map((step, i) => (
                  <li key={i} className="text-gray-600 text-sm flex items-start gap-2">
                    <span className="text-gray-400">→</span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Document Links */}
          {(project.summaryUrl || project.prdUrl) && (
            <div className="pt-4 border-t border-gray-100">
              <h3 className="font-semibold text-gray-700 mb-2">📄 Documents</h3>
              <div className="flex flex-wrap gap-2">
                {project.summaryUrl && (
                  <a
                    href={project.summaryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100 transition-colors"
                  >
                    📊 Executive Summary
                    <span className="text-blue-400">↗</span>
                  </a>
                )}
                {project.prdUrl && (
                  <a
                    href={project.prdUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm hover:bg-purple-100 transition-colors"
                  >
                    📋 PRD
                    <span className="text-purple-400">↗</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {project.notes && (
            <div className="pt-4 border-t border-gray-100">
              <h3 className="font-semibold text-gray-700 mb-1">📝 Notes</h3>
              <p className="text-gray-600 text-sm whitespace-pre-wrap">{project.notes}</p>
            </div>
          )}

          {/* Activity Log */}
          {project.activityLog && project.activityLog.length > 0 && (
            <div className="pt-4 border-t border-gray-100">
              <h3 className="font-semibold text-gray-700 mb-2">📋 Recent Activity</h3>
              <ul className="space-y-2">
                {project.activityLog.slice(0, 5).map((entry, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span>{getActivityEmoji(entry.action)}</span>
                    <span className="text-gray-400 min-w-[70px]">{getRelativeTime(entry.timestamp)}</span>
                    <span>{entry.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Metadata */}
          <div className="pt-4 border-t border-gray-100 text-sm text-gray-500 space-y-1">
            {project.dueDate && (
              <p>📅 Due: {new Date(project.dueDate).toLocaleDateString()}</p>
            )}
            <p>Created: {new Date(project.createdAt).toLocaleDateString()}</p>
            <p>Updated: {new Date(project.updatedAt).toLocaleDateString()}</p>
          </div>

          {/* Voice Note to Eric */}
          <div className="pt-4 border-t border-gray-100">
            <h3 className="font-semibold text-gray-700 mb-2">🎤 Message Eric</h3>
            <VoiceRecorder 
              pin={getPin()} 
              projectId={project.id}
              projectName={project.name}
            />
          </div>

          {/* Status Change Buttons */}
          <div className="pt-4 border-t border-gray-100">
            <h3 className="font-semibold text-gray-700 mb-2">Change Status</h3>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_CONFIG) as ProjectStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => onStatusChange(project.id, status)}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${project.status === status 
                      ? 'bg-gray-900 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                  `}
                >
                  {STATUS_CONFIG[status].emoji} {STATUS_CONFIG[status].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
