'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Project, ProjectCategory, ProjectStatus } from '@/types/project';
import { initialProjects } from '@/data/projects';
import { ProjectCard } from './ProjectCard';
import { ProjectModal } from './ProjectModal';

const STORAGE_KEY = 'project-board-data';

export function ProjectBoard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<ProjectCategory>('work');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setProjects(JSON.parse(saved));
      } catch {
        setProjects(initialProjects);
      }
    } else {
      setProjects(initialProjects);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    }
  }, [projects, isLoaded]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredProjects = projects
    .filter((p) => p.category === activeTab)
    .sort((a, b) => a.order - b.order);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = filteredProjects.findIndex((p) => p.id === active.id);
      const newIndex = filteredProjects.findIndex((p) => p.id === over.id);

      const reordered = arrayMove(filteredProjects, oldIndex, newIndex);
      
      // Update order values
      const updatedFiltered = reordered.map((p, i) => ({ ...p, order: i }));
      
      // Merge back with other category
      setProjects((prev) => {
        const other = prev.filter((p) => p.category !== activeTab);
        return [...other, ...updatedFiltered];
      });
    }
  };

  const handleStatusChange = (id: string, status: ProjectStatus) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status, updatedAt: new Date().toISOString() } : p
      )
    );
    setSelectedProject((prev) =>
      prev?.id === id ? { ...prev, status, updatedAt: new Date().toISOString() } : prev
    );
  };

  const stats = {
    active: projects.filter((p) => p.category === activeTab && p.status === 'active').length,
    blocked: projects.filter((p) => p.category === activeTab && p.status === 'blocked').length,
    queued: projects.filter((p) => p.category === activeTab && p.status === 'queued').length,
    done: projects.filter((p) => p.category === activeTab && p.status === 'done').length,
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Project Board</h1>
              <p className="text-sm text-gray-500">Drag to reorder priorities • Top = Highest</p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <div>Eric 🌀</div>
              <div className="text-xs">Last sync: {new Date().toLocaleTimeString()}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('work')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'work'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              💼 Work
            </button>
            <button
              onClick={() => setActiveTab('personal')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'personal'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              🏠 Personal
            </button>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex gap-4 text-sm">
          <span className="text-green-600">🟢 {stats.active} Active</span>
          <span className="text-red-600">🔴 {stats.blocked} Blocked</span>
          <span className="text-gray-500">⚪ {stats.queued} Queued</span>
          <span className="text-blue-600">✅ {stats.done} Done</span>
        </div>
      </div>

      {/* Project List */}
      <main className="max-w-4xl mx-auto px-4 pb-8">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredProjects.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-0">
              {filteredProjects.map((project, index) => (
                <div key={project.id} className="relative">
                  {/* Priority indicator */}
                  <div className="absolute -left-8 top-4 text-xs text-gray-400 font-mono">
                    #{index + 1}
                  </div>
                  <ProjectCard
                    project={project}
                    onClick={() => setSelectedProject(project)}
                  />
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {filteredProjects.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No projects in this category yet.
          </div>
        )}
      </main>

      {/* Modal */}
      <ProjectModal
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
