import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { db } from '@/firebase/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import useRingtone from '@/hooks/useRingtone';
import {
  notifyInvitationAccepted,
  notifyInvitationDeclined,
} from '@/services/notificationService';
import { useNavigate } from 'react-router-dom';

interface InvitationData {
  id?: string;
  callerId?: string;
  contactId?: string;
  status?: string;
  reunionId?: string;
  zegoRoomId?: string;
  url?: string;
  debut?: Timestamp | number | string | null;
  dateFin?: Timestamp | number | string | null;
  createdAt?: Timestamp | number | string | Date | null;
}

interface CallerInfo {
  displayName?: string;
  name?: string;
}

interface IncomingCallContextType {
  currentInvitation: InvitationData | null;
  currentCaller: CallerInfo | null;
  pendingInvitationsCount: number;
  acceptIncomingCall: (inv: InvitationData) => Promise<void>;
  declineIncomingCall: (inv: InvitationData) => Promise<void>;
}

const IncomingCallContext = createContext<IncomingCallContextType | undefined>(undefined);

export const IncomingCallProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { startRingtone, stopRingtone } = useRingtone();
  const navigate = useNavigate();

  const [currentInvitation, setCurrentInvitation] = useState<InvitationData | null>(null);
  const [currentCaller, setCurrentCaller] = useState<CallerInfo | null>(null);
  const [invitationQueue, setInvitationQueue] = useState<InvitationData[]>([]);
  const autoDeclineRef = useRef<NodeJS.Timeout | null>(null);

  const toMillis = (v: InvitationData['createdAt']): number => {
    if (!v) return 0;
    if (v instanceof Timestamp) return v.toDate().getTime();
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v;
    return new Date(String(v)).getTime() || 0;
  };

  // Listen for incoming invitations
  useEffect(() => {
    if (!user) {
      setCurrentInvitation(null);
      setCurrentCaller(null);
      setInvitationQueue([]);
      stopRingtone();
      if (autoDeclineRef.current) {
        clearTimeout(autoDeclineRef.current);
        autoDeclineRef.current = null;
      }
      return;
    }

    const q = query(
      collection(db, 'invitations'),
      where('contactId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const invs = snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as InvitationData) } as InvitationData)
        );

        invs.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

        setInvitationQueue(invs);

        if (invs.length > 0 && !currentInvitation) {
          setCurrentInvitation(invs[0]);
        } else if (invs.length === 0) {
          setCurrentInvitation(null);
        }
      },
      (err) => {
        console.warn('incoming invitation onSnapshot error', err);
      }
    );

    return () => {
      try {
        unsub();
      } catch (e) {
        console.warn('Failed to unsubscribe:', e);
      }
    };
  }, [user, currentInvitation, stopRingtone]);

  // Fetch caller info when currentInvitation changes
  useEffect(() => {
    if (!currentInvitation) {
      setCurrentCaller(null);
      stopRingtone();
      if (autoDeclineRef.current) {
        clearTimeout(autoDeclineRef.current);
        autoDeclineRef.current = null;
      }
      return;
    }

    (async () => {
      try {
        const profSnap = await getDoc(
          doc(db, 'profiles', currentInvitation.callerId as string)
        );
        if (profSnap.exists()) {
          setCurrentCaller(profSnap.data() as CallerInfo);
        } else {
          setCurrentCaller(null);
        }
      } catch (e) {
        console.warn('Failed to fetch caller info:', e);
        setCurrentCaller(null);
      }
    })();

    try {
      startRingtone();
    } catch (e) {
      console.warn('Could not play ringtone', e);
    }

    if (autoDeclineRef.current) {
      clearTimeout(autoDeclineRef.current);
      autoDeclineRef.current = null;
    }

    autoDeclineRef.current = setTimeout(async () => {
      if (!currentInvitation || !currentInvitation.id) return;
      try {
        await updateDoc(doc(db, 'invitations', currentInvitation.id), {
          status: 'missed',
          viewed: true,
        });
        setCurrentInvitation(null);
        // Move to next invitation if available
        setInvitationQueue((prev) => {
          const remaining = prev.filter((inv) => inv.id !== currentInvitation.id);
          if (remaining.length > 0) {
            setCurrentInvitation(remaining[0]);
          }
          return remaining;
        });
      } catch (e) {
        console.warn('auto-decline failed', e);
      }
    }, 30000);

    return () => {
      if (autoDeclineRef.current) {
        clearTimeout(autoDeclineRef.current);
        autoDeclineRef.current = null;
      }
    };
  }, [currentInvitation, startRingtone, stopRingtone]);

  // Keyboard shortcuts for incoming call
  useEffect(() => {
    if (!currentInvitation) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        acceptIncomingCall(currentInvitation);
      } else if (e.key === 'Escape') {
        declineIncomingCall(currentInvitation);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentInvitation]);

  const acceptIncomingCall = useCallback(
    async (inv: InvitationData) => {
      if (!inv || !inv.id) return;
      try {
        stopRingtone();
        if (autoDeclineRef.current) {
          clearTimeout(autoDeclineRef.current);
          autoDeclineRef.current = null;
        }
        await updateDoc(doc(db, 'invitations', inv.id), {
          status: 'accepted',
          debut: serverTimestamp(),
          viewed: true,
        });
        try {
          await notifyInvitationAccepted(
            inv.callerId as string,
            inv.reunionId as string,
            inv.id,
            currentCaller?.displayName || currentCaller?.name || 'Utilisateur'
          );
        } catch (e) {
          console.warn('notifyInvitationAccepted failed', e);
        }

        const roomId = inv.zegoRoomId || String(inv.reunionId || '');
        navigate(
          `/meeting/${encodeURIComponent(roomId)}?userName=${encodeURIComponent(
            String(currentCaller?.displayName || currentCaller?.name || 'Utilisateur')
          )}`
        );

        // Remove from queue and move to next
        setInvitationQueue((prev) => prev.filter((i) => i.id !== inv.id));
        setCurrentInvitation(null);
      } catch (e) {
        console.error('Error accepting invitation', e);
        stopRingtone();
      }
    },
    [currentCaller, navigate, stopRingtone]
  );

  const declineIncomingCall = useCallback(
    async (inv: InvitationData) => {
      if (!inv || !inv.id) return;
      try {
        await updateDoc(doc(db, 'invitations', inv.id), {
          status: 'declined',
          viewed: true,
        });
        try {
          await notifyInvitationDeclined(
            inv.callerId as string,
            inv.reunionId as string,
            inv.id,
            currentCaller?.displayName || currentCaller?.name || 'Utilisateur'
          );
        } catch (e) {
          console.warn('notifyInvitationDeclined failed', e);
        }
      } catch (e) {
        console.error('Error declining invitation', e);
      }

      stopRingtone();
      if (autoDeclineRef.current) {
        clearTimeout(autoDeclineRef.current);
        autoDeclineRef.current = null;
      }

      // Remove from queue and move to next
      setInvitationQueue((prev) => prev.filter((i) => i.id !== inv.id));
      setCurrentInvitation(null);
    },
    [currentCaller, stopRingtone]
  );

  return (
    <IncomingCallContext.Provider
      value={{
        currentInvitation,
        currentCaller,
        pendingInvitationsCount: invitationQueue.length,
        acceptIncomingCall,
        declineIncomingCall,
      }}
    >
      {children}
    </IncomingCallContext.Provider>
  );
};

export const useIncomingCall = () => {
  const context = useContext(IncomingCallContext);
  if (!context) {
    throw new Error('useIncomingCall must be used within IncomingCallProvider');
  }
  return context;
};
