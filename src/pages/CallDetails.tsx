import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, Users, Calendar, UserPlus, Grid3x3, Table2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebase/firebase';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, Timestamp, updateDoc, serverTimestamp } from 'firebase/firestore';
import callService from '@/services/callService';
import { toast } from 'sonner';

interface InvitationItem {
  id: string;
  reunionId: string;
  callerId: string;
  contactId: string;
  status: string;
  debut?: Timestamp | number | string | null;
  dateFin?: Timestamp | number | string | null;
  role?: string;
  viewed?: boolean;
  createdAt?: Timestamp | number | string | null;
}

interface ReunionData {
  id: string;
  title: string;
  description?: string;
  creatorId: string;
  status: string;
  type?: string;
  begin?: Timestamp | number | string | null;
  roomId?: string;
  roomUrl?: string;
}

interface ParticipantItem extends InvitationItem {
  profile?: Record<string, unknown> | null;
}

interface ContactRecord { id: string; name?: string; invitId?: string; [key: string]: unknown }

const CallDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [reunion, setReunion] = useState<ReunionData | null>(null);
  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [creatorProfile, setCreatorProfile] = useState<Record<string, unknown> | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState<boolean>(false);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [rolesMap, setRolesMap] = useState<Record<string, 'host' | 'co-host' | 'participant'>>({});
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    (async () => {
      try {
        if (!user) return;
        const q = query(collection(db, 'contacts'), where('creatorId', '==', user.uid));
        const snap = await getDocs(q);
        const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as ContactRecord) } as ContactRecord));
        setContacts(items);
      } catch (e) {
        console.error('Error loading contacts', e);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!id) return;
    const reunionRef = doc(db, 'reunions', id);
    const invitationsQuery = query(collection(db, 'invitations'), where('reunionId', '==', id));
    let unsubReunion: (() => void) | null = null;
    let unsubInv: (() => void) | null = null;

    (async () => {
      setLoading(true);
      try {
        unsubReunion = onSnapshot(reunionRef, (snap) => {
          if (!snap.exists()) {
            setReunion(null);
            setLoading(false);
            return;
          }
          const r = { id: snap.id, ...(snap.data() as ReunionData) } as ReunionData;
          setReunion(r);
        });

        unsubInv = onSnapshot(invitationsQuery, async (snap) => {
          const invDocs = snap.docs.map(d => ({ id: d.id, ...(d.data() as InvitationItem) } as InvitationItem));
          const participantPromises = invDocs.map(async (inv) => {
            const profSnap = await getDoc(doc(db, 'profiles', inv.contactId));
            const prof = profSnap.exists() ? profSnap.data() : null;
            return { ...inv, profile: prof } as ParticipantItem;
          });
          const parts = await Promise.all(participantPromises);
          setParticipants(parts);
        });

        setLoading(false);
      } catch (err) {
        console.error('Error loading call details', err);
        setLoading(false);
      }
    })();

    return () => { if (unsubReunion) unsubReunion(); if (unsubInv) unsubInv(); };
  }, [id]);

  if (!reunion) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Appel non trouvé</p>
          <Button onClick={() => navigate('/calls')} className="mt-4">
            Retour à l'historique
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const getParticipantDetails = (profile: Record<string, unknown> | null, contactId: string) => {
    if (profile) return profile;
    return { displayName: contactId, email: '' } as Record<string, unknown>;
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'host':
        return <Badge className="bg-primary">Organisateur</Badge>;
      case 'co-host':
        return <Badge className="bg-accent">Co-organisateur</Badge>;
      default:
        return <Badge variant="secondary">Participant</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950/30">En attente</Badge>;
      case 'accepted':
        return <Badge className="bg-success dark:bg-success/20 text-success dark:text-success">Accepté</Badge>;
      case 'declined':
        return <Badge variant="destructive">Refusé</Badge>;
      case 'missed':
        return <Badge variant="outline" className="bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400">Manqué</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const isUserCreator = () => user && reunion && user.uid === reunion.creatorId;
  const getUserParticipantRole = () => participants.find(p => p.contactId === user?.uid)?.role || null;
  const hasEditPermission = () => {
    const role = getUserParticipantRole();
    return isUserCreator() || role === 'host' || role === 'co-host';
  };

  const toggleContact = (id: string) => {
    if (selectedContacts.includes(id)) setSelectedContacts(selectedContacts.filter(s => s !== id));
    else setSelectedContacts([...selectedContacts, id]);
  };

  const updateContactRole = (id: string, role: 'host'|'co-host'|'participant') => setRolesMap({ ...rolesMap, [id]: role });

  const handleReprogram = async () => {
    if (!user || !reunion) return;
    const userRole = getUserParticipantRole();
    const isCreator = isUserCreator();
    const isOrganizer = userRole === 'host' || userRole === 'co-host';

    const newRoomId = `room_${Date.now()}_${user.uid}`;
    const newRoomUrl = `${window.location.origin}/meeting/${encodeURIComponent(newRoomId)}?userName=${encodeURIComponent(user.displayName || user.email || 'User')}`;

    if (isCreator || isOrganizer) {
      const confirmed = window.confirm('Voulez-vous reprogrammer cette réunion ? Tous les statuts des invitations seront remis à en attente.');
      if (!confirmed) return;
      const ok = await callService.reprogramReunion(reunion.id, newRoomId, newRoomUrl);
      if (ok) {
        toast.success('Réunion reprogrammée avec succès');
        const snap = await getDoc(doc(db, 'reunions', reunion.id));
        if (snap.exists()) setReunion({ id: snap.id, ...(snap.data() as ReunionData) });
      } else {
        toast.error('Erreur lors de la reprogrammation');
      }
      return;
    }

    if (reunion.type === 'private') {
      const confirmed = window.confirm('Ceci va créer une nouvelle réunion privée et vous en deviendrez le créateur. Continuer ?');
      if (!confirmed) return;
      const cloneResult = await callService.cloneReunionAsNew(reunion.id, user.uid);
        if (cloneResult) {
        toast.success('Réunion privée recréée en tant que nouvel organisateur');
        await updateDoc(doc(db, 'reunions', reunion.id), { status: 'replaced', updatedAt: serverTimestamp() });
        navigate(`/calls/${cloneResult.id}`);
      } else {
        toast.error('Erreur lors de la recréation');
      }
      return;
    }

    toast.error('Vous n\'êtes pas autorisé à reprogrammer cette réunion.');
  };

  const handleGenerateLinkNow = async () => {
    if (!user || !reunion) return;
    if (!hasEditPermission()) {
      toast.error('Seul l\'organisateur, co-organisateur ou le créateur peut générer le lien.');
      return;
    }

    if (reunion.roomId && reunion.roomUrl) {
      toast.info('Un lien de réunion existe déjà.');
      return;
    }

    const confirmed = window.confirm('Générer maintenant un lien de réunion accessible à tous les invités ?');
    if (!confirmed) return;

    try {
      const newRoomId = `room_${Date.now()}_${user.uid}`;
      const newRoomUrl = `${window.location.origin}/meeting/${encodeURIComponent(newRoomId)}?userName=${encodeURIComponent(user.displayName || user.email || 'User')}`;

      await updateDoc(doc(db, 'reunions', reunion.id), {
        roomId: newRoomId,
        roomUrl: newRoomUrl,
        updatedAt: serverTimestamp(),
      });

      const invQ = query(collection(db, 'invitations'), where('reunionId', '==', reunion.id));
      const invSnap = await getDocs(invQ);
      const updates = invSnap.docs.map(async (d) => {
        await updateDoc(doc(db, 'invitations', d.id), {
          url: newRoomUrl,
          zegoRoomId: newRoomId,
          updatedAt: serverTimestamp(),
        });
      });
      await Promise.all(updates);

      const snap = await getDoc(doc(db, 'reunions', reunion.id));
      if (snap.exists()) setReunion({ id: snap.id, ...(snap.data() as ReunionData) });

      toast.success('Lien de réunion généré avec succès');
    } catch (e) {
      console.error('Error generating room link', e);
      toast.error('Erreur lors de la génération du lien');
    }
  };

  const handleInviteMembers = async () => {
    if (!user || !reunion) return;
    if (!hasEditPermission()) {
      toast.error('Seul l\'organisateur, co-organisateur ou le créateur peut inviter des membres.');
      return;
    }
    const toInvite = selectedContacts.map(id => {
      const c = contacts.find(x => x.id === id);
      const contactId = (c as ContactRecord)?.invitId || (c as ContactRecord)?.id;
      return { contactId, role: rolesMap[id] || 'participant' };
    }).filter(Boolean);
    if (toInvite.length === 0) {
      toast.error('Sélectionnez au moins un contact');
      return;
    }
    const ok = await callService.inviteMembersToReunion(reunion.id, user.uid, toInvite, reunion.roomUrl || '', reunion.roomId || '');
    if (ok) {
      setIsInviteOpen(false);
      setSelectedContacts([]);
      toast.success('Invitations envoyées');
    } else {
      toast.error('Erreur lors de l\'envoi des invitations');
    }
  };

  const totalPages = Math.ceil(participants.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedParticipants = participants.slice(startIndex, endIndex);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/calls')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour à l'historique
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{reunion.title}</h1>
            <Badge variant={reunion.status === 'completed' ? 'secondary' : 'default'}>
              {reunion.status === 'completed' ? 'Terminé' : reunion.status}
            </Badge>
            {!reunion.roomId && !reunion.roomUrl && (
              <p className="mt-2 text-xs text-muted-foreground">
                Aucun lien de salle n'a encore été généré pour cette réunion. Utilisez "Générer le lien maintenant" pour permettre aux invités de la rejoindre.
              </p>
            )}
          </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.open(reunion.roomUrl ?? `/meeting/${encodeURIComponent(String(reunion.roomId ?? reunion.id))}?userName=${encodeURIComponent(user?.displayName || user?.email || 'User')}`, '_blank')} disabled={!reunion.roomUrl && !reunion.roomId}>
                Rejoindre
              </Button>
              <Button
                variant="outline"
                onClick={handleGenerateLinkNow}
                disabled={!hasEditPermission() || (!!reunion.roomId && !!reunion.roomUrl)}
              >
                Générer le lien maintenant
              </Button>
              <Button variant="outline" onClick={handleReprogram} disabled={!hasEditPermission() && reunion.type !== 'private'}>
              <Calendar className="mr-2 h-4 w-4" />
              Reprogrammer
            </Button>
            <Button onClick={() => setIsInviteOpen(true)} disabled={!hasEditPermission()}>
              <UserPlus className="mr-2 h-4 w-4" />
              Inviter des membres
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Durée</p>
                      <p className="font-semibold">
                        {(() => {
                          const getDuration = () => {
                            const toMillis = (v: Timestamp | number | string | null | undefined) => {
                              if (!v) return null;
                              if (v instanceof Timestamp) return v.toDate().getTime();
                              if (typeof v === 'number') return v;
                              if (typeof v === 'string') return new Date(v).getTime();
                              return null;
                            };
                            const debuts = participants.map(p => toMillis(p.debut)).filter(Boolean) as number[];
                            const ends = participants.map(p => toMillis(p.dateFin)).filter(Boolean) as number[];
                            if (debuts.length > 0 && ends.length > 0) {
                              const start = Math.min(...debuts);
                              const end = Math.max(...ends);
                              return Math.round((end - start) / 60000);
                            }
                            if (reunion.begin && ends.length > 0) {
                              const rBegin = toMillis(reunion.begin);
                              if (rBegin) {
                                const end = Math.max(...ends);
                                return Math.round((end - rBegin) / 60000);
                              }
                            }
                            return null;
                          };
                          const duration = getDuration();
                          return duration !== null ? `${duration} minutes` : '—';
                        })()
                      }</p>
                    </div>
                  </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Participants</p>
                      <p className="font-semibold">{participants.length} personnes</p>
                    </div>
                  </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Date</p>
                        <p className="font-semibold">
                          {reunion.begin ? (reunion.begin instanceof Timestamp ? reunion.begin.toDate().toLocaleString('fr-FR') : new Date(reunion.begin as string).toLocaleString('fr-FR')) : '—'}
                        </p>
                      </div>
                    </div>
            </CardContent>
          </Card>
        </div>

        {isInviteOpen && (
          <Card>
            <CardHeader>
              <CardTitle>Inviter des membres</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Sélectionnez les contacts à inviter</p>
                <div className="space-y-2 max-h-48 overflow-y-auto border p-2 rounded">
                  {contacts.map(c => (
                    <div key={c.id} className="flex items-center gap-3">
                      <input type="checkbox" checked={selectedContacts.includes(c.id)} onChange={() => toggleContact(c.id)} />
                      <div className="flex-1">{String(c.name)}</div>
                      {selectedContacts.includes(c.id) && (
                        <select value={rolesMap[c.id] || 'participant'} onChange={(e) => updateContactRole(c.id, e.target.value as 'host'|'co-host'|'participant')}>
                          <option value="host">Organisateur</option>
                          <option value="co-host">Co-organisateur</option>
                          <option value="participant">Participant</option>
                        </select>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleInviteMembers}>Envoyer</Button>
                  <Button variant="outline" onClick={() => setIsInviteOpen(false)}>Annuler</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {reunion.description && (
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{reunion.description}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Participants ({participants.length})</CardTitle>
            <div className="flex items-center border border-border rounded-lg p-1 gap-1 bg-card">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => { setViewMode('grid'); setCurrentPage(1); }}
                title="Affichage grille"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => { setViewMode('table'); setCurrentPage(1); }}
                title="Affichage tableau"
              >
                <Table2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === 'grid' ? (
              <div className="space-y-4">
                {paginatedParticipants.map((participant) => {
                  const contact = getParticipantDetails(participant.profile || null, participant.contactId);
                  if (!contact) return null;

                  const rawName = (contact as Record<string, unknown> | null)?.['displayName']
                    || (contact as Record<string, unknown> | null)?.['name']
                    || participant.contactId;
                  const isCurrentUser = user && participant.contactId === user.uid;
                  const baseName = isCurrentUser ? 'Vous' : String(rawName);
                  const maxLen = 20;
                  const displayName = baseName.length > maxLen
                    ? baseName.slice(0, maxLen - 1) + '…'
                    : baseName;

                  const email = String((contact as Record<string, unknown> | null)?.['email'] || '');

                  return (
                    <div
                      key={participant.contactId}
                      className="flex items-center justify-between p-4 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                          {String(displayName).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className={`font-semibold ${isCurrentUser ? 'text-primary' : ''}`}>
                            {displayName}
                          </h4>
                          {email && (
                            <p className="text-sm text-muted-foreground">{email}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(participant.status)}
                        {getRoleBadge(participant.role || 'participant')}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-gradient-to-r from-muted/40 to-transparent">
                        <th className="px-6 py-4 text-left font-semibold text-foreground">Nom</th>
                        <th className="px-6 py-4 text-left font-semibold text-foreground">Email</th>
                        <th className="px-6 py-4 text-left font-semibold text-foreground">Statut</th>
                        <th className="px-6 py-4 text-left font-semibold text-foreground">Rôle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedParticipants.map((participant) => {
                        const contact = getParticipantDetails(participant.profile || null, participant.contactId);
                        if (!contact) return null;

                        const rawName = (contact as Record<string, unknown> | null)?.['displayName']
                          || (contact as Record<string, unknown> | null)?.['name']
                          || participant.contactId;
                        const isCurrentUser = user && participant.contactId === user.uid;
                        const baseName = isCurrentUser ? 'Vous' : String(rawName);
                        const email = String((contact as Record<string, unknown> | null)?.['email'] || '');

                        return (
                          <tr key={participant.contactId} className="border-b border-border/30 hover:bg-primary/5 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                                  {String(baseName).charAt(0).toUpperCase()}
                                </div>
                                <span className={`font-semibold ${isCurrentUser ? 'text-primary' : ''}`}>{baseName}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-foreground">{email || '—'}</td>
                            <td className="px-6 py-4">{getStatusBadge(participant.status)}</td>
                            <td className="px-6 py-4">{getRoleBadge(participant.role || 'participant')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {Math.ceil(participants.length / ITEMS_PER_PAGE) > 1 && (
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                    <div className="text-sm text-muted-foreground">
                      Affichage {startIndex + 1} à {Math.min(endIndex, participants.length)} sur {participants.length} participants
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                      >
                        Précédent
                      </Button>
                      <div className="flex items-center gap-2 px-3 text-sm font-medium">
                        Page {currentPage} / {totalPages}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Suivant
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CallDetails;
