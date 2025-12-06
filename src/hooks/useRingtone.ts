import { useRef, useCallback } from 'react';

// Small fallback to a data URI (wav/ogg) if you prefer a file-based sound
// For now we use the oscillator as the primary method and fallback to a short beep buffer.

export default function useRingtone() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const stopRingtone = useCallback(() => {
    try {
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (e) { console.warn('Failed to close AudioContext', e); }
        audioContextRef.current = null;
      }
    } finally {
      if (ringIntervalRef.current) {
        try { window.clearInterval(ringIntervalRef.current); } catch (e) { console.warn('Failed to clear ringtone interval', e); }
        ringIntervalRef.current = null;
      }
      if (audioElRef.current) {
        try { audioElRef.current.pause(); audioElRef.current.src = ''; } catch (e) { console.warn('Failed to stop audio element', e); }
        audioElRef.current = null;
      }
    }
  }, []);

  const startRingtone = useCallback(() => {
    stopRingtone();

    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) {
        console.warn('AudioContext not available; ringtone will not play');
        return;
      }

      const ac = new AudioCtor() as AudioContext;
      audioContextRef.current = ac;

      const initOsc = () => {
        try {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(880, ac.currentTime);
          g.gain.setValueAtTime(0.0001, ac.currentTime);
          g.gain.exponentialRampToValueAtTime(0.3, ac.currentTime + 0.02);
          o.connect(g);
          g.connect(ac.destination);
          o.start();
          setTimeout(() => {
            try { o.stop(); } catch(e) { console.warn('Failed to stop oscillator', e); }
            try { o.disconnect(); } catch(e) { console.warn('Failed to disconnect oscillator', e); }
            try { g.disconnect(); } catch(e) { console.warn('Failed to disconnect gain', e); }
          }, 400);
        } catch (err) {
          console.warn('Failed to play ring sample', err);
        }
      };

      // start immediately a short sound
      initOsc();

      // repeat cadence
      const intervalId = window.setInterval(() => initOsc(), 1400);
      ringIntervalRef.current = Number(intervalId);

      // Keep audio context active and store it in the ref
      audioContextRef.current = ac;
    } catch (e) {
      console.warn('Could not initialize ringtone', e);
      // fallback: try to play an audio file in public/assets/ringtones/incoming.mp3 (if it exists)
      try {
        const url = '/assets/ringtones/incoming.mp3';
        const a = new Audio(url);
        audioElRef.current = a;
        a.play().catch((err) => {
          console.warn('Failed to play fallback ringtone audio file', err);
        });
      } catch (err) {
        console.warn('fallback ringtone audio element play failed', err);
      }
    }
  }, [stopRingtone]);

  return { startRingtone, stopRingtone };
}
