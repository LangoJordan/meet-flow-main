import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  PhoneOff,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { ZegoUIKitPrebuilt, ZegoUIKitPrebuiltInstance } from '@zegocloud/zego-uikit-prebuilt';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebase/firebase';
import { collection, query, where, getDocs, updateDoc, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { toast } from 'sonner';

const Meeting = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meetingInfo, setMeetingInfo] = useState<{ title?: string; description?: string; type?: string; creatorId?: string; begin?: unknown } | null>(null);
  const [reunionId, setReunionId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<'host' | 'co-host' | 'participant'>('participant');
  const [isInvitePanelOpen, setIsInvitePanelOpen] = useState(false);
  const zegoInstanceRef = useRef<ZegoUIKitPrebuiltInstance | null>(null);
  const userJoinTimeRef = useRef<number | null>(null);
  interface MeetingContact {
    id: string;
    name: string;
    email?: string;
    invitId?: string;
  }

  const [contacts, setContacts] = useState<MeetingContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const zegoContainerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const roomId = id || '';
  const userName = 'Utilisateur';

  // First useEffect: Load meeting info and user role
  useEffect(() => {
    if (!roomId) {
      setError('Identifiant de réunion manquant. Le lien vers la réunion est invalide.');
      return;
    }

    const loadMeetingInfo = async () => {
      try {
        const reunionQ = query(collection(db, 'reunions'), where('roomId', '==', roomId));
        const reunionSnap = await getDocs(reunionQ);
        if (!reunionSnap.empty) {
          const docRef = reunionSnap.docs[0];
          const data = docRef.data() as { title?: string; description?: string; type?: string; status?: string; creatorId?: string; begin?: unknown };
          setReunionId(docRef.id);
          setMeetingInfo({
            title: data.title || undefined,
            description: data.description || undefined,
            type: data.type || undefined,
            creatorId: data.creatorId,
            begin: data.begin,
          });

          if (data.status === 'completed') {
            setError('Cette réunion est expirée. Le lien de connexion n\'est plus valide.');
            return;
          }

          // Vérification d'accès pour les réunions privées
          if (data.type === 'private' && user?.uid) {
            const invQ = query(
              collection(db, 'invitations'),
              where('reunionId', '==', docRef.id),
              where('contactId', '==', user.uid),
              where('status', 'in', ['accepted', 'pending'])
            );
            const invSnap = await getDocs(invQ);
            if (invSnap.empty) {
              setError('Cette réunion est privée. Vous devez être invité pour y accéder.');
              return;
            }
          }

          // Charger le rôle à partir des invitations si l'utilisateur est identifié
          if (user?.uid) {
            try {
              const invQ = query(
                collection(db, 'invitations'),
                where('reunionId', '==', docRef.id),
                where('contactId', '==', user.uid),
              );
              const invSnap = await getDocs(invQ);
              if (!invSnap.empty) {
                const invData = invSnap.docs[0].data() as { role?: 'host' | 'co-host' | 'participant' };
                if (invData.role === 'host' || invData.role === 'co-host' || invData.role === 'participant') {
                  setMyRole(invData.role);
                }
              }
            } catch (roleErr) {
              console.warn('Unable to load user role for this meeting', roleErr);
            }
          }
        }
      } catch (infoErr) {
        console.warn('Unable to load meeting info for header', infoErr);
      }
    };

    void loadMeetingInfo();
  }, [roomId, user?.uid]);

  // Second useEffect: Initialize ZegoCloud after DOM is ready
  useEffect(() => {
    if (!roomId || !meetingInfo || !zegoContainerRef.current) {
      return;
    }

    const initializeZegoCloud = async () => {
      try {
        setIsLoading(true);

        // Ensure ZegoUIKitPrebuilt is available
        if (!ZegoUIKitPrebuilt || !ZegoUIKitPrebuilt.create) {
          throw new Error('ZegoUIKitPrebuilt module not properly loaded');
        }

        const appID = Number(import.meta.env.VITE_ZEGO_APP_ID);
        const serverSecret = import.meta.env.VITE_ZEGO_SERVER_SECRET as string | undefined;

        if (!appID || !serverSecret) {
          setError('Configuration ZegoCloud manquante. Vérifiez VITE_ZEGO_APP_ID et VITE_ZEGO_SERVER_SECRET dans votre fichier .env.');
          setIsLoading(false);
          return;
        }

        // Mettre à jour l'invitation de l'utilisateur courant comme "viewed"
        if (user?.uid && reunionId) {
          try {
            const invQ = query(
              collection(db, 'invitations'),
              where('reunionId', '==', reunionId),
              where('contactId', '==', user.uid),
            );
            const invSnap = await getDocs(invQ);
            await Promise.all(
              invSnap.docs.map(async (d) => {
                await updateDoc(d.ref, { viewed: true });
              }),
            );
          } catch (markErr) {
            console.warn('Failed to mark invitations as viewed for this user', markErr);
          }
        }

        // Génération directe du kitToken côté client (développement)
        const userID = String(Date.now());
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appID,
          serverSecret,
          roomId,
          userID,
          userName,
        );

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zegoInstanceRef.current = zp;

        const isHost = myRole === 'host' || myRole === 'co-host';

        // Request media permissions explicitly
        const requestMediaPermissions = async () => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: true,
            });
            // Stop the stream immediately since we just need permissions
            stream.getTracks().forEach(track => track.stop());
            return true;
          } catch (err) {
            console.warn('Failed to request media permissions:', err);
            toast.error('Impossible d\'accéder à votre caméra ou microphone. Vérifiez vos paramètres de confidentialité.');
            return false;
          }
        };

        // Update current user's debut time when room is joined
        const updateUserJoinTime = async () => {
          if (user?.uid && reunionId && !userJoinTimeRef.current) {
            try {
              userJoinTimeRef.current = Date.now();

              const invQ = query(
                collection(db, 'invitations'),
                where('reunionId', '==', reunionId),
                where('contactId', '==', user.uid)
              );
              const invSnap = await getDocs(invQ);
              if (!invSnap.empty && !invSnap.docs[0].data().debut) {
                await updateDoc(invSnap.docs[0].ref, {
                  debut: serverTimestamp(),
                });

                // Set reunion begin time if this is the first participant for a scheduled meeting
                if (!meetingInfo?.begin && reunionId) {
                  try {
                    const reunionRef = doc(db, 'reunions', reunionId);
                    await updateDoc(reunionRef, {
                      begin: serverTimestamp(),
                      status: 'in-progress',
                    });
                  } catch (err) {
                    console.warn('Failed to set reunion begin time', err);
                  }
                }
              }
            } catch (err) {
              console.warn('Failed to update user join time', err);
            }
          }
        };

        // Request permissions and then join the room
        await requestMediaPermissions();

        await zp.joinRoom({
          container: zegoContainerRef.current,
          sharedLinks: [
            {
              name: 'Room link',
              url: window.location.origin + `/meeting/${encodeURIComponent(roomId)}`,
            },
          ],
          scenario: {
            mode: ZegoUIKitPrebuilt.VideoConference,
          },
          showRoomUserList: true,
          showTurnOffRemoteCameraButton: isHost,
          showTurnOffRemoteMicrophoneButton: isHost,
          showRemoveUserButton: isHost,
          turnOnCameraWhenJoining: true,
          turnOnMicrophoneWhenJoining: true,
          onJoinRoom: () => {
            // Called when user successfully joins the room
            void updateUserJoinTime();
          },
        });

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize ZegoCloud:', err);
        setError('Failed to connect to the meeting. Please try again.');
        setIsLoading(false);
      }
    };

    void initializeZegoCloud();
  }, [roomId, myRole, meetingInfo, user?.uid, reunionId, meetingInfo?.begin]);

  // Charger les contacts de l'utilisateur (pour l'invitation en direct)
  useEffect(() => {
    if (!user?.uid) return;
    if (!isInvitePanelOpen) return;

    (async () => {
      setLoadingContacts(true);
      try {
        const q = query(collection(db, 'contacts'), where('creatorId', '==', user.uid));
        const snap = await getDocs(q);
        const items: MeetingContact[] = snap.docs.map((d) => {
          const data = d.data() as { name?: string; email?: string; invitId?: string };
          return {
            id: d.id,
            name: data.name || 'Contact',
            email: data.email,
            invitId: data.invitId,
          };
        });
        setContacts(items);
      } catch (e) {
        console.warn('Error loading contacts for live invitation', e);
        toast.error('Impossible de charger les contacts');
      } finally {
        setLoadingContacts(false);
      }
    })();
  }, [user?.uid, isInvitePanelOpen]);

  const handleInviteContact = async (contact: MeetingContact) => {
    if (!user?.uid) return;
    if (!roomId || !meetingInfo) {
      toast.error('Réunion introuvable pour cette invitation.');
      return;
    }

    try {
      // Retrouver la réunion par roomId
      const reunionQ = query(collection(db, 'reunions'), where('roomId', '==', roomId));
      const reunionSnap = await getDocs(reunionQ);
      if (reunionSnap.empty) {
        toast.error('Réunion introuvable pour cette invitation.');
        return;
      }
      const reunionDoc = reunionSnap.docs[0];
      const reunionId = reunionDoc.id;
      const reunionData = reunionDoc.data() as { roomUrl?: string };

      // Créer une invitation Firestore
      await addDoc(collection(db, 'invitations'), {
        callerId: user.uid,
        contactId: contact.invitId || contact.id,
        createdAt: serverTimestamp(),
        dateFin: null,
        debut: null,
        reunionId,
        role: 'participant',
        status: 'pending',
        viewed: false,
        url: reunionData.roomUrl || window.location.origin + `/meeting/${encodeURIComponent(roomId)}`,
        zegoRoomId: roomId,
      });

      // Envoi d'email (non bloquant)
      if (contact.email) {
        const emailInvitation = {
          toEmail: contact.email,
          toName: contact.name,
          meetingTitle: meetingInfo.title || 'Réunion Meet-Flow',
          meetingDescription: meetingInfo.description || '',
          begin: new Date().toISOString(),
          roomUrl: reunionData.roomUrl || window.location.origin + `/meeting/${encodeURIComponent(roomId)}`,
        };

        void fetch('http://localhost:4000/api/send-invitations-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invitations: [emailInvitation] }),
        }).catch((err) => {
          console.warn('Failed to call send-invitations-email from Meeting', err);
        });
      }

      toast.success(`Invitation envoyée à ${contact.name}`);
    } catch (e) {
      console.error('Error inviting contact during meeting', e);
      toast.error('Impossible d\'inviter ce contact');
    }
  };

  const handleEndCall = async () => {
    // First, end the Zegocloud session for the current user
    if (zegoInstanceRef.current) {
      try {
        await zegoInstanceRef.current.leaveRoom();
      } catch (err) {
        console.warn('Failed to leave Zego room:', err);
      }
    }

    // Then update Firebase and navigate
    if (roomId && user?.uid && reunionId) {
      try {
        // Update current user's dateFin
        const invQ = query(
          collection(db, 'invitations'),
          where('reunionId', '==', reunionId),
          where('contactId', '==', user.uid)
        );
        const invSnap = await getDocs(invQ);
        if (!invSnap.empty && !invSnap.docs[0].data().dateFin) {
          await updateDoc(invSnap.docs[0].ref, {
            dateFin: serverTimestamp(),
          });
        }

        // If current user is the organizer, mark meeting as completed
        const reunionSnap = await getDocs(query(collection(db, 'reunions'), where('roomId', '==', roomId)));
        if (!reunionSnap.empty) {
          const docSnap = reunionSnap.docs[0];
          const data = docSnap.data() as { creatorId?: string };
          if (data.creatorId === user.uid) {
            await updateDoc(docSnap.ref, {
              status: 'completed',
              roomId: '',
              roomUrl: '',
            });
            toast.info('La réunion a été marquée comme terminée.');
          }
        }
      } catch (e) {
        console.warn('Failed to update invitation/reunion on leaving', e);
      } finally {
        navigate('/calls');
      }
      return;
    }

    navigate('/calls');
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-slate-900 to-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md bg-card/80 border border-destructive/20 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Connection Failed</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{error}</p>
          <div className="flex flex-wrap gap-3 justify-center pt-4">
            <Button variant="outline" onClick={() => navigate('/calls')}>
              Retour à l'historique
            </Button>
            <Button onClick={() => navigate('/dashboard')}>
              Tableau de bord
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Header */}
      <header className="h-16 px-4 md:px-8 flex items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-md shadow-sm/80">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-9 h-9 md:w-10 md:h-10 bg-gradient-main rounded-xl flex items-center justify-center shadow-md">
            <span className="text-white text-sm md:text-base font-bold">M</span>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-semibold text-sm md:text-base text-foreground">
                {meetingInfo?.title || 'Salle de réunion'}
              </h1>
              <span className="hidden md:inline-flex text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50">
                {userName}
              </span>
            </div>
            <p className="text-[11px] md:text-xs text-muted-foreground truncate max-w-xs md:max-w-md">
              ID de réunion : {roomId}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {(myRole === 'host' || myRole === 'co-host') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsInvitePanelOpen((v) => !v)}
              className="hidden sm:inline-flex text-[11px] px-3"
            >
              {isInvitePanelOpen ? 'Fermer les invitations' : 'Inviter un contact'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/contacts')}
            className="hidden sm:inline-flex text-[11px] px-3"
          >
            Contacts
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/invitations')}
            className="hidden sm:inline-flex text-[11px] px-3"
          >
            Invitations
          </Button>
          <Badge className="bg-success/10 text-success border-success/20 px-3 py-1 text-[11px]">
            <span className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse" />
            En direct
          </Badge>

          <Button
            variant="destructive"
            size="sm"
            onClick={handleEndCall}
            className="shadow-md hover:shadow-lg transition-all text-xs md:text-sm px-3 md:px-4"
          >
            <PhoneOff className="mr-2 h-4 w-4" />
            Quitter
          </Button>
        </div>
      </header>

      {/* Main Layout: vidéo + panneau d'informations */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 px-3 md:px-6 py-4 md:py-6 max-w-7xl mx-auto w-full">
        {/* Zone vidéo principale */}
        <div className="flex-1 min-w-0">
          <div className="relative w-full h-full rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-[0_25px_80px_rgba(0,0,0,0.55)] overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/95 z-20">
                <div className="text-center space-y-4">
                  <div className="relative">
                    <div className="w-20 h-20 bg-gradient-main rounded-full flex items-center justify-center mx-auto animate-pulse shadow-lg">
                      <Loader2 className="h-10 w-10 text-white animate-spin" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg md:text-xl font-semibold text-foreground">Connexion à la réunion…</h3>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Veuillez patienter pendant la configuration de votre appel vidéo
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ZegoCloud will render here */}
            <div
              ref={zegoContainerRef}
              className="w-full h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] bg-black/90"
            />
          </div>
        </div>

        {/* Panneau latéral d'informations et d'invitations */}
        <aside className="w-full lg:w-80 xl:w-96 flex-shrink-0 space-y-4">
          <div className="rounded-2xl border border-border/70 bg-card/90 backdrop-blur-xl p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Informations réunion
              </p>
              {meetingInfo?.type && (
                <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30">
                  {meetingInfo.type === 'public' && 'Réunion publique'}
                  {meetingInfo.type === 'private' && 'Réunion privée'}
                  {meetingInfo.type === 'organizational' && 'Réunion organisationnelle'}
                  {!['public', 'private', 'organizational'].includes(meetingInfo.type) && meetingInfo.type}
                </span>
              )}
            </div>

            <h2 className="text-sm font-semibold text-foreground break-words">
              {meetingInfo?.title || 'Salle de réunion'}</h2>
            {meetingInfo?.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {meetingInfo.description}
              </p>
            )}

            <div className="mt-2 rounded-xl bg-muted/40 border border-border/60 px-3 py-2 text-xs text-muted-foreground space-y-1">
              <p className="flex justify-between">
                <span className="opacity-80">Vous êtes connecté en tant que</span>
                <span className="font-medium text-foreground ml-2 truncate max-w-[120px]">
                  {userName}
                </span>
              </p>
              <p className="flex justify-between">
                <span className="opacity-80">Identifiant</span>
                <span className="ml-2 truncate max-w-[140px]">{roomId}</span>
              </p>
            </div>
          </div>

          {(myRole === 'host' || myRole === 'co-host') && (
            <div className="rounded-2xl border border-border/70 bg-card/90 backdrop-blur-xl p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Inviter des contacts
                </p>
              </div>
              {!isInvitePanelOpen ? (
                <p className="text-xs text-muted-foreground">
                  Utilisez le bouton "Inviter un contact" dans l'en-tête pour afficher vos contacts.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
                  {loadingContacts && (
                    <p className="text-muted-foreground">Chargement des contacts...</p>
                  )}
                  {!loadingContacts && contacts.length === 0 && (
                    <p className="text-muted-foreground">Aucun contact disponible.</p>
                  )}
                  {!loadingContacts && contacts.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 border border-border rounded-lg px-2 py-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate text-xs">{c.name}</p>
                        {c.email && (
                          <p className="text-[10px] text-muted-foreground truncate">{c.email}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[11px] px-2 py-1 h-7"
                        onClick={() => handleInviteContact(c)}
                      >
                        Inviter
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="hidden lg:block rounded-2xl border border-border/70 bg-card/70 backdrop-blur-xl p-4 text-xs text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground text-sm">Conseils rapides</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Vérifiez vos périphériques audio et vidéo avant de commencer.</li>
              <li>Utilisez les contrôles dans l'interface Zego pour gérer micro et caméra.</li>
              <li>Partagez le lien de la réunion uniquement avec les personnes invitées.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Meeting;
