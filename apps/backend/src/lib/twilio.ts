// apps/backend/src/lib/twilio.ts
// Lazy singleton para cliente de Twilio. Provisión de números US para forwarding.
// Per CONTEXT.md D-05, esta es forwarding-only en v1.
// El dual-mode AR/forwarding pattern de RESEARCH.md Pattern 6 está diferido.

import twilio from 'twilio';

let _twilioClient: ReturnType<typeof twilio> | null = null;

export function getTwilioClient() {
  if (!_twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      throw new Error('Missing required env vars: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
    }
    _twilioClient = twilio(accountSid, authToken);
  }
  return _twilioClient;
}

export interface PhoneProvisionResult {
  mode: 'us-forwarding';
  phoneNumber: string;
  sid: string;
}

// D-05/D-06: v1 = US forwarding number ONLY. No AR direct mode (deferred).
// The restaurant owner forwards their AR line to this number using USSD codes
// (see forwarding-instructions.ts). Twilio US numbers have no regulatory bundle.
export async function provisionUsForwardingNumber(
  restaurantId: string,
): Promise<PhoneProvisionResult> {
  const client = getTwilioClient();
  const areaCode = process.env.TWILIO_DEFAULT_AREA_CODE ?? '415';
  const purchased = await client.incomingPhoneNumbers.create({
    areaCode,
    friendlyName: `restaurant-${restaurantId}`,
  });
  if (!purchased.phoneNumber || !purchased.sid) {
    throw new Error('Twilio returned an incomplete phone object');
  }
  return { mode: 'us-forwarding', phoneNumber: purchased.phoneNumber, sid: purchased.sid };
}
