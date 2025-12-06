import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Video, Clock, Users, Grid3x3, Table2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebase/firebase';
import { collection, query, where, getDocs, getDoc, doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { calculateParticipantDuration, formatDuration } from '@/utils/durationCalculator';

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
  url?: string;
  zegoRoomId?: string;
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

const CallHistory = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState<Array<{ reunion: ReunionData; participants: ParticipantItem[]; myInvitation?: InvitationItem | null; createdByMe: boolean }>>([]);
  const [filter, setFilter] = useState<'all' | 'accepted' | 'declined' | 'missed'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'public' | 'private' | 'organizational'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="secondary">Terminé</Badge>;
      case 'ongoing':
        return <Badge className="bg-success">En cours</Badge>;
      case 'scheduled':
        return <Badge variant="outline">Programmé</Badge>;
      default:
        return null;
    }
  };

  useEffect(() => {
    if (!user || !user.uid) {
      setLoading(false);
      return;
    }

    const createdQuery = query(collection(db, 'reunions'), where('creatorId', '==', user.uid));
    const unsubCreated = onSnapshot(createdQuery, async () => await buildList());

    const receivedQuery = query(collection(db, 'invitations'), where('contactId', '==', user.uid));
    const unsubReceived = onSnapshot(receivedQuery, async () => await buildList());

    void buildList();

    async function buildList() {
      setLoading(true);
      try {
        // Load created and received in parallel
        const [createdSnap, receivedSnap] = await Promise.all([
          getDocs(query(collection(db, 'reunions'), where('creatorId', '==', user.uid))),
          getDocs(query(collection(db, 'invitations'), where('contactId', '==', user.uid)))
        ]);

        const createdReunions = createdSnap.docs.map(d => ({ id: d.id, ...(d.data() as ReunionData) })) as ReunionData[];
        const receivedInvitations = receivedSnap.docs.map(d => ({ id: d.id, ...(d.data() as InvitationItem) })) as InvitationItem[];

        const reunionIds = new Set<string>();

        // Add completed reunions created by user
        createdReunions.forEach((r) => {
          if (r.status === 'completed') reunionIds.add(r.id);
        });

        // Check received invitations for relevant reunions
        const invitationReunionPromises = receivedInvitations.map(inv =>
          getDoc(doc(db, 'reunions', inv.reunionId))
            .then(reunionSnap => {
              if (!reunionSnap.exists()) return null;
              const reunion = { id: reunionSnap.id, ...(reunionSnap.data() as ReunionData) } as ReunionData;
              const isDeclinedOrMissed = inv.status === 'declined' || inv.status === 'expired';
              const isAcceptedAndCompleted = inv.status === 'accepted' && reunion.status === 'completed';
              return (isDeclinedOrMissed || isAcceptedAndCompleted) ? reunion.id : null;
            })
            .catch(err => {
              console.warn('Error checking reunion for invitation', err);
              return null;
            })
        );

        const relevantReunionIds = (await Promise.all(invitationReunionPromises))
          .filter((id): id is string => id !== null);
        relevantReunionIds.forEach(id => reunionIds.add(id));

        // Load all reunions in parallel
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

        // Load all invitations and profiles in parallel
        const callPromises = validReunions.map(reunion =>
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

              // Ensure creator is in participants
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
              console.warn('Error loading call details', e);
              return null;
            })
        );

        const items = (await Promise.all(callPromises)).filter(item => item !== null) as Array<{ reunion: ReunionData; participants: ParticipantItem[]; myInvitation?: InvitationItem | null; createdByMe: boolean }>;

        items.sort((a, b) => {
          const aBegin = a.reunion.begin;
          const bBegin = b.reunion.begin;
          const aT = aBegin ? (aBegin instanceof Timestamp ? aBegin.toDate().getTime() : (typeof aBegin === 'number' ? aBegin : new Date(aBegin).getTime())) : 0;
          const bT = bBegin ? (bBegin instanceof Timestamp ? bBegin.toDate().getTime() : (typeof bBegin === 'number' ? bBegin : new Date(bBegin).getTime())) : 0;
          return bT - aT;
        });

        setCalls(items);
      } catch (err) {
        console.error('Error building call list', err);
      } finally {
        setLoading(false);
      }
    }

    return () => { unsubCreated(); unsubReceived(); };
  }, [user]);

  const getParticipantNames = (participants: ParticipantItem[]) => {
    return participants.map(p => (p.profile?.['displayName'] as string) || (p.profile?.['name'] as string) || p.contactId).filter(Boolean).join(', ');
  };

  const getTypeBadge = (type?: string) => {
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

  const getDurationMinutes = (reunion: ReunionData, participants: ParticipantItem[]) => {
    // compute earliest debut and latest dateFin among participants if available
    const toMillis = (value: unknown) => {
      if (!value) return null;
      if (value instanceof Timestamp) return value.toDate().getTime();
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d.getTime();
      }
      return null;
    };
    const debuts = participants.map(p => toMillis(p.debut)).filter(Boolean) as number[];
    const ends = participants.map(p => toMillis(p.dateFin)).filter(Boolean) as number[];
    if (debuts.length > 0 && ends.length > 0) {
      const start = Math.min(...debuts);
      const end = Math.max(...ends);
      return Math.round((end - start) / 60000);
    }
    // fallback: if reunion.begin and there is a participant dateFin
    const rBegin = toMillis(reunion.begin);
    if (rBegin && ends.length > 0) {
      const end = Math.max(...ends);
      return Math.round((end - rBegin) / 60000);
    }
    return null;
  };

    const dateToDisplay = (d: Timestamp | number | string | null | undefined) => {
      if (!d) return '—';
      try {
        if (d instanceof Timestamp) return d.toDate().toLocaleString('fr-FR');
        if (typeof d === 'number') return new Date(d).toLocaleString('fr-FR');
        return new Date(d).toLocaleString('fr-FR');
      } catch (e) {
        return '—';
      }
    };

    const filteredCalls = useMemo(() =>
      calls.filter(({ myInvitation, createdByMe, reunion }) => {
        // Filtre type
        if (typeFilter !== 'all' && reunion.type !== typeFilter) return false;

        // Filtre statut
        if (filter === 'all') return true;

        // For created calls, show them regardless of status filter
        if (createdByMe) return true;

        // For received invitations, apply the status filter
        if (!myInvitation) return false;
        if (filter === 'accepted') return myInvitation.status === 'accepted';
        if (filter === 'declined') return myInvitation.status === 'declined';
        if (filter === 'missed') return myInvitation.status === 'expired';
        return true;
      }), [calls, filter, typeFilter]
    );

    const totalPages = Math.ceil(filteredCalls.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedCalls = filteredCalls.slice(startIndex, endIndex);

    return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Historique des appels</h1>
            <p className="text-muted-foreground">
              Consultez l'historique de toutes vos réunions
            </p>
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
          </div>
        </div>

        {/* Filtres par statut */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setFilter('all'); setCurrentPage(1); }}
          >
            Tous
          </Button>
          <Button
            variant={filter === 'accepted' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setFilter('accepted'); setCurrentPage(1); }}
          >
            Acceptés
          </Button>
          <Button
            variant={filter === 'declined' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setFilter('declined'); setCurrentPage(1); }}
          >
            Refusés
          </Button>
          <Button
            variant={filter === 'missed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setFilter('missed'); setCurrentPage(1); }}
          >
            Manqués
          </Button>
          <div className="w-px h-6 bg-border mx-2" />
          <Button
            variant={typeFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setTypeFilter('all'); setCurrentPage(1); }}
          >
            Tous types
          </Button>
          <Button
            variant={typeFilter === 'public' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setTypeFilter('public'); setCurrentPage(1); }}
          >
            Publiques
          </Button>
          <Button
            variant={typeFilter === 'private' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setTypeFilter('private'); setCurrentPage(1); }}
          >
            Privées
          </Button>
          <Button
            variant={typeFilter === 'organizational' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setTypeFilter('organizational'); setCurrentPage(1); }}
          >
            Org.
          </Button>
        </div>

        <div className="space-y-4">
        {filteredCalls.length === 0 && (
            <div className="text-center py-12">
          
            </div>
          )}

          {viewMode === 'grid' && (
            paginatedCalls.map(({ reunion, participants, myInvitation, createdByMe }) => (
            <Card key={reunion.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Video className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{reunion.title}</h3>
                          {getStatusBadge(reunion.status)}
                          {getTypeBadge(reunion.type)}
                          {createdByMe ? <Badge className="ml-2">Créateur</Badge> : (myInvitation ? <Badge className="ml-2">{myInvitation.status === 'accepted' ? 'Acceptée' : myInvitation.status === 'declined' ? 'Refusée' : myInvitation.status === 'expired' ? 'Manquée' : 'En attente'}</Badge> : null)}
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {dateToDisplay(reunion.begin)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {(() => {
                              const duration = getDurationMinutes(reunion, participants);
                              return duration !== null ? `${duration} min` : '—';
                            })()}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {participants.length} participants
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground mt-2">
                          Participants : {getParticipantNames(participants)}
                        </p>
                      </div>
                    </div>

                    <Link to={`/calls/${reunion.id}`}>
                      <Button variant="outline">Voir détails</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))
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
                        <th className="px-6 py-4 text-center font-semibold text-foreground">Durée réunion</th>
                        <th className="px-6 py-4 text-center font-semibold text-foreground">Durée moy.</th>
                        <th className="px-6 py-4 text-right font-semibold text-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCalls.map(({ reunion, participants, myInvitation, createdByMe }) => {
                        const duration = getDurationMinutes(reunion, participants);
                        const participantDurations = participants
                          .map(p => calculateParticipantDuration(p.debut, p.dateFin))
                          .filter((d): d is number => d !== null);
                        const avgParticipantDuration = participantDurations.length > 0
                          ? Math.round(participantDurations.reduce((a, b) => a + b, 0) / participantDurations.length)
                          : null;
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
                            <td className="px-6 py-4">{getStatusBadge(reunion.status)}{createdByMe && <Badge className="ml-2">Créateur</Badge>}{!createdByMe && myInvitation && <Badge className="ml-2">{myInvitation.status === 'accepted' ? 'Acceptée' : myInvitation.status === 'declined' ? 'Refusée' : myInvitation.status === 'expired' ? 'Manquée' : 'En attente'}</Badge>}</td>
                            <td className="px-6 py-4 text-foreground text-xs">{dateToDisplay(reunion.begin)}</td>
                            <td className="px-6 py-4 text-center">
                              <Badge variant="outline">{participants.length}</Badge>
                            </td>
                            <td className="px-6 py-4 text-center text-foreground">{duration !== null ? `${duration} min` : '—'}</td>
                            <td className="px-6 py-4 text-center text-foreground">{avgParticipantDuration !== null ? `${avgParticipantDuration} min` : '—'}</td>
                            <td className="px-6 py-4 text-right">
                              <Link to={`/calls/${reunion.id}`}>
                                <Button variant="outline" size="sm">Voir détails</Button>
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              {filteredCalls.length > 0 && (
                <div className="flex items-center justify-between p-4 bg-card rounded-lg border border-border">
                  <div className="text-sm text-muted-foreground">
                    Affichage {startIndex + 1} à {Math.min(endIndex, filteredCalls.length)} sur {filteredCalls.length} appels
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

        {calls.length === 0 && (
          <div className="text-center py-12">
            <Video className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Aucun appel dans l'historique</p>
            <Link to="/invitations/new">
              <Button>Créer votre première réunion</Button>
            </Link>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CallHistory;
