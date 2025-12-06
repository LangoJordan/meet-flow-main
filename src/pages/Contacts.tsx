import { useState, useEffect, useCallback } from 'react';
import { useContactPresence } from '@/hooks/useContactPresence';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Phone, Mail, Edit, Trash2, Grid3x3, Table2, Filter } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { db } from '@/firebase/firebase';
import { collection, query, where, deleteDoc, doc, getDoc, getDocs, serverTimestamp, addDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { notifyInvitationReceived } from '@/services/notificationService';
import { useNotifications } from '@/hooks/useNotifications';

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
    AudioContext?: typeof AudioContext;
  }
}

interface ContactItem {
  id: string;
  creatorId: string;
  invitId: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  isOnline: boolean;
  activeIncomingInvitationId?: string;
  activeOutgoingInvitationId?: string;
}

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

const Contacts = () => {
  const { user, loading: authLoading } = useAuth();
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [missedCallsCount, setMissedCallsCount] = useState(0);
  const [activeInvitations, setActiveInvitations] = useState<InvitationData[]>([]);
  const [callingId, setCallingId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();
  const { notifications } = useNotifications();

  const initiateCall = async (contact: ContactItem) => {
    if (!user) {
      toast.error("Vous devez être connecté pour lancer un appel");
      return;
    }

    if (!contact || !contact.invitId) {
      toast.error("Impossible d'initier l'appel : ce contact n'est pas correctement lié à un utilisateur.");
      return;
    }

    try {
      setCallingId(contact.id);

      const callerName = user.displayName || user.email || 'User';
      const roomId = `room_${Date.now()}_${user.uid}`;
      const roomUrl = `${window.location.origin}/meeting/${encodeURIComponent(roomId)}?userName=${encodeURIComponent(callerName)}`;

      const reunionRef = await addDoc(collection(db, 'reunions'), {
        title: `Appel avec ${contact.name}`,
        description: `Appel initié via contact ${contact.name}`,
        creatorId: user.uid,
        status: 'scheduled',
        begin: serverTimestamp(),
        type: 'private',
        roomId,
        roomUrl,
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'invitations'), {
        reunionId: reunionRef.id,
        callerId: user.uid,
        contactId: user.uid,
        createdAt: serverTimestamp(),
        debut: serverTimestamp(),
        dateFin: null,
        role: 'host',
        status: 'accepted',
        viewed: false,
        url: roomUrl,
        zegoRoomId: roomId,
      });

      const calleeInvRef = await addDoc(collection(db, 'invitations'), {
        reunionId: reunionRef.id,
        callerId: user.uid,
        contactId: contact.invitId,
        createdAt: serverTimestamp(),
        debut: null,
        dateFin: null,
        role: 'participant',
        status: 'pending',
        viewed: false,
        url: roomUrl,
        zegoRoomId: roomId,
      });

      try {
        await notifyInvitationReceived(
          user.uid,
          reunionRef.id,
          calleeInvRef.id,
          contact.invitId,
          callerName,
        );
      } catch (e) {
        console.warn('Failed to send invitation notification', e);
      }

      try {
        if (contact.email) {
          const emailInvitation = {
            toEmail: contact.email,
            toName: contact.name,
            meetingTitle: `Appel avec ${contact.name}`,
            meetingDescription: `Appel initié via contact ${contact.name}`,
            begin: new Date().toISOString(),
            roomUrl,
          };

          void fetch('http://localhost:4000/api/send-invitations-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invitations: [emailInvitation] }),
          }).catch((err) => {
            console.warn('Failed to call send-invitations-email endpoint from Contacts', err);
          });
        }
      } catch (emailErr) {
        console.warn('Error preparing contact invitation email', emailErr);
      }

      navigate(
        `/meeting/${encodeURIComponent(roomId)}?userName=${encodeURIComponent(
          callerName,
        )}&isCaller=true`,
      );
    } catch (err) {
      console.error("Erreur lors de l'initiation de l'appel", err);
      toast.error("Impossible d'initier l'appel. Réessayez.");
    } finally {
      setCallingId(null);
    }
  };


  // Filter contacts based on search and status
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'online' && contact.isOnline) ||
      (filterStatus === 'offline' && !contact.isOnline);
    
    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    const missedInvitations = notifications.filter(
      n => n.type === 'invitation_missed' && !n.viewed
    ).length;
    setMissedCallsCount(missedInvitations);
  }, [notifications]);

  const handleDelete = async (id: string) => {
    toast('Supprimer le contact ?', {
      description: 'Cette action est irréversible.',
      action: {
        label: "Supprimer",
        onClick: async () => {
          try {
            await deleteDoc(doc(db, "contacts", id));
            toast.success('Contact supprimé avec succès');
          } catch (error) {
            console.error("Erreur lors de la suppression:", error);
            toast.error('Erreur de suppression');
          }
        },
      },
      cancel: { label: "Annuler" },
      duration: 10000,
    });
  };

  const TableRowContact = ({ contact: contactProp }: { contact: ContactItem }) => {
    const presenceIsOnline = useContactPresence(contactProp.invitId);
    const isCallingThisContact = Boolean(contactProp.activeOutgoingInvitationId);
    const isThisContactInvitingMe = Boolean(contactProp.activeIncomingInvitationId);

    return (
      <tr className="border-b border-border/30 hover:bg-primary/5 transition-colors group">
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-sm border border-primary/30 group-hover:scale-105 transition-transform">
              {(contactProp.name?.charAt(0) || 'U').toUpperCase()}
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{contactProp.name}</span>
              {(isCallingThisContact || isThisContactInvitingMe) && (
                <Badge className="w-fit bg-blue-500 text-white text-xs">
                  {isCallingThisContact ? "Appel en cours" : "Appel entrant"}
                </Badge>
              )}
            </div>
          </div>
        </td>
        <td className="px-6 py-4 text-foreground">{contactProp.email}</td>
        <td className="px-6 py-4 text-foreground">{contactProp.phone || '—'}</td>
        <td className="px-6 py-4 text-center">
          <Badge className={presenceIsOnline ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' : 'bg-muted text-muted-foreground'}>
            {presenceIsOnline ? '🟢 En ligne' : '⚫ Hors ligne'}
          </Badge>
        </td>
        <td className="px-6 py-4 text-right">
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              onClick={() => initiateCall(contactProp)}
              disabled={!contactProp.invitId || callingId === contactProp.id}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {callingId === contactProp.id ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <Phone className="h-4 w-4" />
              )}
            </Button>
            <Link to={`/contacts/${contactProp.id}/edit`}>
              <Button variant="outline" size="sm" className="hover:bg-muted/60">
                <Edit className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDelete(contactProp.id)}
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>
    );
  };

  const ContactCard = ({ contact: contactProp, activeInvitations }: { contact: ContactItem, activeInvitations: InvitationData[] }) => {
    const contact = { ...contactProp, invitId: String(contactProp.invitId) };
    const presenceIsOnline = useContactPresence(contact.invitId);
    const isCallingThisContact = Boolean(contact.activeOutgoingInvitationId);
    const isThisContactInvitingMe = Boolean(contact.activeIncomingInvitationId);

    return (
      <Card className="relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 group">
        {/* Decorative gradient background */}
        <div className={`absolute inset-0 ${presenceIsOnline ? 'bg-gradient-to-br from-green-500/5 to-transparent' : 'bg-gradient-to-br from-muted/5 to-transparent'} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
        
        <CardContent className="p-6 relative z-10">
          {/* Top section with avatar and status */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-start gap-4 flex-1">
              <div className="relative flex-shrink-0">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-primary font-bold text-lg border border-primary/30 group-hover:scale-110 transition-transform duration-300">
                  {(contact.name?.charAt(0) || 'U').toUpperCase()}
                  {(isCallingThisContact || isThisContactInvitingMe) && (
                    <div className="absolute -top-1 -right-1 h-5 w-5 bg-blue-500 rounded-full animate-pulse flex items-center justify-center border-2 border-white">
                      <Phone className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </div>
                <div className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card ${presenceIsOnline ? 'bg-green-500' : 'bg-muted'} ring-2 ring-card`} title={presenceIsOnline ? 'En ligne' : 'Hors ligne'} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">{contact.name}</h3>
                  {(isCallingThisContact || isThisContactInvitingMe) && (
                    <Badge className="bg-blue-500 text-white text-xs animate-pulse flex-shrink-0">
                      {isCallingThisContact ? "Appel" : "Entrant"}
                    </Badge>
                  )}
                </div>
                <Badge variant="outline" className={`text-xs ${presenceIsOnline ? 'border-green-500/30 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400' : ''}`}>
                  {presenceIsOnline ? '🟢 En ligne' : '⚫ Hors ligne'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Contact info */}
          <div className="space-y-2.5 mb-5 pb-5 border-b border-border/30">
            <div className="flex items-center gap-3 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              <Mail className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{contact.email}</span>
            </div>
            {contact.phone && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                <Phone className="h-4 w-4 flex-shrink-0" />
                <span>{contact.phone}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => initiateCall(contact)}
              disabled={!contact.invitId || callingId === contact.id}
              className="flex-1 bg-primary hover:bg-primary/90 text-white transition-all"
            >
              {callingId === contact.id ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Appel...
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4" />
                  Appeler
                </>
              )}
            </Button>
            <Link to={`/contacts/${contact.id}/edit`}>
              <Button variant="outline" size="sm" className="hover:bg-muted/60">
                <Edit className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDelete(contact.id)}
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };


  const loadContacts = useCallback(async (forceRefresh = false) => {
    if (!user) {
      setContacts([]);
      setLoadingContacts(false);
      return;
    }

    setLoadingContacts(true);
    setIsRefreshing(true);

    try {
      const contactsRef = collection(db, "contacts");
      const q = query(contactsRef, where("creatorId", "==", user.uid));
      const contactsSnapshot = await getDocs(q);

      const invitationsQuery = query(
        collection(db, 'invitations'),
        where('status', '==', 'pending'),
        where('callerId', 'in', [user.uid])
      );
      const invitationsQuery2 = query(
        collection(db, 'invitations'),
        where('status', '==', 'pending'),
        where('contactId', 'in', [user.uid])
      );
      
      const [invitationsSnapshot1, invitationsSnapshot2] = await Promise.all([
        getDocs(invitationsQuery),
        getDocs(invitationsQuery2)
      ]);
      
      const currentInvitations: InvitationData[] = [];
      invitationsSnapshot1.forEach(doc => {
        currentInvitations.push({ id: doc.id, ...doc.data() } as InvitationData);
      });
      invitationsSnapshot2.forEach(doc => {
        currentInvitations.push({ id: doc.id, ...doc.data() } as InvitationData);
      });
      
      setActiveInvitations(currentInvitations);

      const fetchedContacts: ContactItem[] = [];
      const profilePromises: Promise<void>[] = [];

      for (const contactDoc of contactsSnapshot.docs) {
        const contactData = contactDoc.data();
        const invitId = String(contactData.invitId || '');
        
        if (invitId) {
          const profilePromise = getDoc(doc(db, "profiles", invitId))
            .then(profileSnap => {
              const profileData = profileSnap.exists() ? profileSnap.data() : {};
              
              const activeOutgoingInvitation = currentInvitations.find(inv => 
                inv.callerId === user?.uid && inv.contactId === String(invitId)
              );
              
              const activeIncomingInvitation = currentInvitations.find(inv => 
                inv.callerId === String(invitId) && inv.contactId === user?.uid
              );

              fetchedContacts.push({
                id: contactDoc.id,
                creatorId: contactData.creatorId,
                invitId,
                name: contactData.name || "Nom inconnu",
                email: (profileData.email as string) || contactData.email || "email@inconnu.com",
                phone: (profileData.phone as string) || contactData.phone || "",
                avatar: (profileData.avatar as string) || contactData.avatar || "",
                isOnline: (profileData.isOnline as boolean) || false,
                activeOutgoingInvitationId: activeOutgoingInvitation?.id,
                activeIncomingInvitationId: activeIncomingInvitation?.id,
              });
            })
            .catch(error => {
              console.error("Erreur lors du chargement du profil:", error);
              fetchedContacts.push({
                id: contactDoc.id,
                creatorId: contactData.creatorId,
                invitId,
                name: contactData.name || "Nom inconnu",
                email: contactData.email || "email@inconnu.com",
                phone: contactData.phone || "",
                avatar: contactData.avatar || "",
                isOnline: false,
              });
            });
            
          profilePromises.push(profilePromise);
        } else {
          fetchedContacts.push({
            id: contactDoc.id,
            creatorId: contactData.creatorId,
            invitId: "",
            name: contactData.name || "Nom inconnu",
            email: contactData.email || "email@inconnu.com",
            phone: contactData.phone || "",
            avatar: contactData.avatar || "",
            isOnline: false,
          });
        }
      }

      await Promise.all(profilePromises);
      const sortedContacts = [...fetchedContacts].sort((a, b) => a.name.localeCompare(b.name));
      setContacts(sortedContacts);
      setLastRefresh(new Date());
      
      if (forceRefresh) {
        toast.success('Contacts actualisés', {
          description: `${sortedContacts.length} contact${sortedContacts.length > 1 ? 's' : ''} chargé${sortedContacts.length > 1 ? 's' : ''}`,
          duration: 2000,
        });
      }
    } catch (error) {
      console.error("Erreur lors du chargement des contacts:", error);
      toast.error('Erreur de chargement', {
        description: 'Impossible de charger vos contacts. Veuillez réessayer.',
        duration: 5000,
      });
    } finally {
      setLoadingContacts(false);
      setIsRefreshing(false);
    }
  }, [user]);


  useEffect(() => {
    if (!user) return;
    void loadContacts();
  }, [user, loadContacts]);

  const handleRefresh = useCallback(() => {
    loadContacts(true);
  }, [loadContacts]);

  if (authLoading) {
    return <div className="text-center py-12">Chargement de la session...</div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent rounded-3xl p-8 border border-primary/20 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          </div>
          
          <div className="relative z-10 flex items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Contacts</h1>
              <p className="text-muted-foreground">Gérez vos contacts et lancez des appels vidéo</p>
            </div>
            <Link to="/contacts/new">
              <Button className="bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg shadow-primary/30">
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un contact
              </Button>
            </Link>
          </div>
        </div>


        {/* Search, filter, and refresh controls */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un contact..."
                className="pl-10 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              {/* Filter dropdown */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'all' | 'online' | 'offline')}
                  className="px-3 py-2 rounded-lg border border-border bg-card text-sm hover:bg-muted/50 transition-colors"
                >
                  <option value="all">Tous les contacts</option>
                  <option value="online">En ligne</option>
                  <option value="offline">Hors ligne</option>
                </select>
              </div>

              {/* View mode toggle */}
              <div className="flex items-center border border-border rounded-lg p-1 gap-1 bg-card">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setViewMode('grid')}
                  title="Affichage grille"
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setViewMode('table')}
                  title="Affichage tableau"
                >
                  <Table2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Refresh button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex-shrink-0"
              >
                {isRefreshing ? (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  'Rafraîchir'
                )}
              </Button>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-4 text-sm">
            {missedCallsCount > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {missedCallsCount} appel{missedCallsCount > 1 ? 's' : ''} manqué{missedCallsCount > 1 ? 's' : ''}
              </Badge>
            )}
            <Badge variant="secondary">
              {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
            </Badge>
            {lastRefresh && (
              <span className="text-muted-foreground">Dernière mise à jour: {lastRefresh.toLocaleTimeString()}</span>
            )}
          </div>
        </div>

        {/* Contacts display */}
        {loadingContacts ? (
          <div className="text-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Chargement de vos contacts...</p>
          </div>
        ) : filteredContacts.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredContacts.map((contact) => (
                <ContactCard key={contact.id} contact={contact} activeInvitations={activeInvitations} />
              ))}
            </div>
          ) : (
            <Card className="border-0 shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-gradient-to-r from-muted/40 to-transparent">
                      <th className="px-6 py-4 text-left font-semibold text-foreground">Nom</th>
                      <th className="px-6 py-4 text-left font-semibold text-foreground">Email</th>
                      <th className="px-6 py-4 text-left font-semibold text-foreground">Téléphone</th>
                      <th className="px-6 py-4 text-center font-semibold text-foreground">Statut</th>
                      <th className="px-6 py-4 text-right font-semibold text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContacts.map((contact) => (
                      <TableRowContact key={contact.id} contact={contact} />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Aucun contact trouvé</p>
            <Link to="/contacts/new">
              <Button>Ajouter votre premier contact</Button>
            </Link>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Contacts;
