import { NextResponse } from 'next/server';
import { ActivityEntry, ActivityAction } from '@/types/project';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'sumaq-consulting';
const REPO_NAME = 'project-board';
const FILE_PATH = 'data/board-state.json';
const BRANCH = 'master';

// Simple PIN-based auth check
function checkAuth(request: Request): boolean {
  const pin = process.env.APP_PIN;
  if (!pin) return true;
  
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
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();
  const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
  return { content, sha: data.sha };
}

async function saveFileToGitHub(content: object, sha: string, message: string) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
      branch: BRANCH,
      sha,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { description, action } = body;

    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    const validActions: ActivityAction[] = [
      'status_change', 'work_completed', 'docs_updated', 'note', 'blocked', 'unblocked'
    ];
    const activityAction: ActivityAction = validActions.includes(action) ? action : 'note';

    // Get current data
    const { content, sha } = await getFileFromGitHub();
    const projects = content.projects || [];
    
    // Find the project
    const projectIndex = projects.findIndex((p: { id: string }) => p.id === id);
    if (projectIndex === -1) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Create activity entry
    const entry: ActivityEntry = {
      timestamp: new Date().toISOString(),
      action: activityAction,
      description,
      source: 'api',
    };

    // Update project
    const project = projects[projectIndex];
    project.lastActivity = description;
    project.lastActivityAt = entry.timestamp;
    project.activityLog = project.activityLog || [];
    project.activityLog.unshift(entry); // Add to beginning
    
    // Prune to last 10 entries
    if (project.activityLog.length > 10) {
      project.activityLog = project.activityLog.slice(0, 10);
    }

    project.updatedAt = entry.timestamp;

    // Save
    await saveFileToGitHub(content, sha, `Activity: ${description.slice(0, 50)}`);

    return NextResponse.json({ success: true, entry });
  } catch (error) {
    console.error('Error adding activity:', error);
    return NextResponse.json({ error: 'Failed to add activity' }, { status: 500 });
  }
}
