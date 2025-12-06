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
  Timestamp,
  writeBatch,
} from 'firebase/firestore';

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
  meetingTitle?: string;
}

interface ReceiverInfo {
  displayName?: string;
  name?: string;
  email?: string;
}

interface OutgoingCallContextType {
  activeOutgoingCalls: (InvitationData & { receiverInfo?: ReceiverInfo })[];
  cancelOutgoingCall: (invitationId: string) => Promise<void>;
}

const OutgoingCallContext = createContext<OutgoingCallContextType | undefined>(undefined);

export const OutgoingCallProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [activeOutgoingCalls, setActiveOutgoingCalls] = useState<(InvitationData & { receiverInfo?: ReceiverInfo })[]>([]);
  const receiverCacheRef = useRef<Map<string, ReceiverInfo>>(new Map());
  const missedTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Listen for outgoing calls sent by current user
  useEffect(() => {
    if (!user) {
      setActiveOutgoingCalls([]);
      return;
    }

    const q = query(
      collection(db, 'invitations'),
      where('callerId', '==', user.uid),
      where('status', 'in', ['pending', 'accepted', 'declined', 'missed'])
    );

    const unsub = onSnapshot(
      q,
      async (snap) => {
        const invitations = snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as InvitationData) } as InvitationData)
        );

        // Only keep pending calls (or recently completed ones)
        // Exclude caller's own invitation (where contactId === callerId)
        const activeCalls = invitations.filter(
          (inv) => {
            const isSelfInvitation = inv.contactId === inv.callerId;
            const isActive = inv.status === 'pending' || (inv.status && ['accepted', 'declined', 'missed'].includes(inv.status));
            return !isSelfInvitation && isActive;
          }
        );

        // Fetch meeting titles from reunions
        const callsWithTitles = await Promise.all(
          activeCalls.map(async (call) => {
            if (call.meetingTitle) return call;
            if (!call.reunionId) return call;

            try {
              const reunionSnap = await getDoc(doc(db, 'reunions', call.reunionId));
              if (reunionSnap.exists()) {
                const reunionData = reunionSnap.data() as { title?: string };
                return { ...call, meetingTitle: reunionData.title };
              }
            } catch (e) {
              console.warn('Failed to fetch meeting title:', e);
            }

            return call;
          })
        );

        setActiveOutgoingCalls(callsWithTitles);

        // Set up missed timeout for pending calls
        callsWithTitles.forEach((call) => {
          if (call.status === 'pending' && call.id) {
            const existingTimeout = missedTimeoutsRef.current.get(call.id);
            if (!existingTimeout) {
              const timeout = setTimeout(async () => {
                try {
                  await updateDoc(doc(db, 'invitations', call.id!), {
                    status: 'missed',
                  });
                  missedTimeoutsRef.current.delete(call.id!);
                } catch (e) {
                  console.error('Failed to mark call as missed:', e);
                }
              }, 30000); // 30 seconds
              missedTimeoutsRef.current.set(call.id, timeout);
            }
          } else if (call.id && ['accepted', 'declined', 'missed'].includes(call.status || '')) {
            // Clear timeout if invitation is no longer pending
            const timeout = missedTimeoutsRef.current.get(call.id);
            if (timeout) {
              clearTimeout(timeout);
              missedTimeoutsRef.current.delete(call.id);
            }
          }
        });
      },
      (err) => {
        console.warn('outgoing calls onSnapshot error', err);
      }
    );

    return () => {
      try {
        unsub();
        // Clear all timeouts on unmount
        missedTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
        missedTimeoutsRef.current.clear();
      } catch (e) {
        console.warn('Failed to unsubscribe from outgoing calls:', e);
      }
    };
  }, [user]);

  // Fetch receiver info for each outgoing call
  useEffect(() => {
    if (activeOutgoingCalls.length === 0) return;

    const fetchReceiverInfo = async () => {
      const updatedCalls = await Promise.all(
        activeOutgoingCalls.map(async (call) => {
          if (!call.contactId) return call;

          const cached = receiverCacheRef.current.get(call.contactId);
          if (cached) {
            return { ...call, receiverInfo: cached };
          }

          try {
            const profSnap = await getDoc(doc(db, 'profiles', call.contactId));
            if (profSnap.exists()) {
              const info = profSnap.data() as ReceiverInfo;
              receiverCacheRef.current.set(call.contactId, info);
              return { ...call, receiverInfo: info };
            }
          } catch (e) {
            console.warn('Failed to fetch receiver info:', e);
          }

          return call;
        })
      );

      setActiveOutgoingCalls(updatedCalls);
    };

    fetchReceiverInfo();
  }, [activeOutgoingCalls.length]);

  const cancelOutgoingCall = useCallback(
    async (invitationId: string) => {
      if (!invitationId) return;

      try {
        // Clear timeout if exists
        const timeout = missedTimeoutsRef.current.get(invitationId);
        if (timeout) {
          clearTimeout(timeout);
          missedTimeoutsRef.current.delete(invitationId);
        }

        const batch = writeBatch(db);
        const invRef = doc(db, 'invitations', invitationId);

        batch.update(invRef, {
          status: 'cancelled',
        });

        // Also find and cancel the reunion if all invitations are cancelled
        const invitation = activeOutgoingCalls.find((call) => call.id === invitationId);
        if (invitation && invitation.reunionId) {
          const reunionRef = doc(db, 'reunions', invitation.reunionId);
          const reunionSnap = await getDoc(reunionRef);

          if (reunionSnap.exists()) {
            batch.update(reunionRef, {
              status: 'cancelled',
            });
          }
        }

        await batch.commit();

        setActiveOutgoingCalls((prev) => prev.filter((call) => call.id !== invitationId));
      } catch (e) {
        console.error('Error cancelling outgoing call', e);
      }
    },
    [activeOutgoingCalls]
  );

  return (
    <OutgoingCallContext.Provider
      value={{
        activeOutgoingCalls,
        cancelOutgoingCall,
      }}
    >
      {children}
    </OutgoingCallContext.Provider>
  );
};

export const useOutgoingCall = () => {
  const context = useContext(OutgoingCallContext);
  if (!context) {
    throw new Error('useOutgoingCall must be used within OutgoingCallProvider');
  }
  return context;
};
