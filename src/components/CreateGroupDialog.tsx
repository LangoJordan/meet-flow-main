import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useGroups } from '@/context/GroupsContext';
import { db } from '@/firebase/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Plus, Loader2, Crown, User } from 'lucide-react';

interface Contact {
  id: string;
  invitId: string;
  displayName: string;
  email: string;
}

interface SelectedContactWithRole {
  invitId: string;
  role: 'admin' | 'member';
  displayName: string;
  email: string;
}

interface CreateGroupDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

const CreateGroupDialog = ({ open, onOpenChange, children }: CreateGroupDialogProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createGroup } = useGroups();
  const [isOpen, setIsOpen] = useState(open ?? false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<SelectedContactWithRole[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupObjective, setGroupObjective] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(true);

  useEffect(() => {
    setIsOpen(open ?? false);
  }, [open]);

  useEffect(() => {
    if (!isOpen || !user) {
      setContactsLoading(false);
      return;
    }

    const loadContacts = async () => {
      try {
        setContactsLoading(true);
        const contactsQuery = query(collection(db, 'contacts'), where('creatorId', '==', user.uid));
        const snapshot = await getDocs(contactsQuery);
        const contactsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          invitId: doc.data().invitId,
          displayName: doc.data().displayName || doc.data().name || '',
          email: doc.data().email || '',
        }));
        setContacts(contactsData);
      } catch (error) {
        console.error('Error loading contacts:', error);
        toast.error('Erreur lors du chargement des contacts');
      } finally {
        setContactsLoading(false);
      }
    };

    loadContacts();
  }, [isOpen, user]);

  const handleToggleContact = (contact: Contact) => {
    setSelectedContacts((prev) => {
      const existing = prev.find((c) => c.invitId === contact.invitId);
      if (existing) {
        return prev.filter((c) => c.invitId !== contact.invitId);
      } else {
        return [...prev, {
          invitId: contact.invitId,
          role: 'member' as 'admin' | 'member',
          displayName: contact.displayName,
          email: contact.email
        }];
      }
    });
  };

  const handleRoleChange = (contactInvitId: string, role: 'admin' | 'member') => {
    setSelectedContacts((prev) =>
      prev.map((c) => c.invitId === contactInvitId ? { ...c, role } : c)
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Veuillez entrer un nom de groupe');
      return;
    }

    if (!groupObjective.trim()) {
      toast.error('Veuillez entrer un objectif de groupe');
      return;
    }

    if (selectedContacts.length < 1) {
      toast.error('Veuillez sélectionner au moins un membre');
      return;
    }

    if (!user) {
      toast.error('Vous devez être connecté');
      return;
    }

    setIsLoading(true);
    try {
      const memberIds: string[] = [user.uid];
      const memberRoles: { [userId: string]: 'admin' | 'member' } = {};
      memberRoles[user.uid] = 'admin';

      for (const contact of selectedContacts) {
        memberIds.push(contact.invitId);
        memberRoles[contact.invitId] = contact.role;
      }

      const newGroup = await createGroup(
        groupName,
        groupObjective,
        memberIds,
        memberRoles,
        groupDescription
      );

      toast.success('Groupe créé avec succès!');

      if (newGroup.conversationId) {
        setTimeout(() => {
          navigate('/messages', { state: { conversationId: newGroup.conversationId } });
        }, 300);
      }

      setGroupName('');
      setGroupObjective('');
      setGroupDescription('');
      setSelectedContacts([]);
      handleClose();
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Erreur lors de la création du groupe');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    onOpenChange?.(false);
    setGroupName('');
    setGroupObjective('');
    setGroupDescription('');
    setSelectedContacts([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children || <Button><Plus className="h-4 w-4 mr-2" /> Nouveau groupe</Button>}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Créer un groupe</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="groupName">Nom du groupe *</Label>
            <Input
              id="groupName"
              placeholder="Ex: Projet A, Équipe Marketing"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Group Objective */}
          <div className="space-y-2">
            <Label htmlFor="groupObjective">Objectif du groupe *</Label>
            <Input
              id="groupObjective"
              placeholder="Ex: Discuter du projet, Coordination équipe"
              value={groupObjective}
              onChange={(e) => setGroupObjective(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Group Description */}
          <div className="space-y-2">
            <Label htmlFor="groupDescription">Description (optionnel)</Label>
            <Input
              id="groupDescription"
              placeholder="Détails supplémentaires sur le groupe"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Contacts Selection */}
          <div className="space-y-4">
            <Label>Sélectionner les membres *</Label>
            <ScrollArea className="h-48 border rounded-lg p-4">
              {contactsLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-10 bg-muted/20 rounded animate-pulse" />
                  ))}
                </div>
              ) : contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun contact</p>
              ) : (
                <div className="space-y-3">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="flex items-center gap-3">
                      <Checkbox
                        id={`contact-${contact.id}`}
                        checked={selectedContacts.some(c => c.invitId === contact.invitId)}
                        onCheckedChange={() => handleToggleContact(contact)}
                        disabled={isLoading}
                      />
                      <label
                        htmlFor={`contact-${contact.id}`}
                        className="flex-1 cursor-pointer text-sm"
                      >
                        <div className="font-medium">{contact.displayName}</div>
                        <div className="text-xs text-muted-foreground">{contact.email}</div>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Selected Contacts with Roles */}
            {selectedContacts.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Membres sélectionnés ({selectedContacts.length})</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto border rounded-lg p-3 bg-muted/20">
                  {selectedContacts.map((contact) => (
                    <div key={contact.invitId} className="flex items-center justify-between p-2 bg-background rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{contact.displayName}</div>
                        <div className="text-xs text-muted-foreground truncate">{contact.email}</div>
                      </div>
                      <Select
                        value={contact.role}
                        onValueChange={(role) => handleRoleChange(contact.invitId, role as 'admin' | 'member')}
                        disabled={isLoading}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin" className="cursor-pointer">
                            <div className="flex items-center gap-1">
                              <Crown className="h-3 w-3" />
                              Admin
                            </div>
                          </SelectItem>
                          <SelectItem value="member" className="cursor-pointer">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Membre
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button onClick={handleCreateGroup} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer le groupe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupDialog;
