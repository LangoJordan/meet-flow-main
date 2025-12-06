import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useMessages } from '@/context/MessagesContext';
import { useGroups, Group, GroupMember } from '@/context/GroupsContext';
import { db } from '@/firebase/firebase';
import { getDoc, doc } from 'firebase/firestore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Trash2, Shield, User, Loader2, Plus } from 'lucide-react';

interface MemberDetail {
  userId: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  displayName?: string;
}

interface GroupChatViewProps {
  onLeaveGroup?: () => void;
}

const GroupChatView = ({ onLeaveGroup }: GroupChatViewProps) => {
  const { user } = useAuth();
  const { currentConversation } = useMessages();
  const { groups, updateGroupRole, removeGroupMember, updateGroup } = useGroups();
  const [members, setMembers] = useState<MemberDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupObjective, setNewGroupObjective] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');

  useEffect(() => {
    if (!currentConversation) return;

    const group = groups.find((g) => g.conversationId === currentConversation.id);
    setSelectedGroup(group);

    if (group) {
      setMembers(group.members || []);
      setNewGroupName(group.name);
      setNewGroupObjective(group.objective);
      setNewGroupDescription(group.description || '');
    }
  }, [currentConversation, groups]);

  const handleRoleChange = async (memberId: string, newRole: 'admin' | 'member') => {
    if (!selectedGroup?.id) return;

    const isAdmin = selectedGroup.members.find(
      (m: GroupMember) => m.userId === user?.uid && m.role === 'admin'
    );

    if (!isAdmin) {
      toast.error('Seuls les administrateurs peuvent modifier les rôles');
      return;
    }

    setIsLoading(true);
    try {
      await updateGroupRole(selectedGroup.id, memberId, newRole);
      toast.success('Rôle mis à jour');
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Erreur lors de la mise à jour du rôle');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedGroup?.id) return;

    const isAdmin = selectedGroup.members.find(
      (m: GroupMember) => m.userId === user?.uid && m.role === 'admin'
    );

    if (!isAdmin && memberId !== user?.uid) {
      toast.error('Seuls les administrateurs peuvent retirer des membres');
      return;
    }

    setIsLoading(true);
    try {
      await removeGroupMember(selectedGroup.id, memberId);

      // If the current user is leaving, trigger callback
      if (memberId === user?.uid) {
        toast.success('Vous avez quitté le groupe');
        if (onLeaveGroup) {
          onLeaveGroup();
        }
      } else {
        toast.success('Membre supprimé du groupe');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Erreur lors de la suppression du membre');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateGroupInfo = async () => {
    if (!selectedGroup?.id) return;

    const isAdmin = selectedGroup.members.find(
      (m: GroupMember) => m.userId === user?.uid && m.role === 'admin'
    );

    if (!isAdmin) {
      toast.error('Seuls les administrateurs peuvent modifier les informations du groupe');
      return;
    }

    setIsLoading(true);
    try {
      await updateGroup(selectedGroup.id, {
        name: newGroupName,
        objective: newGroupObjective,
        description: newGroupDescription,
      });
      toast.success('Informations du groupe mises à jour');
      setEditingGroupName(false);
    } catch (error) {
      console.error('Error updating group info:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setIsLoading(false);
    }
  };

  const isCurrentUserAdmin = selectedGroup?.members?.some(
    (m: GroupMember) => m.userId === user?.uid && m.role === 'admin'
  );

  if (!selectedGroup) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Aucun groupe sélectionné</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Group Info Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{selectedGroup.name}</h3>
          {isCurrentUserAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditingGroupName(!editingGroupName)}
            >
              Modifier
            </Button>
          )}
        </div>

        {editingGroupName && isCurrentUserAdmin ? (
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="groupName">Nom du groupe</Label>
              <Input
                id="groupName"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="groupObjective">Objectif</Label>
              <Input
                id="groupObjective"
                value={newGroupObjective}
                onChange={(e) => setNewGroupObjective(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="groupDescription">Description</Label>
              <Input
                id="groupDescription"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleUpdateGroupInfo}
                disabled={isLoading}
              >
                Sauvegarder
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingGroupName(false)}
              >
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <>
            {selectedGroup.objective && (
              <p className="text-sm text-muted-foreground">Objectif: {selectedGroup.objective}</p>
            )}
            {selectedGroup.description && (
              <p className="text-sm text-muted-foreground">Description: {selectedGroup.description}</p>
            )}
          </>
        )}
      </div>

      <Separator />

      {/* Members Section */}
      <div>
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <User className="h-4 w-4" />
          Membres ({selectedGroup.members?.length || 0})
        </h4>

        <ScrollArea className="h-96 pr-4">
          <div className="space-y-3">
            {members.map((member: MemberDetail) => (
              <div
                key={member.userId}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{member.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{member.email}</div>
                </div>

                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  {isCurrentUserAdmin && member.userId !== user?.uid ? (
                    <>
                      <Select
                        value={member.role}
                        onValueChange={(newRole) =>
                          handleRoleChange(member.userId, newRole as 'admin' | 'member')
                        }
                      >
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Membre</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveMember(member.userId)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  ) : (
                    <Badge
                      variant={member.role === 'admin' ? 'default' : 'secondary'}
                      className="flex gap-1"
                    >
                      {member.role === 'admin' && <Shield className="h-3 w-3" />}
                      {member.role === 'admin' ? 'Admin' : 'Membre'}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {user && (
        <>
          <Separator />
          <div>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => handleRemoveMember(user.uid)}
            >
              Quitter le groupe
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default GroupChatView;
