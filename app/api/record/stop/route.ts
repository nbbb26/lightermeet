import { EgressClient } from 'livekit-server-sdk';
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
      return unauthorizedResponse('Valid participant token required to stop recording');
    }

    // Rate limit: 5 requests per minute per identity
    if (!checkRateLimit(`record-stop:${auth.identity}`, 5, 60_000)) {
      return rateLimitedResponse();
    }

    const roomName = req.nextUrl.searchParams.get('roomName');

    if (roomName === null) {
      return new NextResponse('Missing roomName parameter', { status: 403 });
    }

    // Verify the user is authorized for this specific room
    if (auth.roomName && auth.roomName !== roomName) {
      return unauthorizedResponse('Not authorized for this room');
    }

    const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } = process.env;

    const hostURL = new URL(LIVEKIT_URL!);
    hostURL.protocol = 'https:';

    const egressClient = new EgressClient(hostURL.origin, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    const activeEgresses = (await egressClient.listEgress({ roomName })).filter(
      (info) => info.status < 2,
    );
    if (activeEgresses.length === 0) {
      return new NextResponse('No active recording found', { status: 404 });
    }
    await Promise.all(activeEgresses.map((info) => egressClient.stopEgress(info.egressId)));

    console.log(`[recording] Stopped by ${auth.identity} for room ${roomName}`);
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error('[recording] Stop error:', error);
    return NextResponse.json({ error: 'Failed to stop recording' }, { status: 500 });
  }
}
