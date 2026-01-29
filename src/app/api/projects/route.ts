import { NextResponse } from 'next/server';
import { Project, STATUS_CONFIG, ActivityEntry } from '@/types/project';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'sumaq-consulting';
const REPO_NAME = 'project-board';
const FILE_PATH = 'data/board-state.json';
const BRANCH = 'master';

// Simple PIN-based auth check
function checkAuth(request: Request): boolean {
  const pin = process.env.APP_PIN;
  if (!pin) return true; // No PIN set = no auth required
  
  const url = new URL(request.url);
  const pinParam = url.searchParams.get('pin');
  const pinHeader = request.headers.get('x-app-pin');
  
  return pinParam === pin || pinHeader === pin;
}

async function getFileFromGitHub() {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}?ref=${BRANCH}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 404) {
      return { content: { projects: [] }, sha: null };
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();
  const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
  return { content, sha: data.sha };
}

async function saveFileToGitHub(content: object, sha: string | null) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
  
  const body: Record<string, unknown> = {
    message: `Update board state - ${new Date().toISOString()}`,
    content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
    branch: BRANCH,
  };
  
  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { content } = await getFileFromGitHub();
    return NextResponse.json(content);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch', projects: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projects } = body;

    if (!Array.isArray(projects)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // Get current file to get SHA and compare for status changes
    const { content: currentContent, sha } = await getFileFromGitHub();
    const currentProjects = currentContent.projects || [];
    const now = new Date().toISOString();

    // Check for status changes and add activity entries
    const updatedProjects = projects.map((newProject: Project) => {
      const oldProject = currentProjects.find((p: Project) => p.id === newProject.id);
      
      // If status changed, add activity entry
      if (oldProject && oldProject.status !== newProject.status) {
        const oldLabel = STATUS_CONFIG[oldProject.status]?.label || oldProject.status;
        const newLabel = STATUS_CONFIG[newProject.status]?.label || newProject.status;
        
        const entry: ActivityEntry = {
          timestamp: now,
          action: 'status_change',
          description: `Status changed: ${oldLabel} → ${newLabel}`,
          source: 'board',
        };

        newProject.activityLog = newProject.activityLog || [];
        newProject.activityLog.unshift(entry);
        
        // Prune to last 10
        if (newProject.activityLog.length > 10) {
          newProject.activityLog = newProject.activityLog.slice(0, 10);
        }

        newProject.lastActivity = entry.description;
        newProject.lastActivityAt = now;
      }

      return newProject;
    });

    // Save updated content
    const content = {
      projects: updatedProjects,
      updatedAt: now,
    };
    
    await saveFileToGitHub(content, sha);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving projects:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
