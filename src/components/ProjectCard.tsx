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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-3
        cursor-grab active:cursor-grabbing
        hover:shadow-md transition-shadow
        ${isDragging ? 'opacity-50 shadow-lg' : ''}
      `}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{statusConfig.emoji}</span>
            <h3 className="font-semibold text-gray-900 truncate">{project.name}</h3>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">{project.description}</p>
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
    </div>
  );
}
