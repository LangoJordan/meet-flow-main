import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/firebase/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, X } from 'lucide-react';
import { toast } from 'sonner';
import { mockContacts } from '@/data/mockData';

interface Contact {
  id: string;
  name?: string;
  invitId?: string;
  email?: string;
  [key: string]: unknown;
}

const InvitationForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduledDate: '',
    scheduledTime: '',
    type: '' as '' | 'public' | 'private' | 'organizational',
    scheduleNow: false,
  });

  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [roles, setRoles] = useState<Record<string, 'host' | 'co-host' | 'participant'>>({});

  const toggleContact = (contactId: string) => {
    if (selectedContacts.includes(contactId)) {
      setSelectedContacts(selectedContacts.filter(id => id !== contactId));
      const newRoles = { ...roles };
      delete newRoles[contactId];
      setRoles(newRoles);
    } else {
      setSelectedContacts([...selectedContacts, contactId]);
      setRoles({ ...roles, [contactId]: 'participant' });
    }
  };

  const updateRole = (contactId: string, role: 'host' | 'co-host' | 'participant') => {
    setRoles({ ...roles, [contactId]: role });
  };

  const { user } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate
    if (!user) {
      toast.error('Vous devez être connecté pour créer une invitation');
      return;
    }
    if (!formData.title || !formData.description) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }
    if (!formData.type) {
      toast.error('Veuillez sélectionner un type de réunion');
      return;
    }

    if (!formData.scheduleNow && (!formData.scheduledDate || !formData.scheduledTime)) {
      toast.error('Veuillez renseigner la date et l\'heure programmées ou choisir "Programmer maintenant"');
      return;
    }
    if (selectedContacts.length === 0) {
      toast.error('Veuillez sélectionner au moins un participant');
      return;
    }

    (async () => {
      try {
        // Build begin date
        const now = new Date();
        const beginDate = formData.scheduleNow
          ? now
          : new Date(`${formData.scheduledDate}T${formData.scheduledTime}`);

        // Génération conditionnelle du lien de réunion
        let roomId: string | null = null;
        let roomUrl: string | null = null;
        if (formData.scheduleNow) {
          roomId = `room_${Date.now()}_${user.uid}`;
          roomUrl = `${window.location.origin}/meeting/${encodeURIComponent(roomId)}?userName=${encodeURIComponent(user.displayName || user.email || 'User')}`;
        }

        // Create reunion
        const reunionRef = await addDoc(collection(db, 'reunions'), {
          begin: beginDate,
          createdAt: serverTimestamp(),
          creatorId: user.uid,
          description: formData.description,
          roomUrl: roomUrl ?? '',
          roomId: roomId ?? '',
          status: 'scheduled',
          title: formData.title,
          type: formData.type || 'public',
        });

        // Create invitations for each selected contact
        const selectedContactsDocs = contacts.filter(c => selectedContacts.includes(c.id));
        const promises = selectedContactsDocs.map(async (c) => {
          const role = roles[c.id] || 'participant';
          await addDoc(collection(db, 'invitations'), {
            callerId: user.uid,
            contactId: c.invitId,
            createdAt: serverTimestamp(),
            dateFin: null,
            debut: formData.scheduleNow ? serverTimestamp() : null,
            reunionId: reunionRef.id,
            role: role,
            status: 'pending',
            viewed: false,
            url: roomUrl ?? '',
            zegoRoomId: roomId ?? '',
          });
        });

        await Promise.all(promises);

        // Appel backend pour envoyer les emails d'invitation (non bloquant pour l'utilisateur)
        try {
          const emailInvitations = selectedContactsDocs
            .filter(c => c.email)
            .map(c => ({
              toEmail: c.email as string,
              toName: c.name || '',
              meetingTitle: formData.title,
              meetingDescription: formData.description,
              begin: beginDate.toISOString(),
              roomUrl: roomUrl ?? '',
            }));

          if (emailInvitations.length > 0) {
            void fetch('http://localhost:4000/api/send-invitations-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ invitations: emailInvitations }),
            }).catch((err) => {
              console.warn('Failed to call send-invitations-email endpoint', err);
            });
          }
        } catch (emailErr) {
          console.warn('Error preparing invitation emails', emailErr);
        }

        toast.success('Réunion et invitations créées avec succès');
        navigate('/invitations');
      } catch (err) {
        console.error('Error creating reunion/invitations', err);
        toast.error('Erreur lors de la création des invitations');
      }
    })();
  };

  // Load contacts for the current user
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const q = query(collection(db, 'contacts'), where('creatorId', '==', user.uid));
        const snap = await getDocs(q);
        const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as Contact) } as Contact));
        setContacts(items);
      } catch (e) {
        console.error('Error loading contacts', e);
      }
    })();
  }, [user]);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/invitations')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux invitations
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Nouvelle invitation</CardTitle>
            <CardDescription>
              Créez une invitation pour une nouvelle réunion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Titre de la réunion *</Label>
                <Input
                  id="title"
                  placeholder="Ex: Réunion stratégique mensuelle"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Objectifs / Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Décrivez les objectifs de cette réunion..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type de réunion *</Label>
                <Select 
                  value={formData.type}
                  onValueChange={(value: 'public' | 'private' | 'organizational') => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Publique</SelectItem>
                    <SelectItem value="private">Privée</SelectItem>
                    <SelectItem value="organizational">Organisationnelle</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                    required={!formData.scheduleNow}
                    disabled={formData.scheduleNow}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Heure *</Label>
                  <Input
                    id="time"
                    type="time"
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                    required={!formData.scheduleNow}
                    disabled={formData.scheduleNow}
                  />
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="scheduleNow"
                  checked={formData.scheduleNow}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, scheduleNow: Boolean(checked) })
                  }
                />
                <div>
                  <Label htmlFor="scheduleNow">Programmer maintenant</Label>
                  <p className="text-xs text-muted-foreground">
                    Si cette option est cochée, la réunion est disponible immédiatement et le lien est généré.
                    Sinon, le lien sera généré plus tard via la gestion de la réunion.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <Label>Sélectionner les participants *</Label>
                <div className="space-y-3 max-h-64 overflow-y-auto border border-border rounded-lg p-4">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="flex items-center gap-3">
                      <Checkbox
                        id={contact.id}
                        checked={selectedContacts.includes(contact.id)}
                        onCheckedChange={() => toggleContact(contact.id)}
                      />
                      <Label 
                        htmlFor={contact.id} 
                        className="flex-1 cursor-pointer"
                      >
                        {contact.name}
                      </Label>
                      {selectedContacts.includes(contact.id) && (
                        <Select
                          value={roles[contact.id]}
                          onValueChange={(value: 'host' | 'co-host' | 'participant') => updateRole(contact.id, value)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="host">Organisateur</SelectItem>
                            <SelectItem value="co-host">Co-organisateur</SelectItem>
                            <SelectItem value="participant">Participant</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {selectedContacts.length > 0 && (
                <div className="space-y-2">
                  <Label>Participants sélectionnés ({selectedContacts.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedContacts.map((contactId) => {
                      const contact = contacts.find(c => c.id === contactId);
                      return (
                        <Badge key={contactId} variant="secondary" className="gap-1">
                          {contact?.name} ({roles[contactId]})
                          <X 
                            className="h-3 w-3 cursor-pointer" 
                            onClick={() => toggleContact(contactId)}
                          />
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button type="submit" className="flex-1">
                  Envoyer l'invitation
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => navigate('/invitations')}
                >
                  Annuler
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default InvitationForm;
