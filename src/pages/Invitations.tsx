import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Mail, Clock, Users, Filter, User, UserPlus, CalendarClock, Grid3x3, Table2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebase/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { toast } from 'sonner';
import { notifyInvitationAccepted, notifyInvitationDeclined } from '@/services/notificationService';

interface InvitationItem {
  id: string;
  reunionId: string;
  callerId: string;
  contactId: string;
  status: string;
  url: string;
  zegoRoomId: string;
  viewed: boolean;
  debut: unknown;
  dateFin: unknown;
  role: string;
  createdAt: unknown;
}

interface ReunionData {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  status: string;
  type: string;
  begin: Timestamp | number | string | null;
  roomId: string;
  roomUrl: string;
}

interface ParticipantItem extends InvitationItem {
  profile: Record<string, unknown> | null;
}

const dateToDisplay = (d: Timestamp | number | string | null) => {
  if (!d) return '—';
  try {
    if (!d) return '—';
    if (d instanceof Timestamp) {
      return d.toDate().toLocaleString('fr-FR');
    }
    if (typeof d === 'number') return new Date(d).toLocaleString('fr-FR');
    return new Date(d).toLocaleString('fr-FR');
  } catch (e) {
    return '—';
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950/30">En attente</Badge>;
    case 'accepted':
      return <Badge className="bg-success dark:bg-success/20 text-success dark:text-success">Acceptée</Badge>;
    case 'declined':
      return <Badge variant="destructive">Refusée</Badge>;
    case 'missed':
      return <Badge variant="outline" className="bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400">Manqué</Badge>;
    case 'expired':
      return <Badge variant="destructive">Terminée</Badge>;
    default:
      return null;
  }
};

const getTypeBadge = (type: string) => {
  switch (type) {
    case 'public':
      return <Badge variant="secondary">Publique</Badge>;
    case 'private':
      return <Badge>Privée</Badge>;
    case 'organizational':
      return <Badge className="bg-accent">Organisationnelle</Badge>;
    default:
      return null;
  }
};

