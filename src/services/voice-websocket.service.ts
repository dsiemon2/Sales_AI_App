import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { parse as parseUrl } from 'url';
import { parse as parseCookie } from 'cookie';
import prisma from '../config/database';
import { logActivity, logError } from '../utils/logger';

// OpenAI Realtime API configuration
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime';
const OPENAI_MODEL = 'gpt-4o-realtime-preview-2024-10-01';

interface VoiceSession {
  userId?: string;
  companyId?: string;
  sessionId?: string;
  openaiWs?: WebSocket;
  voiceId: string;
  startTime: Date;
  messageCount: number;
}

// Active voice sessions
const sessions = new Map<WebSocket, VoiceSession>();

/**
 * Create and configure the WebSocket server for voice communication
 */
export function createVoiceWebSocketServer(path: string = '/ws/voice'): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', handleConnection);

  return wss;
}

/**
 * Handle WebSocket upgrade requests
 */
export function handleUpgrade(
  wss: WebSocketServer,
  request: IncomingMessage,
  socket: any,
  head: Buffer,
  basePath: string = ''
) {
  const pathname = parseUrl(request.url || '').pathname || '';
  const targetPath = `${basePath}/ws/voice`;

  if (pathname === targetPath || pathname === '/ws/voice') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
}

/**
 * Handle new WebSocket connection
 */
async function handleConnection(ws: WebSocket, request: IncomingMessage) {
  try {
    // Parse session from cookies if available
    const cookies = request.headers.cookie ? parseCookie(request.headers.cookie) : {};
    const sessionId = cookies['apex.sid'];

    // Initialize session
    const session: VoiceSession = {
      voiceId: 'alloy',
      startTime: new Date(),
      messageCount: 0
    };

    // Try to get user info from session (if authenticated)
    if (sessionId) {
      // In a real implementation, we'd decode the session from Redis
      // For now, we'll just log the connection
    }

    sessions.set(ws, session);

    logActivity('VOICE_SESSION_STARTED', {
      sessionId: sessionId || 'anonymous'
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Connected to voice service',
      timestamp: new Date().toISOString()
    }));

    // Handle messages from client
    ws.on('message', (data) => handleMessage(ws, data));

    // Handle disconnection
    ws.on('close', () => handleDisconnect(ws));

    // Handle errors
    ws.on('error', (error) => {
      logError('VOICE_WS_ERROR', error as Error);
    });

  } catch (error) {
    logError('VOICE_CONNECTION_ERROR', error as Error);
    ws.close(1011, 'Internal error');
  }
}

/**
 * Handle incoming WebSocket messages
 */
async function handleMessage(ws: WebSocket, data: any) {
  const session = sessions.get(ws);
  if (!session) return;

  try {
    const message = JSON.parse(data.toString());
    session.messageCount++;

    switch (message.type) {
      case 'audio':
        await handleAudioMessage(ws, session, message);
        break;

      case 'text':
        await handleTextMessage(ws, session, message);
        break;

      case 'voice_select':
        session.voiceId = message.voiceId || 'alloy';
        ws.send(JSON.stringify({
          type: 'voice_changed',
          voiceId: session.voiceId
        }));
        break;

      case 'config':
        await handleConfigMessage(ws, session, message);
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${message.type}`
        }));
    }
  } catch (error) {
    logError('VOICE_MESSAGE_ERROR', error as Error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to process message'
    }));
  }
}

/**
 * Handle audio data from client
 */
async function handleAudioMessage(ws: WebSocket, session: VoiceSession, message: any) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'OpenAI API key not configured'
    }));
    return;
  }

  // If we don't have an OpenAI connection, create one
  if (!session.openaiWs || session.openaiWs.readyState !== WebSocket.OPEN) {
    await connectToOpenAI(ws, session);
  }

  // Forward audio to OpenAI
  if (session.openaiWs && session.openaiWs.readyState === WebSocket.OPEN) {
    session.openaiWs.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: message.audio // Base64 encoded audio
    }));
  }
}

/**
 * Handle text message from client
 */
async function handleTextMessage(ws: WebSocket, session: VoiceSession, message: any) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'OpenAI API key not configured'
    }));
    return;
  }

  // If we don't have an OpenAI connection, create one
  if (!session.openaiWs || session.openaiWs.readyState !== WebSocket.OPEN) {
    await connectToOpenAI(ws, session);
  }

  // Send text to OpenAI
  if (session.openaiWs && session.openaiWs.readyState === WebSocket.OPEN) {
    session.openaiWs.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: message.text
        }]
      }
    }));

    // Request response
    session.openaiWs.send(JSON.stringify({
      type: 'response.create'
    }));
  }
}

/**
 * Handle configuration message
 */
async function handleConfigMessage(ws: WebSocket, session: VoiceSession, message: any) {
  // Store configuration
  if (message.companyId) {
    session.companyId = message.companyId;

    // Load company-specific AI config
    const aiConfig = await prisma.aIConfig.findUnique({
      where: { companyId: message.companyId }
    });

    if (aiConfig) {
      ws.send(JSON.stringify({
        type: 'config_loaded',
        greeting: aiConfig.greeting,
        voiceId: aiConfig.voiceId || session.voiceId
      }));

      if (aiConfig.voiceId) {
        session.voiceId = aiConfig.voiceId;
      }
    }
  }

  if (message.userId) {
    session.userId = message.userId;
  }
}

/**
 * Connect to OpenAI Realtime API
 */
async function connectToOpenAI(ws: WebSocket, session: VoiceSession) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  return new Promise<void>((resolve, reject) => {
    const openaiWs = new WebSocket(`${OPENAI_REALTIME_URL}?model=${OPENAI_MODEL}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    openaiWs.on('open', () => {
      session.openaiWs = openaiWs;

      // Configure session
      openaiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          voice: session.voiceId,
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          }
        }
      }));

      // Load system prompt if company ID is set
      if (session.companyId) {
        loadSystemPrompt(openaiWs, session.companyId);
      }

      resolve();
    });

    openaiWs.on('message', (data) => {
      handleOpenAIMessage(ws, session, data);
    });

    openaiWs.on('error', (error) => {
      logError('OPENAI_WS_ERROR', error as Error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'OpenAI connection error'
      }));
      reject(error);
    });

    openaiWs.on('close', () => {
      session.openaiWs = undefined;
    });
  });
}

