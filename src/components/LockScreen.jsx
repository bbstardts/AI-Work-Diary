import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Delete, Fingerprint } from 'lucide-react';
import { useDiary } from '@/contexts/DiaryContext';
import {
  hasBiometricCredential,
  verifyBiometric,
  isWebAuthnSupported
} from '@/lib/webauthn';

export default function LockScreen() {
  const { settings, setLocked } = useDiary();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [bioError, setBioError] = useState(false);

  const biometricReady =
    settings.biometric && isWebAuthnSupported() && hasBiometricCredential();

  const tryUnlock = (value) => {
    if (value === settings.pin) {
      setLocked(false);
    } else {
      setError(true);
      setTimeout(() => setError(false), 600);
    }
  };

  const press = (digit) => {
    if (pin.length >= 6) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === (settings.pin?.length || 4)) {
      setTimeout(() => tryUnlock(next), 120);
    }
  };

  const backspace = () => setPin((p) => p.slice(0, -1));

  const tryBiometric = useCallback(async () => {
    if (!biometricReady || bioBusy) return;
    setBioBusy(true);
    setBioError(false);
    try {
      const ok = await verifyBiometric();
      if (ok) {
        setLocked(false);
      } else {
        setBioError(true);
      }
    } catch (err) {
      // User cancelled, no match, or the device declined - fall back to PIN silently.
      console.error('Biometric unlock failed:', err);
      setBioError(true);
    } finally {
      setBioBusy(false);
    }
  }, [biometricReady, bioBusy, setLocked]);

  // Auto-prompt biometric once when the lock screen first appears.
  useEffect(() => {
    if (biometricReady) {
      tryBiometric();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricReady]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20">
          <Lock className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-display font-bold">Work Diary AI</h1>
        <p className="text-sm text-muted-foreground">
          {biometricReady ? 'Use your fingerprint or enter your PIN' : 'Enter your PIN to continue'}
        </p>
      </div>

      {biometricReady && (
        <button
          onClick={tryBiometric}
          disabled={bioBusy}
          className={`mb-8 flex flex-col items-center gap-2 group ${bioBusy ? 'opacity-60' : ''}`}
        >
          <div
            className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-colors ${
              bioError ? 'border-destructive text-destructive' : 'border-primary text-primary group-hover:bg-primary/10'
            }`}
          >
            <Fingerprint className="w-8 h-8" />
          </div>
          <span className="text-xs text-muted-foreground">
            {bioBusy ? 'Checking…' : bioError ? 'Try again' : 'Tap to use fingerprint'}
          </span>
        </button>
      )}

      <div className={`flex gap-3 mb-8 ${error ? 'animate-pulse' : ''}`}>
        {Array.from({ length: settings.pin?.length || 4 }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-colors ${
              i < pin.length ? 'bg-primary border-primary' : 'border-muted-foreground/40'
            } ${error ? 'bg-destructive border-destructive' : ''}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-xs w-full">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            onClick={() => press(d)}
            className="aspect-square rounded-2xl bg-secondary hover:bg-secondary/70 text-foreground text-2xl font-medium transition-colors active:scale-95"
          >
            {d}
          </button>
        ))}
        <div />
        <button
          onClick={() => press('0')}
          className="aspect-square rounded-2xl bg-secondary hover:bg-secondary/70 text-2xl font-medium transition-colors active:scale-95"
        >
          0
        </button>
        <button
          onClick={backspace}
          className="aspect-square rounded-2xl text-muted-foreground hover:bg-secondary flex items-center justify-center transition-colors active:scale-95"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>

      {error && (
        <p className="mt-6 text-sm text-destructive">Incorrect PIN, try again</p>
      )}
    </div>
  );
}