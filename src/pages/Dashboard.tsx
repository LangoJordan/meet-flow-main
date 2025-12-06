import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video, Calendar, Users, Phone, Clock, TrendingUp, ArrowUpRight, Zap, Star } from "lucide-react";
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebase/firebase';
import { collection, query, where, getDocs, Timestamp, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { calculateMeetingDuration, formatDuration } from '@/utils/durationCalculator';

  interface ReunionDoc { id: string; title?: string; description?: string; creatorId?: string; status?: string; begin?: Timestamp | number | string | null; roomId?: string; roomUrl?: string }
  interface InvitationDoc { id: string; reunionId?: string; callerId?: string; contactId?: string; status?: string; debut?: Timestamp | number | string | null; dateFin?: Timestamp | number | string | null }

export default function Dashboard() {
  const { user } = useAuth();
  const [contactsCount, setContactsCount] = useState<number | null>(null);
  const [meetingsThisMonth, setMeetingsThisMonth] = useState<number | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<number | null>(null);
  const [totalMinutes, setTotalMinutes] = useState<number | null>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);
  type MeetingPreview = { id: string; title: string; objectives?: string; participants?: Record<string, unknown>[]; begin?: Timestamp | number | string | null; roomId?: string | null; roomUrl?: string | null };
  const [upcomingMeetings, setUpcomingMeetings] = useState<MeetingPreview[]>([]);
  type RecentCall = { id: string; contact: string; type: string; duration: string; date: string; status: string };
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const stats = [
    {
      title: "Réunions ce mois",
      value: meetingsThisMonth ?? 0,
      icon: Video,
      gradient: "from-blue-500 to-blue-600",
      bgGradient: "from-blue-500/10 to-blue-500/5",
      change: "+12%",
      color: "text-blue-500"
    },
    {
      title: "Contacts",
      value: contactsCount ?? 0,
      icon: Users,
      gradient: "from-purple-500 to-purple-600",
      bgGradient: "from-purple-500/10 to-purple-500/5",
      change: "+5",
      color: "text-purple-500"
    },
    {
      title: "Temps total en réunion",
      value: totalMinutes !== null ? formatDuration(totalMinutes) : "—",
      valueIsString: true,
      icon: Clock,
      gradient: "from-green-500 to-green-600",
      bgGradient: "from-green-500/10 to-green-500/5",
      change: "Tous les appels",
      color: "text-green-500"
    }
  ];

  // When user is authenticated, load real data
  useEffect(() => {
    if (!user) return;
    setStatsLoading(true);

    const contactsQ = query(collection(db, 'contacts'), where('creatorId', '==', user.uid));
    const unsubContacts = onSnapshot(contactsQ, (snap) => {
      setContactsCount(snap.size);
    }, (err) => {
      console.error('contacts onSnapshot error', err);
      setContactsCount(0);
    });

    const pendingInvQ = query(collection(db, 'invitations'), where('callerId', '==', user.uid), where('status', '==', 'pending'));
    const unsubPending = onSnapshot(pendingInvQ, (snap) => {
      setPendingInvitations(snap.size);
    }, (err) => {
      console.error('invitations onSnapshot error', err);
      setPendingInvitations(0);
    });

    const reunionsQ = query(collection(db, 'reunions'), where('creatorId', '==', user.uid));
    const unsubReunions = onSnapshot(reunionsQ, async (snap) => {
      try {
        const createdReunions = snap.docs.map(d => ({ id: d.id, ...(d.data() as ReunionDoc) }));

        // Charger aussi les réunions où l'utilisateur est invité (contactId == user.uid)
        const myInvSnap = await getDocs(query(collection(db, 'invitations'), where('contactId', '==', user.uid)));
        const myInvitations = myInvSnap.docs.map(d => ({ id: d.id, ...(d.data() as InvitationDoc) }));

        const invitedReunionIds = Array.from(new Set(myInvitations.map(inv => String(inv.reunionId || '')))).filter(Boolean);
        const invitedReunions: ReunionDoc[] = [];
        for (const rid of invitedReunionIds) {
          // Éviter de recharger si déjà dans createdReunions
          if (createdReunions.some(r => r.id === rid)) continue;
          try {
            const rSnap = await getDoc(doc(db, 'reunions', rid));
            if (rSnap.exists()) {
              invitedReunions.push({ id: rSnap.id, ...(rSnap.data() as ReunionDoc) });
            }
          } catch (e) {
            console.warn('Error loading invited reunion for dashboard', e);
          }
        }

        const allReunions: ReunionDoc[] = [...createdReunions, ...invitedReunions];

        // Meetings this month (créées ou où l'on est invité)
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const startTs = firstOfMonth;
        const thisMonthCount = allReunions.filter(r => {
          const b = r.begin;
          let t: number | null = null;
          if (!b) return false;
          if (b instanceof Timestamp) t = b.toDate().getTime();
          else if (typeof b === 'number') t = b;
          else t = new Date(String(b)).getTime();
          return t >= startTs && t <= Date.now();
        }).length;
        setMeetingsThisMonth(thisMonthCount);

        // Upcoming meetings (next 3) — réunions futures où je suis créateur OU invité, et qui ne sont pas complétées
        const nowTs = Date.now();
        const upcoming = allReunions
          .filter(r => {
            if (r.status === 'completed' || !r.begin) return false;
            const t = r.begin instanceof Timestamp
              ? r.begin.toDate().getTime()
              : typeof r.begin === 'number'
                ? r.begin
                : new Date(String(r.begin)).getTime();
            return !Number.isNaN(t) && t > nowTs;
          })
          .sort((a, b) => {
            const ta = (a.begin instanceof Timestamp) ? a.begin.toDate().getTime() : (typeof a.begin === 'number' ? a.begin : new Date(String(a.begin)).getTime());
            const tb = (b.begin instanceof Timestamp) ? b.begin.toDate().getTime() : (typeof b.begin === 'number' ? b.begin : new Date(String(b.begin)).getTime());
            return ta - tb;
          })
          .slice(0, 3);

        setUpcomingMeetings(
          upcoming.map(r => ({
            id: r.id,
            title: r.title || 'Réunion',
            objectives: r.description || '',
            participants: [],
            begin: r.begin,
            roomId: r.roomId ?? null,
            roomUrl: r.roomUrl ?? null,
          })),
        );

        // Recent completed calls — dernières réunions complétées où je suis créateur OU invité
        const completed = allReunions.filter(r => r.status === 'completed');
        const lastCompleted = completed.slice().sort((a,b) => {
          const ta = a.begin instanceof Timestamp ? a.begin.toDate().getTime() : (typeof a.begin === 'number' ? a.begin : a.begin ? new Date(String(a.begin)).getTime() : 0);
          const tb = b.begin instanceof Timestamp ? b.begin.toDate().getTime() : (typeof b.begin === 'number' ? b.begin : b.begin ? new Date(String(b.begin)).getTime() : 0);
          return tb - ta;
        }).slice(0, 5);

        // Fetch invitations to calculate duration for each call
        const durationPromises = lastCompleted.map(async (r) => {
          try {
            const invQ = query(collection(db, 'invitations'), where('reunionId', '==', r.id));
            const invSnap = await getDocs(invQ);
            let totalDuration = 0;

            invSnap.docs.forEach((doc) => {
              const inv = doc.data() as InvitationDoc;
              if (inv.debut && inv.dateFin) {
                const debut = inv.debut instanceof Timestamp ? inv.debut.toDate() : new Date(String(inv.debut));
                const dateFin = inv.dateFin instanceof Timestamp ? inv.dateFin.toDate() : new Date(String(inv.dateFin));
                const duration = Math.max(0, (dateFin.getTime() - debut.getTime()) / 60000);
                totalDuration = Math.max(totalDuration, duration);
              }
            });

            return {
              id: r.id,
              contact: r.title || 'Réunion',
              type: 'video',
              duration: totalDuration > 0 ? formatDuration(Math.round(totalDuration)) : '—',
              date: r.begin ? (r.begin instanceof Timestamp ? r.begin.toDate().toLocaleDateString('fr-FR') : new Date(String(r.begin)).toLocaleDateString('fr-FR')) : '—',
              status: r.status,
            };
          } catch (e) {
            console.warn('Error calculating duration for reunion:', e);
            return {
              id: r.id,
              contact: r.title || 'Réunion',
              type: 'video',
              duration: '—',
              date: r.begin ? (r.begin instanceof Timestamp ? r.begin.toDate().toLocaleDateString('fr-FR') : new Date(String(r.begin)).toLocaleDateString('fr-FR')) : '—',
              status: r.status,
            };
          }
        });

        const formattedCalls = await Promise.all(durationPromises);
        setRecentCalls(formattedCalls);

        // Compute total minutes for completed reunions by fetching invitations for each completed reunion
        try {
          const completedReunions = completed;
          if (!completedReunions.length) {
            setTotalMinutes(0);
          } else {
            // Streamline invitations fetch with batched 'in' queries (FireStore supports up to 10 values per in query)
            const ids = completedReunions.map(r => r.id);
            const chunkSize = 10;
            const chunks: string[][] = [];
            for (let i = 0; i < ids.length; i += chunkSize) chunks.push(ids.slice(i, i + chunkSize));
            const allInvPromises = chunks.map(async (chunk) => {
              const invQ = query(collection(db, 'invitations'), where('reunionId', 'in', chunk));
              const invSnap = await getDocs(invQ);
              return invSnap.docs.map(d => d.data() as InvitationDoc);
            });
            const allInvChunks = await Promise.all(allInvPromises);
            const allInvs = allInvChunks.flat();
            // Group invitations by reunionId
            const byReunion: Record<string, InvitationDoc[]> = {};
            allInvs.forEach(i => {
              if (!i.reunionId) return;
              const rid = String(i.reunionId);
              if (!byReunion[rid]) byReunion[rid] = [];
              byReunion[rid].push(i);
            });
            let totalMins = 0;
            for (const rid of Object.keys(byReunion)) {
              const invs = byReunion[rid];
              const { meetingDurationMinutes } = calculateMeetingDuration(invs);
              if (meetingDurationMinutes !== null) {
                totalMins += meetingDurationMinutes;
              }
            }
            setTotalMinutes(totalMins || 0);
          }
        } catch (e) {
          console.error('error computing minutes', e);
          setTotalMinutes(0);
        }

      } catch (err) {
        console.error('Error processing reunions snapshot', err);
      } finally {
        setStatsLoading(false);
      }
    }, (err) => {
      console.error('reunions onSnapshot error', err);
      setMeetingsThisMonth(0);
      setUpcomingMeetings([]);
      setRecentCalls([]);
      setTotalMinutes(0);
      setStatsLoading(false);
    });

    return () => { unsubContacts(); unsubPending(); unsubReunions(); };
  }, [user]);

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header with Enhanced Design */}
        <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent rounded-3xl p-8 border border-primary/20 backdrop-blur-sm overflow-hidden relative">
          {/* Decorative background elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          </div>
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex-1">
              <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Tableau de bord</h1>
              <p className="text-lg text-muted-foreground mb-2">Bienvenue <span className="font-semibold text-foreground">{user?.displayName || 'sur votre espace'}</span></p>
              <div className="flex gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm text-muted-foreground">En ligne et actif</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm text-muted-foreground">Premium actif</span>
                </div>
              </div>
            </div>
            
            <Link to="/meeting/new" className="flex-shrink-0">
              <Button size="lg" className="bg-gradient-to-r from-primary to-primary/90 hover:shadow-lg hover:shadow-primary/40 text-white font-semibold transition-all shadow-lg shadow-primary/30 whitespace-nowrap">
                <Video className="w-5 h-5 mr-2" />
                Démarrer une réunion
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid - Enhanced */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, index) => (
            <Card 
              key={index} 
              className="relative overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 group"
              style={{animationDelay: `${index * 0.1}s`}}
            >
              {/* Gradient background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
              
              <CardHeader className="pb-3 relative z-10">
                <div className="flex items-center justify-between">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-100 dark:bg-green-950/30 px-3 py-1 rounded-full">
                    <ArrowUpRight className="w-3 h-3" />
                    {stat.change}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                {statsLoading ? (
                  <div className="space-y-2">
                    <div className="w-24 h-8 bg-muted/30 rounded animate-pulse" />
                    <div className="w-32 h-4 bg-muted/20 rounded animate-pulse" />
                  </div>
                ) : (
                  <>
                    <div className="text-4xl font-bold mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">{stat.value}</div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upcoming Meetings */}
          <Card className="border-0 shadow-md overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-calendar/5 to-transparent pb-4">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <div className="w-10 h-10 bg-gradient-to-br from-calendar to-calendar/60 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                Réunions à venir
              </CardTitle>
              <CardDescription>Vos prochaines réunions planifiées</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {statsLoading ? (
                <>
                  {[1,2,3].map(i => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-muted/30 animate-pulse">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-muted/50" />
                        <div className="flex-1">
                          <div className="h-4 bg-muted/50 rounded w-32 mb-2" />
                          <div className="h-3 bg-muted/50 rounded w-20" />
                        </div>
                      </div>
                      <div className="h-8 bg-muted/50 rounded w-16" />
                    </div>
                  ))}
                </>
              ) : (
                upcomingMeetings.map((meeting) => (
                  <div 
                    key={meeting.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-muted/40 to-transparent hover:from-muted/60 transition-all duration-300 group border border-border/30"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Video className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold group-hover:text-primary transition-colors">{meeting.title}</h4>
                        <p className="text-xs text-muted-foreground">{meeting.participants?.length || 0} participant{(meeting.participants?.length || 0) !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <Link to={meeting.roomUrl ?? `/meeting/${encodeURIComponent(String(meeting.roomId ?? meeting.id))}?userName=${encodeURIComponent(user?.displayName || user?.email || 'User')}`}>
                      <Button variant="default" size="sm" className="bg-primary hover:bg-primary/90">
                        Rejoindre
                      </Button>
                    </Link>
                  </div>
                ))
              )}
              
              {upcomingMeetings.length === 0 && !statsLoading && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">Aucune réunion prévue</p>
                  <Link to="/invitations/new">
                    <Button variant="outline" size="sm">
                      Planifier une réunion
                    </Button>
                  </Link>
                </div>
              )}
              
              <Link to="/invitations" className="block">
                <Button variant="outline" className="w-full hover:bg-muted/60 transition-all">
                  Voir toutes les invitations
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Recent Calls */}
          <Card className="border-0 shadow-md overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-phone/5 to-transparent pb-4">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                Historique récent
              </CardTitle>
              <CardDescription>Vos derniers appels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
              {statsLoading ? (
                <>
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 animate-pulse">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-muted/50" />
                        <div className="flex-1">
                          <div className="h-3 bg-muted/50 rounded w-32 mb-2" />
                          <div className="h-2 bg-muted/50 rounded w-20" />
                        </div>
                      </div>
                      <div className="h-3 bg-muted/50 rounded w-16" />
                    </div>
                  ))}
                </>
              ) : (
                recentCalls.map((call, idx) => (
                  <div 
                    key={call.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/40 transition-all duration-300 group border border-border/0 hover:border-border/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${
                        call.type === 'video' ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-purple-500 to-purple-600'
                      } flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                        {call.type === 'video' ? (
                          <Video className="w-5 h-5 text-white" />
                        ) : (
                          <Phone className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h5 className="font-medium text-sm group-hover:text-primary transition-colors truncate">{call.contact}</h5>
                        <p className="text-xs text-muted-foreground">{call.duration}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground flex-shrink-0 ml-4">{call.date}</div>
                  </div>
                ))
              )}
              
              <Link to="/calls" className="block">
                <Button variant="outline" className="w-full hover:bg-muted/60 transition-all">
                  Voir tout l'historique
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="border-0 shadow-md overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-4">
            <CardTitle className="text-2xl">Actions rapides</CardTitle>
            <CardDescription>Accédez rapidement aux fonctionnalités principales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link to="/invitations/new" className="group">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 hover:from-blue-500/20 hover:to-blue-500/10 border border-blue-500/30 hover:border-blue-500/50 transition-all duration-300 cursor-pointer h-full">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-500/30 group-hover:scale-110 transition-all">
                    <Video className="w-6 h-6 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-sm mb-1">Nouvelle réunion</h4>
                  <p className="text-xs text-muted-foreground">Démarrer instantanément</p>
                </div>
              </Link>
              
              <Link to="/contacts/new" className="group">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 hover:from-purple-500/20 hover:to-purple-500/10 border border-purple-500/30 hover:border-purple-500/50 transition-all duration-300 cursor-pointer h-full">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mb-3 group-hover:bg-purple-500/30 group-hover:scale-110 transition-all">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                  <h4 className="font-semibold text-sm mb-1">Nouveau contact</h4>
                  <p className="text-xs text-muted-foreground">Ajouter quelqu'un</p>
                </div>
              </Link>
              
              <Link to="/invitations/new" className="group">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 hover:from-orange-500/20 hover:to-orange-500/10 border border-orange-500/30 hover:border-orange-500/50 transition-all duration-300 cursor-pointer h-full">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center mb-3 group-hover:bg-orange-500/30 group-hover:scale-110 transition-all">
                    <Calendar className="w-6 h-6 text-orange-600" />
                  </div>
                  <h4 className="font-semibold text-sm mb-1">Reunions</h4>
                  <p className="text-xs text-muted-foreground">Voir toutes les réunions</p>
                </div>
              </Link>
              
              <Link to="/settings" className="group">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-green-500/10 to-green-500/5 hover:from-green-500/20 hover:to-green-500/10 border border-green-500/30 hover:border-green-500/50 transition-all duration-300 cursor-pointer h-full">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center mb-3 group-hover:bg-green-500/30 group-hover:scale-110 transition-all">
                    <Zap className="w-6 h-6 text-green-600" />
                  </div>
                  <h4 className="font-semibold text-sm mb-1">Paramètres</h4>
                  <p className="text-xs text-muted-foreground">Configurer l'app</p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Custom animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.6s ease-out;
        }
      `}</style>
    </DashboardLayout>
  );
}