/**
 * Load system prompt for the company
 */
async function loadSystemPrompt(openaiWs: WebSocket, companyId: string) {
  try {
    const aiConfig = await prisma.aIConfig.findUnique({
      where: { companyId }
    });

    if (aiConfig?.systemPrompt) {
      openaiWs.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'system',
          content: [{
            type: 'input_text',
            text: aiConfig.systemPrompt
          }]
        }
      }));
    }
  } catch (error) {
    logError('LOAD_SYSTEM_PROMPT_ERROR', error as Error);
  }
}

/**
 * Handle messages from OpenAI
 */
function handleOpenAIMessage(ws: WebSocket, session: VoiceSession, data: any) {
  try {
    const message = JSON.parse(data.toString());

    switch (message.type) {
      case 'session.created':
      case 'session.updated':
        ws.send(JSON.stringify({
          type: 'ready',
          sessionId: message.session?.id
        }));
        break;

      case 'response.audio.delta':
        // Forward audio chunk to client
        ws.send(JSON.stringify({
          type: 'audio',
          audio: message.delta
        }));
        break;

      case 'response.audio_transcript.delta':
        // Forward transcript to client
        ws.send(JSON.stringify({
          type: 'transcript',
          role: 'assistant',
          delta: message.delta
        }));
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // Send user's transcribed speech
        ws.send(JSON.stringify({
          type: 'transcript',
          role: 'user',
          text: message.transcript
        }));
        break;

      case 'response.text.delta':
        ws.send(JSON.stringify({
          type: 'text_delta',
          delta: message.delta
        }));
        break;

      case 'response.done':
        ws.send(JSON.stringify({
          type: 'response_complete'
        }));
        break;

      case 'input_audio_buffer.speech_started':
        ws.send(JSON.stringify({
          type: 'speech_started'
        }));
        break;

      case 'input_audio_buffer.speech_stopped':
        ws.send(JSON.stringify({
          type: 'speech_stopped'
        }));
        break;

      case 'error':
        ws.send(JSON.stringify({
          type: 'error',
          message: message.error?.message || 'OpenAI error'
        }));
        break;
    }
  } catch (error) {
    logError('OPENAI_MESSAGE_PARSE_ERROR', error as Error);
  }
}

/**
 * Handle WebSocket disconnection
 */
function handleDisconnect(ws: WebSocket) {
  const session = sessions.get(ws);

  if (session) {
    // Close OpenAI connection if open
    if (session.openaiWs && session.openaiWs.readyState === WebSocket.OPEN) {
      session.openaiWs.close();
    }

    const duration = Date.now() - session.startTime.getTime();

    logActivity('VOICE_SESSION_ENDED', {
      duration: Math.round(duration / 1000),
      messageCount: session.messageCount
    });

    sessions.delete(ws);
  }
}

/**
 * Get active session count
 */
export function getActiveSessionCount(): number {
  return sessions.size;
}
