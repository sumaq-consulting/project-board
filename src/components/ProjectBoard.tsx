'use client';

import { useState, useEffect, useCallback } from 'react';
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

const LOCAL_STORAGE_KEY = 'project-board-data';
const PIN_STORAGE_KEY = 'project-board-pin';

function getPin(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PIN_STORAGE_KEY);
}

export function ProjectBoard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<ProjectCategory>('work');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Fetch from API
  const fetchProjects = useCallback(async () => {
    try {
      const pin = getPin();
      const headers: HeadersInit = {};
      if (pin) headers['x-app-pin'] = pin;
      
      const response = await fetch('/api/projects', { headers });
      if (response.ok) {
        const data = await response.json();
        if (data.projects && data.projects.length > 0) {
          setProjects(data.projects);
          // Also save to localStorage as cache
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data.projects));
          setSyncError(null);
          return;
        }
      }
      // Fall back to localStorage or initial data
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        setProjects(JSON.parse(cached));
      } else {
        setProjects(initialProjects);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setSyncError('Failed to load from server');
      // Fall back to localStorage
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        setProjects(JSON.parse(cached));
      } else {
        setProjects(initialProjects);
      }
    }
  }, []);

  // Save to API
  const saveProjects = useCallback(async (projectsToSave: Project[]) => {
    // Always save to localStorage first (instant)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projectsToSave));
    
    // Then sync to API
    setIsSaving(true);
    try {
      const pin = getPin();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (pin) headers['x-app-pin'] = pin;
      
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers,
        body: JSON.stringify({ projects: projectsToSave }),
      });
      
      if (response.ok) {
        setLastSaved(new Date());
        setSyncError(null);
      } else {
        setSyncError('Failed to sync to server');
      }
    } catch (error) {
      console.error('Error saving projects:', error);
      setSyncError('Failed to sync to server');
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    fetchProjects().then(() => setIsLoaded(true));
  }, [fetchProjects]);

  // Poll for updates every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isSaving) {
        fetchProjects();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchProjects, isSaving]);

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
      const updatedFiltered = reordered.map((p, i) => ({ ...p, order: i, updatedAt: new Date().toISOString() }));
      
      // Merge back with other category
      const newProjects = [
        ...projects.filter((p) => p.category !== activeTab),
        ...updatedFiltered,
      ];
      
      setProjects(newProjects);
      saveProjects(newProjects);
    }
  };

  const handleStatusChange = (id: string, status: ProjectStatus) => {
    const newProjects = projects.map((p) =>
      p.id === id ? { ...p, status, updatedAt: new Date().toISOString() } : p
    );
    setProjects(newProjects);
    setSelectedProject((prev) =>
      prev?.id === id ? { ...prev, status, updatedAt: new Date().toISOString() } : prev
    );
    saveProjects(newProjects);
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
              <div className="flex items-center gap-2">
                <span>Eric 🌀</span>
                {isSaving && <span className="text-yellow-600">Saving...</span>}
                {syncError && <span className="text-red-500" title={syncError}>⚠️</span>}
              </div>
              <div className="text-xs">
                {lastSaved ? `Synced: ${lastSaved.toLocaleTimeString()}` : 'Not synced yet'}
              </div>
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
