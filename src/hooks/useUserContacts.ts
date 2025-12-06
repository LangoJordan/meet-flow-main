import { useEffect, useState } from "react";
import { getRecentContacts } from "../services/contactService";
import { useAuth } from "../context/AuthContext";
interface Contact {
    id: string;
    contactId?: string;
    creatorId?: string;
    name?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    status?: string;
    createdAt?: string;
    [key: string]: unknown;
}
export const useUserContacts = () => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadContacts = async () => {
      const data = await getRecentContacts(user.uid);
      setContacts(data);
      setLoading(false);
    };

    loadContacts();
  }, [user]);

  return { contacts, loading };
};
