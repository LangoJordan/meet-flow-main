import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useGroups } from '@/context/GroupsContext';
import { db } from '@/firebase/firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User } from 'lucide-react';
import { toast } from 'sonner';

interface GroupMemberDetail {
  userId: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
}

const GroupCallForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { groups } = useGroups();

  const groupId = searchParams.get('groupId');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduleNow: true,
  });

  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMemberDetail[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!groupId) {
      toast.error('Groupe non spécifié');
      navigate('/messages');
      return;
    }

    const group = groups.find((g) => g.id === groupId);
    if (group) {
      setSelectedGroup(group);
      setGroupMembers(group.members || []);
      setSelectedMembers(
        (group.members || []).map((m: GroupMemberDetail) => m.userId).filter((id: string) => id !== user?.uid)
      );
    }
  }, [groupId, groups, user, navigate]);

  const toggleMember = (memberId: string) => {
    if (selectedMembers.includes(memberId)) {
      setSelectedMembers(selectedMembers.filter((id) => id !== memberId));
    } else {
      setSelectedMembers([...selectedMembers, memberId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Vous devez être connecté pour créer un appel de groupe');
      return;
    }

    if (!selectedGroup) {
      toast.error('Aucun groupe sélectionné');
      return;
    }

    if (!formData.title || !formData.description) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    if (selectedMembers.length === 0) {
      toast.error('Veuillez sélectionner au moins un participant');
      return;
    }

    setIsLoading(true);

    try {
      // Generate room ID and URL for immediate calls
      let roomId: string | null = null;
      let roomUrl: string | null = null;

      if (formData.scheduleNow) {
        roomId = `room_${Date.now()}_${user.uid}`;
        roomUrl = `${window.location.origin}/meeting/${encodeURIComponent(roomId)}?userName=${encodeURIComponent(user.displayName || user.email || 'User')}`;
      }

      // Create group call record
      const callRef = await addDoc(collection(db, 'groupCalls'), {
        groupId: selectedGroup.id,
        conversationId: selectedGroup.conversationId,
        creatorId: user.uid,
        title: formData.title,
        description: formData.description,
        roomUrl: roomUrl ?? '',
        roomId: roomId ?? '',
        status: 'scheduled',
        createdAt: serverTimestamp(),
        beginDate: formData.scheduleNow ? serverTimestamp() : null,
        selectedParticipants: selectedMembers,
      });

      // Create notifications for each selected member
      const promises = selectedMembers.map(async (memberId) => {
        await addDoc(collection(db, 'callNotifications'), {
          callId: callRef.id,
          groupId: selectedGroup.id,
          conversationId: selectedGroup.conversationId,
          recipientId: memberId,
          callerId: user.uid,
          callerName: user.displayName || user.email || 'Utilisateur',
          groupName: selectedGroup.name,
          title: formData.title,
          status: 'pending',
          roomUrl: roomUrl ?? '',
          roomId: roomId ?? '',
          createdAt: serverTimestamp(),
          viewed: false,
        });
      });

      await Promise.all(promises);

      toast.success('Appel de groupe créé avec succès');

      // If scheduling now, redirect to the meeting
      if (formData.scheduleNow && roomUrl) {
        window.location.href = roomUrl;
      } else {
        navigate('/messages');
      }
    } catch (err) {
      console.error('Error creating group call:', err);
      toast.error('Erreur lors de la création de l\'appel de groupe');
    } finally {
      setIsLoading(false);
    }
  };

  if (!selectedGroup) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-muted-foreground">Chargement du groupe...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate('/messages')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux messages
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Appel de groupe</CardTitle>
            <CardDescription>
              Créez un appel de groupe pour {selectedGroup.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="groupName">Groupe</Label>
                <Input
                  id="groupName"
                  value={selectedGroup.name}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Titre de l'appel *</Label>
                <Input
                  id="title"
                  placeholder="Ex: Réunion d'équipe hebdomadaire"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description / Objectif *</Label>
                <Textarea
                  id="description"
                  placeholder="Décrivez l'objectif de cet appel..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="scheduleNow"
                  checked={formData.scheduleNow}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, scheduleNow: Boolean(checked) })
                  }
                  disabled={isLoading}
                />
                <div>
                  <Label htmlFor="scheduleNow">Commencer maintenant</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Si cochée, l'appel est disponible immédiatement et le lien est généré.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Sélectionner les participants de l'appel *
                </Label>
                <div className="space-y-3 max-h-64 overflow-y-auto border border-border rounded-lg p-4">
                  {groupMembers.map((member) => (
                    <div key={member.userId} className="flex items-center gap-3">
                      <Checkbox
                        id={member.userId}
                        checked={selectedMembers.includes(member.userId)}
                        onCheckedChange={() => toggleMember(member.userId)}
                        disabled={isLoading}
                      />
                      <Label htmlFor={member.userId} className="flex-1 cursor-pointer">
                        <div>
                          <div className="font-medium text-sm">{member.name}</div>
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                        </div>
                      </Label>
                      <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                        {member.role === 'admin' ? 'Admin' : 'Membre'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {selectedMembers.length > 0 && (
                <div className="space-y-2">
                  <Label>Participants sélectionnés ({selectedMembers.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedMembers.map((memberId) => {
                      const member = groupMembers.find((m) => m.userId === memberId);
                      return (
                        <Badge key={memberId} variant="secondary">
                          {member?.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button type="submit" className="flex-1" disabled={isLoading}>
                  {isLoading ? 'Création en cours...' : 'Lancer l\'appel de groupe'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/messages')}
                  disabled={isLoading}
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

export default GroupCallForm;
