'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Project, STATUS_CONFIG } from '@/types/project';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const statusConfig = STATUS_CONFIG[project.status];

  // Status-based background colors (subtle tints)
  const statusBgColors: Record<string, string> = {
    active: 'bg-green-50 border-green-200',
    blocked: 'bg-red-50 border-red-200',
    queued: 'bg-gray-50 border-gray-200',
    done: 'bg-blue-50 border-blue-200',
  };

  const bgColorClass = statusBgColors[project.status] || 'bg-white border-gray-200';
  const isDone = project.status === 'done';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        ${bgColorClass} rounded-lg shadow-sm border p-4 mb-3
        cursor-grab active:cursor-grabbing
        hover:shadow-md transition-shadow
        ${isDragging ? 'opacity-50 shadow-lg' : ''}
        ${isDone ? 'opacity-75' : ''}
      `}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{statusConfig.emoji}</span>
            <h3 className={`font-semibold truncate ${isDone ? 'text-gray-500' : 'text-gray-900'}`}>{project.name}</h3>
          </div>
          <p className={`text-sm line-clamp-2 ${isDone ? 'text-gray-400' : 'text-gray-600'}`}>{project.description}</p>
        </div>
      </div>
      
      {project.blockedReason && (
        <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
          ⚠️ {project.blockedReason}
        </div>
      )}
      
      {project.dueDate && (
        <div className="mt-2 text-xs text-gray-500">
          📅 Due: {new Date(project.dueDate).toLocaleDateString()}
        </div>
      )}
      
      {project.questionsForHuman && project.questionsForHuman.length > 0 && (
        <div className="mt-2 text-xs text-amber-600 font-medium">
          ❓ {project.questionsForHuman.length} question{project.questionsForHuman.length > 1 ? 's' : ''} for you
        </div>
      )}
      
      {/* Document links indicator */}
      {(project.summaryUrl || project.prdUrl) && (
        <div className="mt-2 flex gap-2">
          {project.summaryUrl && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">📊 Summary</span>
          )}
          {project.prdUrl && (
            <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">📋 PRD</span>
          )}
        </div>
      )}
    </div>
  );
}
