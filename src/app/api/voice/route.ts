import { NextResponse } from 'next/server';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REPO_OWNER = 'sumaq-consulting';
const REPO_NAME = 'project-board';
const QUEUE_FILE_PATH = 'data/voice-queue.json';
const BRANCH = 'master';

interface VoiceMessage {
  id: string;
  timestamp: string;
  transcript: string;
  projectId?: string;
  projectName?: string;
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

async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', 'whisper-1');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Whisper API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.text;
}

// GET: Fetch voice queue (for Eric to poll)
export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { content } = await getQueueFromGitHub();
    return NextResponse.json(content);
  } catch (error) {
    console.error('Error fetching voice queue:', error);
    return NextResponse.json({ error: 'Failed to fetch', messages: [] }, { status: 500 });
  }
}

// POST: Submit new voice note or text message
export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    
    let transcript: string;
    let projectId: string | null = null;
    let projectName: string | null = null;
    
    // Handle JSON (text message) or FormData (voice note)
    if (contentType.includes('application/json')) {
      const body = await request.json();
      transcript = body.text?.trim();
      projectId = body.projectId || null;
      projectName = body.projectName || null;
      
      if (!transcript) {
        return NextResponse.json({ error: 'No message provided' }, { status: 400 });
      }
    } else {
      // FormData with audio
      const formData = await request.formData();
      const audioFile = formData.get('audio') as Blob;
      projectId = formData.get('projectId') as string | null;
      projectName = formData.get('projectName') as string | null;
      
      if (!audioFile) {
        return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
      }

      // Transcribe audio
      transcript = await transcribeAudio(audioFile);
      
      if (!transcript || transcript.trim().length === 0) {
        return NextResponse.json({ error: 'No speech detected' }, { status: 400 });
      }
    }

    // Generate message ID
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '');
    const messageId = `vm-${dateStr}-${timeStr}`;

    // Create message
    const message: VoiceMessage = {
      id: messageId,
      timestamp: now.toISOString(),
      transcript,
      ...(projectId && { projectId }),
      ...(projectName && { projectName }),
      processed: false,
    };

    // Get current queue and add message
    const { content: queue, sha } = await getQueueFromGitHub();
    queue.messages.unshift(message);

    // Prune old processed messages (keep last 50)
    if (queue.messages.length > 50) {
      queue.messages = queue.messages.slice(0, 50);
    }

    // Save queue
    await saveQueueToGitHub(queue, sha, `Voice note: ${transcript.slice(0, 30)}...`);

    return NextResponse.json({ 
      success: true, 
      messageId,
      transcript,
    });
    
  } catch (error) {
    console.error('Error processing voice note:', error);
    return NextResponse.json({ error: 'Failed to process voice note' }, { status: 500 });
  }
}
