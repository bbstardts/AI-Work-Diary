// Local biometric unlock via WebAuthn platform authenticators (Face ID / Touch ID /
// Windows Hello / Android fingerprint). This never talks to a server — the
// credential is created and verified entirely on-device, which is enough to
// gate access to locally-stored diary data. It is NOT used to authenticate
// against the Base44 backend; that still goes through AuthContext/base44.auth.

const RP_NAME = 'Work Diary AI';
const CREDENTIAL_KEY = 'work_diary_biometric_credential_id';

export function isWebAuthnSupported() {
  return (
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    !!navigator.credentials
  );
}

export async function isPlatformAuthenticatorAvailable() {
  if (!isWebAuthnSupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function randomBytes(length) {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

function bufferToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// Registers a new biometric credential on this device. Call this once when
// the user turns "Biometric unlock" on in Settings.
export async function registerBiometric(userLabel = 'diary-user') {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported on this device/browser.');
  }

  const userId = randomBytes(16);
  const challenge = randomBytes(32);

  const publicKey = {
    challenge,
    rp: { name: RP_NAME },
    user: {
      id: userId,
      name: userLabel,
      displayName: userLabel
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 }, // ES256
      { type: 'public-key', alg: -257 } // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required'
    },
    timeout: 60000,
    attestation: 'none'
  };

  const credential = await navigator.credentials.create({ publicKey });
  if (!credential) throw new Error('Biometric registration was cancelled.');

  const credentialId = bufferToBase64(credential.rawId);
  localStorage.setItem(CREDENTIAL_KEY, credentialId);
  return credentialId;
}

export function hasBiometricCredential() {
  return !!localStorage.getItem(CREDENTIAL_KEY);
}

export function clearBiometricCredential() {
  localStorage.removeItem(CREDENTIAL_KEY);
}

// Prompts the OS fingerprint/face prompt and resolves true if the user
// verifies successfully against the credential registered on this device.
export async function verifyBiometric() {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported on this device/browser.');
  }
  const credentialId = localStorage.getItem(CREDENTIAL_KEY);
  if (!credentialId) {
    throw new Error('No biometric credential is registered on this device.');
  }

  const challenge = randomBytes(32);
  const publicKey = {
    challenge,
    allowCredentials: [
      {
        id: base64ToBuffer(credentialId),
        type: 'public-key',
        transports: ['internal']
      }
    ],
    userVerification: 'required',
    timeout: 60000
  };

  const assertion = await navigator.credentials.get({ publicKey });
  return !!assertion;
}
