export function encodePassphrase(passphrase: string) {
  return encodeURIComponent(passphrase);
}

export function decodePassphrase(base64String: string) {
  return decodeURIComponent(base64String);
}

export function generateRoomId(): string {
  return `${randomString(4)}-${randomString(4)}`;
}

export function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const charCount = chars.length; // 36
  const maxValidByte = 256 - (256 % charCount); // 252 — avoids modulo bias

  let result = '';
  const bytes = new Uint8Array(length * 2);

  while (result.length < length) {
    crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length && result.length < length; i++) {
      if (bytes[i] < maxValidByte) {
        result += chars[bytes[i] % charCount];
      }
    }
  }

  return result;
}

export function isLowPowerDevice() {
  return navigator.hardwareConcurrency < 6;
}

export function isMeetStaging() {
  return new URL(location.origin).host === 'meet.staging.livekit.io';
}
