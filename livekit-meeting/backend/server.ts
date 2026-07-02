import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';
import type { AddressInfo } from 'net';

dotenv.config();

const app = express();
const DEFAULT_PORT = Number(process.env.PORT || 3001);
const MAX_PORT_RETRIES = 5;

// Middleware
app.use(cors());
app.use(express.json());

// Validate environment variables
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.error('❌ Missing required environment variables: LIVEKIT_API_KEY and LIVEKIT_API_SECRET');
  process.exit(1);
}

interface TokenRequestBody {
  roomName: string;
  participantName: string;
}

// POST /api/token - Generate LiveKit access token
app.post('/api/token', async (req: Request<{}, {}, TokenRequestBody>, res: Response) => {
  try {
    const { roomName, participantName } = req.body;

    // Validate input
    if (!roomName || !participantName) {
      return res.status(400).json({
        error: 'Missing required fields: roomName and participantName',
      });
    }

    // Sanitize inputs
    const sanitizedRoomName = roomName.trim();
    const sanitizedParticipantName = participantName.trim();

    if (!sanitizedRoomName || !sanitizedParticipantName) {
      return res.status(400).json({
        error: 'roomName and participantName cannot be empty',
      });
    }

    // Create access token with unique identity
    const uniqueIdentity = `${sanitizedParticipantName}-${Date.now()}`;
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: uniqueIdentity,
      name: sanitizedParticipantName, // Display name
    });

    // Grant permissions
    at.addGrant({
      roomJoin: true,
      room: sanitizedRoomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    // Generate token
    const token = await at.toJwt();

    console.log(`✅ Token generated for ${sanitizedParticipantName} (${uniqueIdentity}) in room ${sanitizedRoomName}`);

    res.json({
      token,
      roomName: sanitizedRoomName,
      participantName: sanitizedParticipantName,
      identity: uniqueIdentity,
    });
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({
      error: 'Failed to generate access token',
    });
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

function startServer(port: number, attempt = 0): void {
  const server = app.listen(port, () => {
    const address = server.address() as AddressInfo;
    const activePort = address?.port ?? port;

    console.log(`🚀 Backend server running on http://localhost:${activePort}`);
    console.log(`📡 Token endpoint: http://localhost:${activePort}/api/token`);
    console.log(`🔑 LiveKit API Key: ${LIVEKIT_API_KEY?.substring(0, 10)}...`);

    if (activePort !== DEFAULT_PORT) {
      console.log(`ℹ️ Port ${DEFAULT_PORT} was busy. Server started on fallback port ${activePort}.`);
      console.log(`ℹ️ Update NEXT_PUBLIC_API_URL to http://localhost:${activePort} if needed.`);
    }
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE' && attempt < MAX_PORT_RETRIES) {
      const nextPort = port + 1;
      console.warn(`⚠️ Port ${port} is already in use. Retrying on ${nextPort}...`);
      setTimeout(() => startServer(nextPort, attempt + 1), 200);
      return;
    }

    console.error('❌ Failed to start backend server:', error);
    process.exit(1);
  });
}

// Start server
startServer(DEFAULT_PORT);
