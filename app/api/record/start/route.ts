import { EgressClient, EncodedFileOutput, S3Upload } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import {
  verifyParticipantToken,
  unauthorizedResponse,
  checkRateLimit,
  rateLimitedResponse,
} from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  try {
    // Auth: require valid LiveKit participant token
    const auth = await verifyParticipantToken(req);
    if (!auth) {
      return unauthorizedResponse('Valid participant token required to start recording');
    }

    // Rate limit: 5 requests per minute per identity
    if (!checkRateLimit(`record-start:${auth.identity}`, 5, 60_000)) {
      return rateLimitedResponse();
    }

    const roomName = req.nextUrl.searchParams.get('roomName');

    if (roomName === null) {
      return new NextResponse('Missing roomName parameter', { status: 403 });
    }

    // Verify the user has a room-scoped token for this specific room
    if (!auth.roomName) {
      return unauthorizedResponse('Room-scoped token required for recording');
    }
    if (auth.roomName !== roomName) {
      return unauthorizedResponse('Not authorized for this room');
    }

    const {
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
      LIVEKIT_URL,
      S3_KEY_ID,
      S3_KEY_SECRET,
      S3_BUCKET,
      S3_ENDPOINT,
      S3_REGION,
    } = process.env;

    const hostURL = new URL(LIVEKIT_URL!);
    hostURL.protocol = 'https:';

    const egressClient = new EgressClient(hostURL.origin, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    const existingEgresses = await egressClient.listEgress({ roomName });
    if (existingEgresses.length > 0 && existingEgresses.some((e) => e.status < 2)) {
      return new NextResponse('Meeting is already being recorded', { status: 409 });
    }

    const fileOutput = new EncodedFileOutput({
      filepath: `${new Date(Date.now()).toISOString()}-${roomName}.mp4`,
      output: {
        case: 's3',
        value: new S3Upload({
          endpoint: S3_ENDPOINT,
          accessKey: S3_KEY_ID,
          secret: S3_KEY_SECRET,
          region: S3_REGION,
          bucket: S3_BUCKET,
        }),
      },
    });

    await egressClient.startRoomCompositeEgress(
      roomName,
      {
        file: fileOutput,
      },
      {
        layout: 'speaker',
      },
    );

    console.log(`[recording] Started by ${auth.identity} for room ${roomName}`);
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error('[recording] Start error:', error);
    return NextResponse.json({ error: 'Failed to start recording' }, { status: 500 });
  }
}
