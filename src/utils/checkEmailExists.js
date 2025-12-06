import { fetchSignInMethodsForEmail } from "firebase/auth";
import { auth } from "../firebase/firebase";

export const checkEmailExists = async (email) => {
  if (!email || typeof email !== "string") return false;

  try {
    const methods = await fetchSignInMethodsForEmail(auth, email.trim());
    if( methods.length > 0)
        {
            console.warn("Erreur utilisateur email existe"+email);
        }

    // Si un provider existe, alors le compte existe
    return methods.length > 0;
  } catch (error) {
    console.warn("Erreur fetchSignInMethodsForEmail:", error);
    return false;
  }
};
