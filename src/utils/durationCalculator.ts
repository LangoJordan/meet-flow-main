import { Timestamp } from 'firebase/firestore';

export interface DurationInfo {
  meetingDurationMinutes: number | null;
  participantDurationMinutes: number | null;
}

/**
 * Convert Timestamp, number, or string to milliseconds
 */
const toMilliseconds = (value: unknown): number | null => {
  if (!value) return null;
  
  if (value instanceof Timestamp) {
    return value.toDate().getTime();
  }
  
  if (typeof value === 'number') {
    return value;
  }
  
  if (typeof value === 'string') {
    try {
      return new Date(value).getTime();
    } catch {
      return null;
    }
  }
  
  return null;
};

/**
 * Calculate meeting duration and participant duration
 * @param invitations List of invitation objects with debut and dateFin
 * @returns Meeting duration and individual participant duration
 */
export const calculateMeetingDuration = (
  invitations: Array<{ debut?: unknown; dateFin?: unknown }>
): DurationInfo => {
  if (!invitations || invitations.length === 0) {
    return { meetingDurationMinutes: null, participantDurationMinutes: null };
  }

  // Get all start times (debut)
  const startTimes = invitations
    .map(inv => toMilliseconds(inv.debut))
    .filter((time): time is number => time !== null);

  // Get all end times (dateFin)
  const endTimes = invitations
    .map(inv => toMilliseconds(inv.dateFin))
    .filter((time): time is number => time !== null);

  if (startTimes.length === 0 || endTimes.length === 0) {
    return { meetingDurationMinutes: null, participantDurationMinutes: null };
  }

  // Meeting duration: from first participant join to last participant leave
  const meetingStartTime = Math.min(...startTimes);
  const meetingEndTime = Math.max(...endTimes);
  const meetingDurationMs = meetingEndTime - meetingStartTime;
  const meetingDurationMinutes = Math.round(meetingDurationMs / 60000);

  // Participant duration: average duration each participant stayed
  const participantDurations = invitations
    .map(inv => {
      const start = toMilliseconds(inv.debut);
      const end = toMilliseconds(inv.dateFin);
      
      if (start === null || end === null) return null;
      
      return Math.round((end - start) / 60000);
    })
    .filter((duration): duration is number => duration !== null);

  const participantDurationMinutes = participantDurations.length > 0
    ? Math.round(participantDurations.reduce((a, b) => a + b, 0) / participantDurations.length)
    : null;

  return {
    meetingDurationMinutes,
    participantDurationMinutes,
  };
};

/**
 * Calculate individual participant duration
 */
export const calculateParticipantDuration = (
  debut: unknown,
  dateFin: unknown
): number | null => {
  const startMs = toMilliseconds(debut);
  const endMs = toMilliseconds(dateFin);

  if (startMs === null || endMs === null) {
    return null;
  }

  return Math.round((endMs - startMs) / 60000);
};

/**
 * Format duration in minutes to a readable string
 */
export const formatDuration = (minutes: number | null): string => {
  if (minutes === null) return '—';
  
  if (minutes < 60) {
    return `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  return `${hours}h ${mins}m`;
};
