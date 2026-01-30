import { NextResponse } from 'next/server';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'sumaq-consulting';
const REPO_NAME = 'project-board';
const FAILED_LOG_PATH = 'data/failed-transcriptions.json';
const BRANCH = 'master';

interface FailedTranscription {
  id: string;
  timestamp: string;
  error: string;
  audioSizeBytes: number;
  projectId?: string;
  projectName?: string;
}

interface FailedLog {
  failures: FailedTranscription[];
}

// Simple PIN-based auth check
function checkAuth(request: Request): boolean {
  const pin = process.env.APP_PIN;
  if (!pin) return true;
  
  const url = new URL(request.url);
  const pinParam = url.searchParams.get('pin');
  const pinHeader = request.headers.get('x-app-pin');
  
  return pinParam === pin || pinHeader === pin;
}

async function getFailedLogFromGitHub(): Promise<{ content: FailedLog; sha: string | null }> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FAILED_LOG_PATH}?ref=${BRANCH}`;
  
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
      return { content: { failures: [] }, sha: null };
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();
  const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
  return { content, sha: data.sha };
}

// GET: Fetch failed transcription logs
export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { content } = await getFailedLogFromGitHub();
    return NextResponse.json(content);
  } catch (error) {
    console.error('Error fetching failed transcriptions:', error);
    return NextResponse.json({ error: 'Failed to fetch', failures: [] }, { status: 500 });
  }
}

// DELETE: Clear all failed transcription logs
export async function DELETE(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sha } = await getFailedLogFromGitHub();
    
    if (!sha) {
      return NextResponse.json({ success: true, message: 'No log file exists' });
    }

    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FAILED_LOG_PATH}`;
    
    const body = {
      message: 'Clear failed transcription logs',
      content: Buffer.from(JSON.stringify({ failures: [] }, null, 2)).toString('base64'),
      branch: BRANCH,
      sha,
    };

    await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing failed transcriptions:', error);
    return NextResponse.json({ error: 'Failed to clear' }, { status: 500 });
  }
}
