import { NextResponse } from 'next/server';

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

export interface GlobalActivityEntry {
  timestamp: string;
  action: string;
  description: string;
  source: string;
  projectId: string;
  projectName: string;
}

export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    const { content } = await getFileFromGitHub();
    const projects = content.projects || [];

    // Collect all activity entries with project context
    const allActivity: GlobalActivityEntry[] = [];
    
    for (const project of projects) {
      if (project.activityLog && Array.isArray(project.activityLog)) {
        for (const entry of project.activityLog) {
          allActivity.push({
            timestamp: entry.timestamp,
            action: entry.action,
            description: entry.description,
            source: entry.source,
            projectId: project.id,
            projectName: project.name,
          });
        }
      }
    }

    // Sort by timestamp descending (most recent first)
    allActivity.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Return top N entries
    const activities = allActivity.slice(0, limit);

    return NextResponse.json({ 
      activities,
      total: allActivity.length,
      limit,
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