const Invitations = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reunions, setReunions] = useState<Array<{ reunion: ReunionData; participants: ParticipantItem[]; myInvitation?: InvitationItem | null; createdByMe: boolean }>>([]);
  const [filter, setFilter] = useState<'all' | 'createdByMe' | 'invited' | 'future'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    if (!user || !user.uid) {
      setLoading(false);
      return;
    }

    const createdQuery = query(collection(db, 'reunions'), where('creatorId', '==', user.uid));
    const unsubCreated = onSnapshot(createdQuery, async () => {
      await buildList();
    });

    const receivedQuery = query(collection(db, 'invitations'), where('contactId', '==', user.uid));
    const unsubReceived = onSnapshot(receivedQuery, async () => {
      await buildList();
    });

    void buildList();

    async function buildList() {
      setLoading(true);
      try {
        const [createdSnap, receivedSnap] = await Promise.all([
          getDocs(query(collection(db, 'reunions'), where('creatorId', '==', user.uid))),
          getDocs(query(collection(db, 'invitations'), where('contactId', '==', user.uid)))
        ]);

        const createdReunions = createdSnap.docs.map(d => ({ id: d.id, ...(d.data() as ReunionData) })) as ReunionData[];
        const receivedInvitations = receivedSnap.docs.map(d => ({ id: d.id, ...(d.data() as InvitationItem) })) as InvitationItem[];

        const reunionIds = new Set<string>();
        createdReunions.forEach(r => reunionIds.add(r.id));
        receivedInvitations.forEach(i => i.reunionId && reunionIds.add(i.reunionId));

        const reunionPromises = Array.from(reunionIds).map(reunionId =>
          getDoc(doc(db, 'reunions', reunionId))
            .then(snap => snap.exists() ? { id: snap.id, ...(snap.data() as ReunionData) } as ReunionData : null)
            .catch(e => {
              console.warn('Error loading reunion', reunionId, e);
              return null;
            })
        );

        const reunions = await Promise.all(reunionPromises);
        const validReunions = reunions.filter((r): r is ReunionData => r !== null);

        const invitationPromises = validReunions.map(reunion =>
          getDocs(query(collection(db, 'invitations'), where('reunionId', '==', reunion.id)))
            .then(async invSnap => {
              const participants = await Promise.all(
                invSnap.docs.map(async p => {
                  const pd = { id: p.id, ...(p.data() as InvitationItem) } as InvitationItem;
                  try {
                    const profSnap = await getDoc(doc(db, 'profiles', pd.contactId));
                    return { ...pd, profile: profSnap.exists() ? profSnap.data() : null } as ParticipantItem;
                  } catch (e) {
                    return { ...pd, profile: null } as ParticipantItem;
                  }
                })
              );

              if (!participants.some(p => p.contactId === reunion.creatorId)) {
                try {
                  const creatorProfSnap = await getDoc(doc(db, 'profiles', reunion.creatorId));
                  const creatorParticipant: ParticipantItem = {
                    id: `creator-${reunion.creatorId}`,
                    reunionId: reunion.id,
                    callerId: reunion.creatorId,
                    contactId: reunion.creatorId,
                    status: 'accepted',
                    url: reunion.roomUrl || '',
                    zegoRoomId: reunion.roomId || '',
                    viewed: true,
                    debut: null,
                    dateFin: null,
                    role: 'host',
                    createdAt: reunion.begin || null,
                    profile: creatorProfSnap.exists() ? creatorProfSnap.data() as Record<string, unknown> : null,
                  };
                  participants.unshift(creatorParticipant);
                } catch (e) {
                  const creatorParticipant: ParticipantItem = {
                    id: `creator-${reunion.creatorId}`,
                    reunionId: reunion.id,
                    callerId: reunion.creatorId,
                    contactId: reunion.creatorId,
                    status: 'accepted',
                    url: reunion.roomUrl || '',
                    zegoRoomId: reunion.roomId || '',
                    viewed: true,
                    debut: null,
                    dateFin: null,
                    role: 'host',
                    createdAt: reunion.begin || null,
                    profile: null,
                  };
                  participants.unshift(creatorParticipant);
                }
              }

              const myInvitation = participants.find(p => p.contactId === user.uid) || null;
              const createdByMe = reunion.creatorId === user.uid;

              return { reunion, participants, myInvitation, createdByMe };
            })
            .catch(e => {
              console.warn('Error loading invitations for reunion', e);
              return null;
            })
        );

        const items = (await Promise.all(invitationPromises)).filter(item => item !== null) as Array<{ reunion: ReunionData; participants: ParticipantItem[]; myInvitation?: InvitationItem | null; createdByMe: boolean }>;

        items.sort((a, b) => {
          // First, sort by status: in-progress first, then others
          const aIsInProgress = a.reunion.status === 'in-progress';
          const bIsInProgress = b.reunion.status === 'in-progress';

          if (aIsInProgress && !bIsInProgress) return -1;
          if (!aIsInProgress && bIsInProgress) return 1;

          // Then sort by date (most recent first)
          const aBegin = a.reunion.begin;
          const bBegin = b.reunion.begin;
          const aT = aBegin ? (aBegin instanceof Timestamp ? aBegin.toDate().getTime() : (typeof aBegin === 'number' ? aBegin : new Date(aBegin).getTime())) : 0;
          const bT = bBegin ? (bBegin instanceof Timestamp ? bBegin.toDate().getTime() : (typeof bBegin === 'number' ? bBegin : new Date(bBegin).getTime())) : 0;
          return bT - aT;
        });

        setReunions(items);
      } catch (err) {
        console.error('Error building reunions list', err);
      } finally {
        setLoading(false);
      }
    }

    return () => {
      unsubCreated();
      unsubReceived();
    };
  }, [user]);

  const handleAcceptInvitation = useCallback(async (invitationId: string, invitation: InvitationItem, reunion: ReunionData) => {
    if (!user?.uid) return;
    try {
      const beginTime = reunion.begin
        ? (reunion.begin instanceof Timestamp
          ? reunion.begin.toDate().getTime()
          : (typeof reunion.begin === 'number' ? reunion.begin : new Date(reunion.begin).getTime()))
        : 0;
      const now = Date.now();

      if (!reunion.roomId || !reunion.roomUrl) {
        toast.error(`Réunion indisponible pour l'instant. Elle sera accessible ultérieurement une fois le lien généré.`);
        return;
      }

      if (beginTime > now) {
        const dateStr = dateToDisplay(reunion.begin);
        toast.error(`Réunion indisponible pour l'instant. Elle sera accessible à partir du ${dateStr}.`);
        return;
      }

      await updateDoc(doc(db, 'invitations', invitationId), { status: 'accepted', viewed: true, updatedAt: serverTimestamp() });
      toast.success('Invitation acceptée');

      try {
        const reunionId = invitation.reunionId;
        const callerId = invitation.callerId;
        await notifyInvitationAccepted(callerId, invitation.reunionId, invitationId, user.displayName || user.email || 'User');
      } catch (e) {
        console.warn('Error notifying caller', e);
      }
      const roomId = invitation.zegoRoomId || reunion.roomId;
      const joinPath = `/meeting/${encodeURIComponent(roomId)}`;
      navigate(joinPath);

    } catch (error) {
      console.error('Error accepting invitation', error);
      toast.error('Erreur lors de l\'acceptation');
    }
  }, [user, navigate]);

  const handleDeclineInvitation = useCallback(async (invitationId: string) => {
    if (!user?.uid) return;
    try {
      const invSnap = await getDoc(doc(db, 'invitations', invitationId));
      let callerId: string | null = null;
      let reunionId: string | null = null;
      if (invSnap.exists()) {
        const data = invSnap.data() as InvitationItem;
        callerId = data.callerId;
        reunionId = data.reunionId;
      }

      await updateDoc(doc(db, 'invitations', invitationId), {
        status: 'declined',
        viewed: true,
        updatedAt: serverTimestamp(),
      });
      toast.success('Invitation refusée');

      if (callerId && reunionId) {
        await notifyInvitationDeclined(
          callerId,
          reunionId,
          invitationId,
          user.displayName || user.email || 'User',
        );
      }
    } catch (error) {
      console.error('Error declining invitation', error);
      toast.error('Erreur lors du refus');
    }
  }, [user]);

  const getParticipantName = (participant: ParticipantItem) => {
    const profile = participant.profile as Record<string, unknown> | null;
    if (!profile) return participant.contactId;
    const displayName = (profile['displayName'] as unknown as string) || (profile['name'] as unknown as string) || participant.contactId;
    return displayName;
  };

  const getParticipantDisplayName = (participant: ParticipantItem) => {
    if (participant.contactId === user?.uid) {
      return "Vous";
    }
    const fullName = getParticipantName(participant);
    return fullName.length > 15 ? fullName.substring(0, 15) + '...' : fullName;
  };

  const isCurrentUser = (participant: ParticipantItem) => {
    return participant.contactId === user?.uid;
  };

  const filteredReunions = useMemo(() =>
    reunions.filter(({ reunion, myInvitation, createdByMe }) => {
      if (filter === 'createdByMe') {
        return createdByMe;
      }
      if (filter === 'invited') {
        return !createdByMe && !!myInvitation;
      }
      if (filter === 'future') {
        const begin = reunion.begin;
        const beginTime = begin
          ? (begin instanceof Timestamp
            ? begin.toDate().getTime()
            : (typeof begin === 'number' ? begin : new Date(begin).getTime()))
          : 0;
        return beginTime > Date.now();
      }
      return true;
    }), [reunions, filter]
  );

  const totalPages = Math.ceil(filteredReunions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedReunions = filteredReunions.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Réunions & Invitations</h1>
            <p className="text-muted-foreground">Toutes vos réunions (créées et reçues)</p>
          </div>
          <div className="flex flex-col items-stretch md:items-end gap-3">
            <div className="inline-flex rounded-full border bg-card p-1 text-xs shadow-sm">
              <Button
                type="button"
                variant={filter === 'all' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-full px-3 flex items-center gap-1"
                onClick={() => setFilter('all')}
              >
                <Filter className="h-3 w-3" />
                <span>Toutes</span>
              </Button>
              <Button
                type="button"
                variant={filter === 'createdByMe' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-full px-3 flex items-center gap-1"
                onClick={() => setFilter('createdByMe')}
              >
                <User className="h-3 w-3" />
                <span>Créées par moi</span>
              </Button>
              <Button
                type="button"
                variant={filter === 'invited' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-full px-3 flex items-center gap-1"
                onClick={() => setFilter('invited')}
              >
                <UserPlus className="h-3 w-3" />
                <span>Où je suis invité</span>
              </Button>
              <Button
                type="button"
                variant={filter === 'future' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-full px-3 flex items-center gap-1"
                onClick={() => setFilter('future')}
              >
                <CalendarClock className="h-3 w-3" />
                <span>Réunions futures</span>
              </Button>
            </div>
            <div className="flex gap-2 items-center justify-end">
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
              <Link to="/invitations/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouvelle invitation
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {filteredReunions.length === 0 && (
            <div className="text-center py-12">
              <Mail className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">Aucune réunion trouvée</p>
              <Link to="/invitations/new">
                <Button>Créer votre première réunion</Button>
              </Link>
            </div>
          )}

          {viewMode === 'grid' && (
            paginatedReunions.map(({ reunion, participants, myInvitation, createdByMe }) => {
              const acceptedCount = participants.filter(p => p.status === 'accepted').length;
              const pendingCount = participants.filter(p => p.status === 'pending').length;
              const beginTime = reunion.begin ? (reunion.begin instanceof Timestamp ? reunion.begin.toDate().getTime() : (typeof reunion.begin === 'number' ? reunion.begin : new Date(reunion.begin).getTime())) : 0;
              const isPast = beginTime < Date.now();

              return (
                <Card key={reunion.id} className={`hover:shadow-lg transition-shadow ${createdByMe ? 'border-primary/20' : ''}`}>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold">{reunion.title}</h3>
                            {getStatusBadge(reunion.status)}
                            {getTypeBadge(reunion.type)}
                            {createdByMe && <Badge className="ml-2">Créateur</Badge>}
                            {!createdByMe && myInvitation?.status === 'pending' && <Badge className="ml-2">Invité</Badge>}
                          </div>
                          <p className="text-muted-foreground mb-3">{reunion.description}</p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          {dateToDisplay(reunion.begin)}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {dateToDisplay(reunion.begin)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {acceptedCount}/{participants.length} accepté(s)
                        </div>
                        {pendingCount > 0 && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-4 w-4" />
                            {pendingCount} en attente
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground">
                            Participants : {participants.map(p => getParticipantDisplayName(p)).join(', ')}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          {reunion.status === 'in-progress' && (
                            <Button
                              size="sm"
                              className="bg-success hover:bg-success/90"
                              onClick={() => navigate(`/meeting/${encodeURIComponent(reunion.roomId || reunion.id)}?userName=${encodeURIComponent(user?.displayName || user?.email || 'User')}`)}
                            >
                              Rejoindre
                            </Button>
                          )}
                          {!createdByMe && myInvitation?.status === 'pending' && (
                            <>
                              <Button
                                className="mr-2"
                                onClick={() => handleAcceptInvitation(myInvitation.id, myInvitation, reunion)}
                              >
                                Accepter
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => handleDeclineInvitation(myInvitation.id)}
                              >
                                Refuser
                              </Button>
                            </>
                          )}
                          {createdByMe && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/calls/${reunion.id}`)}
                            >
                              Gérer
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2">
                        {participants.map((participant) => (
                          <div
                            key={participant.id}
                            className="flex items-center gap-2 p-2 border border-border rounded text-sm"
                          >
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                              {isCurrentUser(participant) ? 'V' : getParticipantName(participant).charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium truncate ${isCurrentUser(participant) ? 'font-bold text-primary' : ''}`}>
                                {getParticipantDisplayName(participant)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {participant.status === 'accepted' && '✓ Accepté'}
                                {participant.status === 'pending' && '⏱ En attente'}
                                {participant.status === 'declined' && '✗ Refusé'}
                                {participant.status === 'missed' && '⏱ Manqué'}
                                {participant.contactId === reunion.creatorId && ' • Organisateur'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}

          {viewMode === 'table' && (
            <>
              <Card className="border-0 shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-gradient-to-r from-muted/40 to-transparent">
                        <th className="px-6 py-4 text-left font-semibold text-foreground">Titre</th>
                        <th className="px-6 py-4 text-left font-semibold text-foreground">Type</th>
                        <th className="px-6 py-4 text-left font-semibold text-foreground">Statut</th>
                        <th className="px-6 py-4 text-left font-semibold text-foreground">Date</th>
                        <th className="px-6 py-4 text-center font-semibold text-foreground">Participants</th>
                        <th className="px-6 py-4 text-right font-semibold text-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedReunions.map(({ reunion, participants, myInvitation, createdByMe }) => {
                        const acceptedCount = participants.filter(p => p.status === 'accepted').length;
                        return (
                          <tr key={reunion.id} className="border-b border-border/30 hover:bg-primary/5 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-sm border border-primary/30">
                                  {reunion.title?.charAt(0).toUpperCase() || 'R'}
                                </div>
                                <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{reunion.title}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">{getTypeBadge(reunion.type || 'private')}</td>
                            <td className="px-6 py-4">{getStatusBadge(reunion.status)}</td>
                            <td className="px-6 py-4 text-foreground">{dateToDisplay(reunion.begin)}</td>
                            <td className="px-6 py-4 text-center">
                              <Badge variant="outline">{acceptedCount}/{participants.length}</Badge>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex gap-2 justify-end">
                                {reunion.status === 'in-progress' && (
                                  <Button
                                    size="sm"
                                    className="bg-success hover:bg-success/90"
                                    onClick={() => navigate(`/meeting/${encodeURIComponent(reunion.roomId || reunion.id)}?userName=${encodeURIComponent(user?.displayName || user?.email || 'User')}`)}
                                  >
                                    Rejoindre
                                  </Button>
                                )}
                                {!createdByMe && myInvitation?.status === 'pending' && (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() => handleAcceptInvitation(myInvitation.id, myInvitation, reunion)}
                                      className="bg-primary hover:bg-primary/90 text-white"
                                    >
                                      Accepter
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeclineInvitation(myInvitation.id)}
                                    >
                                      Refuser
                                    </Button>
                                  </>
                                )}
                                {createdByMe && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => navigate(`/calls/${reunion.id}`)}
                                  >
                                    Gérer
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              {filteredReunions.length > 0 && (
                <div className="flex items-center justify-between p-4 bg-card rounded-lg border border-border">
                  <div className="text-sm text-muted-foreground">
                    Affichage {startIndex + 1} à {Math.min(endIndex, filteredReunions.length)} sur {filteredReunions.length} réunions
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
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Invitations;
