import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Video,
  Users,
  History,
  Mail,
  Settings,
  LogOut,
  Plus,
  Home,
  Share2,
  Check,
  TrendingUp,
  Clock,
  UserCheck,
  Zap,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { db } from '@/firebase/firebase';
import { collection, query, where, getDocs, onSnapshot, getDoc, doc } from 'firebase/firestore';

const menuItems = [
  { icon: Home, label: 'Tableau de bord', path: '/dashboard', color: 'text-blue-500' },
  { icon: Users, label: 'Contacts', path: '/contacts', color: 'text-purple-500' },
  { icon: History, label: 'Historique', path: '/calls', color: 'text-orange-500' },
  { icon: Mail, label: 'Reunions', path: '/invitations', color: 'text-pink-500' },
  { icon: MessageSquare, label: 'Messages', path: '/messages', color: 'text-green-500' },
];

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('sidebarCollapsed');
    return stored === 'true';
  });

  // Persist collapse state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('sidebarCollapsed', isCollapsed.toString());
    }
  }, [isCollapsed]);
  const [contactsCount, setContactsCount] = useState(0);
  const [callsCount, setCallsCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  const isActive = (path: string) => location.pathname === path;

  // Fetch real stats from Firestore
  useEffect(() => {
    if (!user) {
      setStatsLoading(false);
      return;
    }

    setStatsLoading(true);

    // Subscribe to contacts
    const contactsQ = query(collection(db, 'contacts'), where('creatorId', '==', user.uid));
    const unsubContacts = onSnapshot(contactsQ, async (snap) => {
      setContactsCount(snap.size);

      // Count how many of these contacts are online and have visibility enabled
      const contactInvitIds = snap.docs.map(doc => doc.data().invitId).filter(Boolean);

      if (contactInvitIds.length > 0) {
        try {
          // Fetch all those profiles and check if they're online AND have getVisibility enabled
          const profilePromises = contactInvitIds.map(invitId =>
            getDoc(doc(db, 'profiles', invitId))
          );
          const profileSnaps = await Promise.all(profilePromises);

          const onlineVisibleCount = profileSnaps.filter(snap => {
            if (!snap.exists()) return false;
            const data = snap.data();
            return data.isOnline === true && data.getVisibility !== false;
          }).length;

          setOnlineCount(onlineVisibleCount);
        } catch (err) {
          console.error('Error counting online visible contacts:', err);
          setOnlineCount(0);
        }
      } else {
        setOnlineCount(0);
      }
    }, (err) => {
      console.error('contacts onSnapshot error', err);
      setContactsCount(0);
      setOnlineCount(0);
    });

    // Subscribe to total reunions (created by user + reunions where user was invited)
    const createdReunionsQ = query(collection(db, 'reunions'), where('creatorId', '==', user.uid));
    const unsubCreatedReunions = onSnapshot(createdReunionsQ, async (createdSnap) => {
      try {
        const createdCount = createdSnap.size;

        // Also count reunions where user has received an invitation
        const invitationsQ = query(collection(db, 'invitations'), where('contactId', '==', user.uid));
        const invitationsSnap = await getDocs(invitationsQ);
        const invitedReunionIds = new Set(
          invitationsSnap.docs
            .map(doc => doc.data().reunionId)
            .filter(Boolean)
        );

        // Avoid double-counting: if user created a reunion, it's already counted in createdCount
        const createdReunionIds = new Set(createdSnap.docs.map(doc => doc.id));
        const uniqueInvitedCount = Array.from(invitedReunionIds).filter(id => !createdReunionIds.has(id)).length;

        const totalCount = createdCount + uniqueInvitedCount;
        setCallsCount(totalCount);
      } catch (err) {
        console.error('error counting total reunions', err);
        setCallsCount(0);
      }
    }, (err) => {
      console.error('reunions onSnapshot error', err);
      setCallsCount(0);
    });

    setStatsLoading(false);

    return () => {
      unsubContacts();
      unsubCreatedReunions();
    };
  }, [user]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      toast.success('Déconnexion réussie');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Erreur lors de la déconnexion');
      setIsLoggingOut(false);
    }
  };

  const handleShareLink = async () => {
    const appUrl = `${window.location.origin}/register`;
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      toast.success('Lien copié dans le presse-papiers!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Impossible de copier le lien');
    }
  };

  // Get user initials
  const userInitials = (user?.displayName || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const stats = [
    { icon: UserCheck, label: 'Contacts', value: contactsCount, color: 'bg-purple-500/10 text-purple-500' },
    { icon: History, label: 'Appels', value: callsCount, color: 'bg-blue-500/10 text-blue-500' },
    { icon: Zap, label: 'En ligne', value: onlineCount, color: 'bg-green-500/10 text-green-500' },
  ];

  return (
    <aside className={`min-h-screen bg-card border-r border-border/50 flex flex-col overflow-y-auto transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`}>
      {/* Header Section */}
      <div className={`p-6 sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border/30 z-10 transition-all duration-300 ${isCollapsed ? 'p-4' : ''}`}>
        <div className="flex items-center justify-between mb-6">
          {!isCollapsed && (
            <Link to="/dashboard" className="flex items-center gap-2 group flex-1">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform flex-shrink-0">
                <Video className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent whitespace-nowrap">MeetApp</h1>
            </Link>
          )}
          {isCollapsed && (
            <Link to="/dashboard" className="flex items-center justify-center w-10 h-10 group">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                <Video className="h-6 w-6 text-white" />
              </div>
            </Link>
          )}
          
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-foreground/5 rounded-lg transition-all"
            title={isCollapsed ? 'Développer' : 'Réduire'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronLeft className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
        </div>

        {!isCollapsed && (
          <>
            {/* User Profile Card */}
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-3 mb-4 border border-primary/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-sm border border-primary/30 flex-shrink-0">
                  {userInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{user?.displayName || 'Utilisateur'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
            </div>

            <Link to="/invitations/new">
              <Button className="w-full bg-primary hover:bg-primary/90 text-white font-semibold transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30">
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle réunion
              </Button>
            </Link>
          </>
        )}
      </div>

      {/* Main Content */}
      {!isCollapsed && (
        <div className="flex-1 px-3 py-4 space-y-4">
          {/* Navigation Section */}
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start relative group transition-all ${
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
                    }`}
                  >
                    <Icon className={`mr-3 h-5 w-5 ${item.color}`} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                    )}
                  </Button>
                </Link>
              );
            })}
          </div>

          <Separator className="my-2 opacity-50" />

          {/* Stats Section */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">Statistiques</p>
            <div className="grid grid-cols-3 gap-2">
              {stats.map((stat, idx) => {
                const StatIcon = stat.icon;
                return (
                  <div
                    key={idx}
                    className={`${stat.color} rounded-lg p-3 text-center hover:scale-105 transition-transform cursor-default group`}
                  >
                    <div className="flex justify-center mb-1">
                      <StatIcon className="h-4 w-4" />
                    </div>
                    {statsLoading ? (
                      <div className="h-6 bg-muted/20 rounded animate-pulse mb-1" />
                    ) : (
                      <p className="text-lg font-bold text-foreground group-hover:scale-110 transition-transform">{stat.value}</p>
                    )}
                    <p className="text-xs text-muted-foreground whitespace-nowrap">{stat.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator className="my-2 opacity-50" />

          {/* Share Section */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">Partager</p>
            <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-xl p-4 border border-accent/20 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Invitez vos amis</h3>
                <p className="text-xs text-muted-foreground">Partagez MeetApp et commencez à collaborer</p>
              </div>
              <Button
                onClick={handleShareLink}
                variant="outline"
                className="w-full text-xs hover:bg-accent/20 transition-all"
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4 text-green-500" />
                    Copié!
                  </>
                ) : (
                  <>
                    <Share2 className="mr-2 h-4 w-4" />
                    Copier le lien
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Quick Tips Section */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">Conseil</p>
            <div className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 rounded-xl p-3 border border-blue-500/20 space-y-2">
              <div className="flex gap-2">
                <Zap className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Conseil du jour</p>
                  <p className="text-xs text-muted-foreground">Utilisez les raccourcis clavier pour aller plus vite</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed Navigation */}
      {isCollapsed && (
        <div className="flex-1 px-2 py-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`w-full h-10 justify-center relative group transition-all ${
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
                  }`}
                  title={item.label}
                >
                  <Icon className={`h-5 w-5 ${item.color}`} />
                </Button>
              </Link>
            );
          })}

          <Separator className="my-2 opacity-50" />

          {/* Collapsed Stats */}
          <div className="space-y-2">
            {stats.map((stat, idx) => {
              const StatIcon = stat.icon;
              return (
                <div
                  key={idx}
                  className={`${stat.color} rounded-lg p-2 text-center hover:scale-105 transition-transform cursor-default group flex flex-col items-center`}
                  title={stat.label}
                >
                  <StatIcon className="h-4 w-4 mb-1" />
                  {statsLoading ? (
                    <div className="h-4 w-6 bg-muted/20 rounded animate-pulse" />
                  ) : (
                    <p className="text-sm font-bold">{stat.value}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer Section */}
      <div className={`p-3 space-y-1 border-t border-border/30 bg-foreground/2 sticky bottom-0 ${isCollapsed ? 'p-2' : ''}`}>
        {!isCollapsed && (
          <>
            <Link to="/settings">
              <Button
                variant="ghost"
                className="w-full justify-start text-foreground/70 hover:text-foreground hover:bg-foreground/5"
              >
                <Settings className="mr-3 h-5 w-5" />
                Paramètres
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/5"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              <LogOut className="mr-3 h-5 w-5" />
              {isLoggingOut ? 'Déconnexion...' : 'Déconnexion'}
            </Button>
          </>
        )}
        {isCollapsed && (
          <>
            <Link to="/settings">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-10 justify-center text-foreground/70 hover:text-foreground hover:bg-foreground/5"
                title="Paramètres"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-10 justify-center text-destructive hover:text-destructive hover:bg-destructive/5"
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Déconnexion"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>

      {/* Custom Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </aside>
  );
};
