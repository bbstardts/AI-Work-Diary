import React, { useState, useEffect } from 'react';
import { User, Palette, Lock, ShieldCheck, Sun, Moon, Monitor, Save, Fingerprint, Cloud, CloudUpload, CloudDownload, Loader2, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useDiary } from '@/contexts/DiaryContext';
import { useAuth } from '@/lib/AuthContext';
import { backupNow, restoreFromCloud, getLastBackupTime } from '@/lib/cloudSync';
import { loadReminderSettings, saveReminderSettings, requestNotificationPermission, isNotificationSupported } from '@/lib/reminder';
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed, isPushSupported } from '@/lib/push';
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  registerBiometric,
  hasBiometricCredential,
  clearBiometricCredential
} from '@/lib/webauthn';

export default function Settings() {
  const { settings, setSettings, setTheme, setPin, entries, reports, restoreEntries, restoreReports } = useDiary();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(settings.name || '');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [bioSupported, setBioSupported] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [lastBackup, setLastBackup] = useState(getLastBackupTime());
  const [reminder, setReminder] = useState(loadReminderSettings());
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    isPushSubscribed().then(setPushOn);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const supported = isWebAuthnSupported() && (await isPlatformAuthenticatorAvailable());
      if (mounted) setBioSupported(supported);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleBiometric = async (checked) => {
    if (!settings.pin) {
      toast({ title: 'Set a PIN first — it is used as a fallback for biometric unlock.', variant: 'destructive' });
      return;
    }
    setBioBusy(true);
    try {
      if (checked) {
        await registerBiometric(settings.name || 'diary-user');
        setSettings((s) => ({ ...s, biometric: true }));
        toast({ title: 'Biometric unlock enabled' });
      } else {
        clearBiometricCredential();
        setSettings((s) => ({ ...s, biometric: false }));
        toast({ title: 'Biometric unlock disabled' });
      }
    } catch (err) {
      console.error('Biometric setup failed:', err);
      toast({ title: 'Could not set up biometric unlock', description: err.message, variant: 'destructive' });
    } finally {
      setBioBusy(false);
    }
  };

  const saveName = () => {
    setSettings((s) => ({ ...s, name }));
    toast({ title: 'Profile saved' });
  };

  const savePin = () => {
    if (newPin && newPin.length < 4) {
      toast({ title: 'PIN must be at least 4 digits', variant: 'destructive' });
      return;
    }
    if (newPin && newPin !== confirmPin) {
      toast({ title: 'PINs do not match', variant: 'destructive' });
      return;
    }
    setPin(newPin);
    setNewPin('');
    setConfirmPin('');
    toast({ title: newPin ? 'PIN set — app will lock on next launch' : 'PIN removed' });
  };

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor }
  ];

  const runBackup = async () => {
    if (!isAuthenticated) {
      toast({ title: 'Sign in required', description: 'Log in to your account to back up to the cloud.', variant: 'destructive' });
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast({ title: 'You are offline', description: 'Connect to the internet to back up.', variant: 'destructive' });
      return;
    }
    setBackupBusy(true);
    try {
      const res = await backupNow(entries, reports);
      setLastBackup(getLastBackupTime());
      toast({ title: 'Backup complete', description: `${res.entriesBackedUp} entries and ${res.reportsBackedUp} reports are safely in the cloud.` });
    } catch (err) {
      toast({ title: 'Backup failed', description: err.message, variant: 'destructive' });
    } finally {
      setBackupBusy(false);
    }
  };

  const runRestore = async () => {
    if (!isAuthenticated) {
      toast({ title: 'Sign in required', description: 'Log in to your account to restore from the cloud.', variant: 'destructive' });
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast({ title: 'You are offline', description: 'Connect to the internet to restore.', variant: 'destructive' });
      return;
    }
    setRestoreBusy(true);
    try {
      const { entries: cloudEntries, reports: cloudReports } = await restoreFromCloud();
      restoreEntries(cloudEntries);
      restoreReports(cloudReports);
      toast({ title: 'Restore complete', description: `Merged ${cloudEntries.length} entries and ${cloudReports.length} reports from your cloud backup.` });
    } catch (err) {
      toast({ title: 'Restore failed', description: err.message, variant: 'destructive' });
    } finally {
      setRestoreBusy(false);
    }
  };

  const toggleReminder = async (checked) => {
    if (checked) {
      const perm = await requestNotificationPermission();
      if (perm !== 'granted') {
        toast({
          title: perm === 'unsupported' ? 'Notifications not supported on this browser' : 'Notification permission denied',
          description: perm === 'denied' ? 'Enable notifications for this app in your phone/browser settings, then try again.' : undefined,
          variant: 'destructive'
        });
        return;
      }
    }
    const next = { ...reminder, enabled: checked, time: reminder.time || '18:00' };
    setReminder(next);
    saveReminderSettings(next);
    toast({ title: checked ? `Reminder set for ${next.time}` : 'Daily reminder turned off' });
  };

  const changeReminderTime = (time) => {
    const next = { ...reminder, time };
    setReminder(next);
    saveReminderSettings(next);
    if (pushOn) subscribeToPush(time).catch(() => {}); // keep the server-side reminder time in sync
  };

  const togglePush = async (checked) => {
    if (!isPushSupported()) {
      toast({ title: 'Not supported on this browser', variant: 'destructive' });
      return;
    }
    setPushBusy(true);
    try {
      if (checked) {
        const perm = await requestNotificationPermission();
        if (perm !== 'granted') {
          toast({ title: 'Notification permission denied', variant: 'destructive' });
          setPushBusy(false);
          return;
        }
        await subscribeToPush(reminder.time || '18:00');
        setPushOn(true);
        toast({ title: 'Background reminder on', description: "You'll be notified even if the app is closed." });
      } else {
        await unsubscribeFromPush();
        setPushOn(false);
        toast({ title: 'Background reminder off' });
      }
    } catch (err) {
      toast({ title: 'Could not update background reminder', description: err.message, variant: 'destructive' });
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
          <User className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">Profile, appearance & security.</p>
        </div>
      </header>

      {/* Profile */}
      <section className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
        <h2 className="font-display font-semibold flex items-center gap-2"><User className="w-4 h-4" /> Profile</h2>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Your name</Label>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="bg-background" />
            <Button onClick={saveName}><Save className="w-4 h-4 mr-1" /> Save</Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{entries.length} entr{entries.length === 1 ? 'y' : 'ies'} stored on this device.</p>
      </section>

      {/* Appearance */}
      <section className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
        <h2 className="font-display font-semibold flex items-center gap-2"><Palette className="w-4 h-4" /> Appearance</h2>
        <div className="grid grid-cols-3 gap-2">
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const active = settings.theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex flex-col items-center gap-1.5 py-4 rounded-xl border text-sm font-medium transition-all ${
                  active
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <Icon className="w-5 h-5" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Security */}
      <section className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
        <h2 className="font-display font-semibold flex items-center gap-2"><Lock className="w-4 h-4" /> Security</h2>
        {settings.pin && (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4" /> A PIN is protecting your diary.
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {settings.pin
            ? 'Set a new PIN to change it, or leave both fields empty to remove the lock.'
            : 'Add a PIN to lock the app on launch.'}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">{settings.pin ? 'New PIN' : 'PIN'}</Label>
            <Input
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••"
              className="bg-background tracking-widest"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Confirm</Label>
            <Input
              type="password"
              inputMode="numeric"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••"
              className="bg-background tracking-widest"
            />
          </div>
        </div>
        <Button onClick={savePin} className="w-full">{settings.pin ? 'Update PIN' : 'Set PIN'}</Button>

        <div className="pt-2 border-t border-border/70 flex items-center justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <Fingerprint className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">Biometric unlock</p>
              <p className="text-xs text-muted-foreground">
                {bioSupported
                  ? 'Use fingerprint or face unlock instead of typing your PIN. Your PIN still works as a fallback.'
                  : 'Not supported on this device or browser.'}
              </p>
            </div>
          </div>
          <Switch
            checked={!!settings.biometric && hasBiometricCredential()}
            disabled={!bioSupported || bioBusy}
            onCheckedChange={toggleBiometric}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
        <h2 className="font-display font-semibold flex items-center gap-2"><Cloud className="w-4 h-4" /> Cloud backup</h2>
        <p className="text-sm text-muted-foreground">
          Your diary always works fully offline and is saved on this device. Backing up also copies your
          entries and reports to your signed-in account, so you can restore them if you lose this device
          or switch to a new one. Backup and restore both need an internet connection.
        </p>
        {lastBackup && (
          <p className="text-xs text-muted-foreground">
            Last backup: {new Date(lastBackup).toLocaleString()}
          </p>
        )}
        {!isAuthenticated && (
          <p className="text-xs text-amber-600 dark:text-amber-400">Sign in to your account to use cloud backup.</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={runBackup} disabled={backupBusy || restoreBusy}>
            {backupBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CloudUpload className="w-4 h-4 mr-2" />}
            Back up now
          </Button>
          <Button variant="outline" onClick={runRestore} disabled={backupBusy || restoreBusy}>
            {restoreBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CloudDownload className="w-4 h-4 mr-2" />}
            Restore
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card p-5 space-y-4">
        <h2 className="font-display font-semibold flex items-center gap-2"><Bell className="w-4 h-4" /> Daily reminder</h2>
        <p className="text-sm text-muted-foreground">
          Get a notification if you haven't written today's entry yet — it shows up in your phone's
          notification shade, just like a message. It checks whenever you open the app.
        </p>
        {!isNotificationSupported() && (
          <p className="text-xs text-amber-600 dark:text-amber-400">Notifications aren't supported on this browser.</p>
        )}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <Bell className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">Remind me daily</p>
              <p className="text-xs text-muted-foreground">Only fires if today has no entry yet.</p>
            </div>
          </div>
          <Switch
            checked={!!reminder.enabled}
            disabled={!isNotificationSupported()}
            onCheckedChange={toggleReminder}
          />
        </div>
        {reminder.enabled && (
          <div>
            <Label className="text-xs text-muted-foreground">Remind me at</Label>
            <Input
              type="time"
              value={reminder.time || '18:00'}
              onChange={(e) => changeReminderTime(e.target.value)}
              className="bg-background w-40"
            />
          </div>
        )}

        <div className="pt-2 border-t border-border/70 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Notify me even if I don't open the app</p>
            <p className="text-xs text-muted-foreground">Real background notification — works even if the app has been closed for days.</p>
          </div>
          <Switch checked={pushOn} disabled={pushBusy || !isPushSupported()} onCheckedChange={togglePush} />
        </div>
      </section>
    </div>
  );
}