import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import Swal from 'sweetalert2';
import { db } from "@/firebase/firebase";
import { collection, addDoc, doc, getDoc, updateDoc, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

const ContactForm = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);
  const [profileExists, setProfileExists] = useState<boolean | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(false);

  // Load existing contact data when in edit mode
  useEffect(() => {
    if (!isEdit || !id) {
      setInitialLoading(false);
      return;
    }

    const loadContactData = async () => {
      try {
        const contactDoc = await getDoc(doc(db, "contacts", id));
        if (contactDoc.exists()) {
          const data = contactDoc.data();
          setName(data.name || "");
          setEmail(data.email || "");
          setPhone(data.phone || "");
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Contact non trouvé',
            text: 'Le contact que vous essayez de modifier n\'existe pas.',
          });
          navigate('/contacts');
        }
      } catch (error) {
        console.error("Erreur lors du chargement du contact:", error);
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: 'Une erreur est survenue lors du chargement du contact.',
        });
        navigate('/contacts');
      } finally {
        setInitialLoading(false);
      }
    };

    loadContactData();
  }, [id, isEdit, navigate]);

  // Check if profile exists when email changes
  useEffect(() => {
    const checkProfileExists = async () => {
      if (!email || email.trim() === "") {
        setProfileExists(null);
        return;
      }

      setCheckingProfile(true);
      try {
        // Query profiles collection by email
        const profilesQuery = query(
          collection(db, "profiles"),
          where("email", "==", email.toLowerCase())
        );
        const snapshot = await getDocs(profilesQuery);
        setProfileExists(snapshot.docs.length > 0);
      } catch (error) {
        console.error("Erreur lors de la vérification du profil:", error);
        setProfileExists(null);
      } finally {
        setCheckingProfile(false);
      }
    };

    // Debounce the check
    const timer = setTimeout(checkProfileExists, 500);
    return () => clearTimeout(timer);
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Vous devez être connecté pour créer ou modifier un contact.',
      });
      return;
    }

    // Validate that profile exists
    if (profileExists === false) {
      Swal.fire({
        icon: 'error',
        title: 'Profil non trouvé',
        text: 'L\'utilisateur avec cet email n\'existe pas dans la base de données. Veuillez vérifier l\'email ou demander à l\'utilisateur de créer un compte d\'abord.',
      });
      return;
    }

    if (profileExists === null && email.trim() !== "") {
      Swal.fire({
        icon: 'error',
        title: 'Profil non valide',
        text: 'Impossible de vérifier le profil. Veuillez réessayer.',
      });
      return;
    }

    setLoading(true);

    try {
      if (isEdit && id) {
        // Update existing contact
        const contactRef = doc(db, "contacts", id);
        await updateDoc(contactRef, {
          name,
          email,
          phone,
          updatedAt: new Date().toISOString(),
        });

        Swal.fire({
          title: 'Contact modifié!',
          text: 'Le contact a été modifié avec succès',
          icon: 'success',
        });
      } else {
        // Create new contact
        // First, get the invitId from the profiles collection by email
        const profilesQuery = query(
          collection(db, "profiles"),
          where("email", "==", email.toLowerCase())
        );
        const snapshot = await getDocs(profilesQuery);
        
        if (snapshot.docs.length === 0) {
          Swal.fire({
            icon: 'error',
            title: 'Profil non trouvé',
            text: 'L\'utilisateur avec cet email n\'existe pas. Veuillez vérifier l\'email.',
          });
          setLoading(false);
          return;
        }

        const profileDoc = snapshot.docs[0];
        const profileId = profileDoc.id; // This is the userId
        const profileData = profileDoc.data();

        await addDoc(collection(db, "contacts"), {
          name,
          email,
          phone,
          avatar: profileData.avatar || null,
          status: "offline",
          creatorId: user.uid,
          invitId: profileId, // Store the userId from profiles
          createdAt: new Date().toISOString(),
        });

        Swal.fire({
          title: 'Nouveau contact enregistré!',
          text: 'Le contact a été enregistré avec succès',
          icon: 'success',
        });
      }

      setName("");
      setEmail("");
      setPhone("");
      navigate('/contacts');
    } catch (error) {
      console.error("Erreur Firestore:", error);
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Une erreur est survenue lors de l\'enregistrement.',
      });
    }

    setLoading(false);
  };

  if (initialLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/contacts')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux contacts
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>{isEdit ? 'Modifier le contact' : 'Nouveau contact'}</CardTitle>
            <CardDescription>
              {isEdit ? 'Modifiez les informations du contact' : 'Ajoutez un nouveau contact à votre liste'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Profile verification alert for new contacts */}
            {!isEdit && email && (
              <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
                profileExists
                  ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
                  : profileExists === false
                  ? 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
                  : 'bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800'
              }`}>
                <AlertCircle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                  profileExists
                    ? 'text-green-600 dark:text-green-400'
                    : profileExists === false
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-blue-600 dark:text-blue-400'
                }`} />
                <div>
                  {checkingProfile && (
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Vérification du profil...
                    </p>
                  )}
                  {!checkingProfile && profileExists && (
                    <p className="text-sm text-green-700 dark:text-green-300">
                      ✓ Le profil existe. Vous pouvez ajouter ce contact.
                    </p>
                  )}
                  {!checkingProfile && profileExists === false && (
                    <p className="text-sm text-red-700 dark:text-red-300">
                      ✗ Aucun profil trouvé pour cet email. L'utilisateur doit créer un compte en premier.
                    </p>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nom complet *</Label>
                <Input
                  id="name"
                  placeholder="Jean Dupont"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="jean@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading || isEdit}
                  title={isEdit ? "Vous ne pouvez pas modifier l'email d'un contact existant" : ""}
                />
                {checkingProfile && !isEdit && (
                  <p className="text-xs text-muted-foreground">Vérification du profil...</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+237 6 12 34 56 78"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  disabled={
                    loading ||
                    checkingProfile ||
                    (!isEdit && profileExists === false) ||
                    (!isEdit && profileExists === null && email.trim() !== "")
                  }
                  type="submit"
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {isEdit ? "Modification en cours..." : "Enregistrement..."}
                    </>
                  ) : isEdit ? (
                    "Modifier le contact"
                  ) : (
                    "Ajouter le contact"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/contacts')}
                  disabled={loading}
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

export default ContactForm;
