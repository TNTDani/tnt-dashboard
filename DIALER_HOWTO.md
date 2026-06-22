# Dialer — Twilio Voice integratie

De dialer-UI (`src/components/Dialer.tsx`) is volledig gebouwd. De bel- en ophangknoppen
zijn nu UI-stubs. Hieronder staat hoe je Twilio Voice aansluit.

## 1. Benodigde env-vars

Voeg toe aan `.env.local` (en Vercel project settings):

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_CALLER_ID=+31XXXXXXXXX   # je geverifieerde Twilio-nummer
```

## 2. Twilio access-token route

Maak `src/app/api/dialer/token/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import twilio from 'twilio';

export async function GET(req: NextRequest) {
  const jwt = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!jwt?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID!,
    // Genereer een API key+secret in de Twilio console en zet die hier:
    process.env.TWILIO_API_KEY!,
    process.env.TWILIO_API_SECRET!,
    { identity: jwt.email as string, ttl: 3600 },
  );

  token.addGrant(new VoiceGrant({
    outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
    incomingAllow: false,
  }));

  return NextResponse.json({ token: token.toJwt() });
}
```

## 3. TwiML voice route

Maak `src/app/api/dialer/voice/route.ts` (de TwiML App SID moet hierop wijzen):

```ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.formData();
  const to = body.get('To') as string;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${process.env.TWILIO_CALLER_ID}">
    <Number>${to}</Number>
  </Dial>
</Response>`;

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}
```

## 4. Dialer.tsx aanpassen

Installeer de Twilio browser-SDK:

```bash
npm install @twilio/voice-sdk
```

Vervang in `src/components/Dialer.tsx` de `startCall`/`endCall` stubs door:

```ts
import { Device } from '@twilio/voice-sdk';

// In de component, naast de andere state:
const deviceRef = useRef<Device | null>(null);
const callRef = useRef<ReturnType<Device['connect']> | null>(null);

// Initialiseer de Device eenmalig:
useEffect(() => {
  fetch('/api/dialer/token')
    .then(r => r.json())
    .then(({ token }) => {
      const device = new Device(token, { logLevel: 1 });
      device.register();
      deviceRef.current = device;
    });
  return () => { deviceRef.current?.destroy(); };
}, []);

async function startCall() {
  if (!deviceRef.current) return;
  callRef.current = await deviceRef.current.connect({ params: { To: number } });
  setActive(true);
}

function endCall() {
  callRef.current?.disconnect();
  callRef.current = null;
  setActive(false);
}
```

## 5. TwiML App configureren in Twilio Console

- Ga naar **Develop → Voice → TwiML Apps** → maak een nieuwe aan.
- Zet de **Voice Request URL** op `https://<jouw-domein>/api/dialer/voice`.
- Kopieer de **SID** naar `TWILIO_TWIML_APP_SID`.

## 6. Twilio pakket installeren (server-side)

```bash
npm install twilio
```

Klaar. De dialer-widget verschijnt rechtsonder op alle dashboard-pagina's en laadt
automatisch het nummer van de lead wanneer je op "Bellen" klikt.
