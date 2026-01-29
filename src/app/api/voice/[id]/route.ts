import { NextResponse } from 'next/server';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'sumaq-consulting';
const REPO_NAME = 'project-board';
const QUEUE_FILE_PATH = 'data/voice-queue.json';
const BRANCH = 'master';

interface VoiceMessage {
  id: string;
  timestamp: string;
  transcript: string;
  processed: boolean;
  processedAt?: string;
}

interface VoiceQueue {
  messages: VoiceMessage[];
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

async function getQueueFromGitHub(): Promise<{ content: VoiceQueue; sha: string | null }> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${QUEUE_FILE_PATH}?ref=${BRANCH}`;
  
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
      return { content: { messages: [] }, sha: null };
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();
  const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
  return { content, sha: data.sha };
}

async function saveQueueToGitHub(content: VoiceQueue, sha: string | null, message: string) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${QUEUE_FILE_PATH}`;
  
  const body: Record<string, unknown> = {
    message,
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

// PATCH: Mark message as processed
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { processed } = body;

    const { content: queue, sha } = await getQueueFromGitHub();
    
    const messageIndex = queue.messages.findIndex(m => m.id === id);
    if (messageIndex === -1) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    queue.messages[messageIndex].processed = processed;
    if (processed) {
      queue.messages[messageIndex].processedAt = new Date().toISOString();
    }

    await saveQueueToGitHub(queue, sha, `Mark voice note ${id} as processed`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating voice message:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

// DELETE: Remove message from queue
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const { content: queue, sha } = await getQueueFromGitHub();
    
    const messageIndex = queue.messages.findIndex(m => m.id === id);
    if (messageIndex === -1) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    queue.messages.splice(messageIndex, 1);

    await saveQueueToGitHub(queue, sha, `Delete voice note ${id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting voice message:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
