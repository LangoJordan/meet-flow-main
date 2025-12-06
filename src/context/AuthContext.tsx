import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { logoutUser, updateUserOnlineStatus } from "@/services/authService";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {}
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      // Update online status when user changes
      if (currentUser) {
        try {
          await updateUserOnlineStatus(currentUser.uid, true);
        } catch (error) {
          console.warn("Failed to update online status:", error);
        }
      }

      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Heartbeat mechanism for reliable online status
  useEffect(() => {
    if (!user) return;

    const heartbeatInterval = setInterval(async () => {
      try {
        await updateUserOnlineStatus(user.uid, true);
      } catch (error) {
        console.warn("Failed to update online status heartbeat:", error);
      }
    }, 30000); // Update every 30 seconds

    // Initial heartbeat
    updateUserOnlineStatus(user.uid, true).catch(error => {
      console.warn("Failed to set initial online status:", error);
    });

    return () => clearInterval(heartbeatInterval);
  }, [user]);

  // Handle visibility changes (tab switching, minimizing)
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = async () => {
      try {
        const isOnline = !document.hidden;
        await updateUserOnlineStatus(user.uid, isOnline);
      } catch (error) {
        console.warn("Failed to update online status on visibility change:", error);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user]);

  // Set online status to false when page is unloaded or hidden
  useEffect(() => {
    const handlePageHide = async () => {
      if (user) {
        try {
          await updateUserOnlineStatus(user.uid, false);
        } catch (error) {
          console.warn("Failed to update online status on page hide:", error);
        }
      }
    };

    const handleBeforeUnload = async () => {
      if (user) {
        try {
          await updateUserOnlineStatus(user.uid, false);
        } catch (error) {
          console.warn("Failed to update online status on unload:", error);
        }
      }
    };

    // Use pagehide for more reliable detection of page unloading
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [user]);

  const handleLogout = async () => {
    try {
      const userId = user?.uid;
      await logoutUser(userId);
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout: handleLogout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
