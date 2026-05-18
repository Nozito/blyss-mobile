import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import Purchases from "react-native-purchases";
import {
  authApi,
  type User,
  type LoginCredentials,
  type SignupData,
  type ApiResponse,
  type SignupResponse,
} from "@/lib/api";
import { storage } from "@/lib/storage";

async function rcLogIn(userId: number) {
  try {
    await Purchases.logIn(String(userId));
  } catch {
    // RC non configuré (simulator / clé manquante) — on ignore silencieusement
  }
}

async function rcLogOut() {
  try {
    await Purchases.logOut();
  } catch {}
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<ApiResponse<{ accessToken: string; refreshToken: string; user: User }>>;
  signup: (data: SignupData) => Promise<SignupResponse>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<ApiResponse<User>>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SAFE_FIELDS = ["id", "first_name", "last_name", "role", "is_admin", "profile_photo", "avg_rating", "clients_count"] as const;

function toSafeCache(u: User): Record<string, unknown> {
  return Object.fromEntries(
    SAFE_FIELDS.filter((k) => k in u).map((k) => [k, u[k as keyof User]])
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const _loginSucceeded = useRef(false);
  const _initialized = useRef(false);

  useEffect(() => {
    const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), ms)
        ),
      ]);

    const initAuth = async () => {
      setIsLoading(true);
      try {
        // 1. Charge le cache immédiatement pour affichage instantané
        const cached = await storage.getUserCache();
        if (cached) {
          setUser(cached as unknown as User);
        }

        // 2. Vérifie que le token existe
        const accessToken = await storage.getAccessToken();
        if (!accessToken) {
          setUser(null);
          return;
        }

        // 3. Appelle getProfile() pour valider/rafraîchir (5s max)
        const response = await withTimeout(authApi.getProfile(), 5000);
        if (_loginSucceeded.current) return;

        if (response.success && response.data) {
          console.log('[AuthContext] user after initAuth:', JSON.stringify({ id: response.data.id, role: response.data.role, pro_status: response.data.pro_status }, null, 2));
          setUser(response.data);
          await storage.setUserCache(toSafeCache(response.data));
          await rcLogIn(response.data.id);
        }
        // Si !response.success → on garde le cache, l'intercepteur axios gère le refresh
      } catch {
        // Erreur réseau / timeout → on garde le cache, PAS de clearAll()
      } finally {
        setIsLoading(false);
      }
    };

    initAuth().then(() => { _initialized.current = true; });
  }, []);

  // Refetch du profil quand l'app revient au premier plan (rôle, pro_status peuvent avoir changé)
  useEffect(() => {
    const onAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState !== "active" || !_initialized.current) return;
      const token = await storage.getAccessToken();
      if (!token) return;
      const response = await authApi.getProfile();
      if (response.success && response.data) {
        setUser(response.data);
        await storage.setUserCache(toSafeCache(response.data));
      }
    };
    const sub = AppState.addEventListener("change", onAppStateChange);
    return () => sub.remove();
  }, []);

  const login = async (credentials: LoginCredentials): Promise<ApiResponse<{ accessToken: string; refreshToken: string; user: User }>> => {
    setIsLoading(true);
    try {
      const response = await authApi.login(credentials);

      if (response.success && response.data) {
        const profile = await authApi.getProfile();
        if (profile.success && profile.data) {
          _loginSucceeded.current = true;
          setUser(profile.data);
          await storage.setUserCache(toSafeCache(profile.data));
          await rcLogIn(profile.data.id);
        }
      }

      return response;
    } catch {
      return { success: false, message: "Login failed" };
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: SignupData): Promise<SignupResponse> => {
    setIsLoading(true);
    try {
      const response = await authApi.signup(data);

      if (response.success) {
        const profile = await authApi.getProfile();
        if (profile.success && profile.data) {
          _loginSucceeded.current = true;
          setUser(profile.data);
          await storage.setUserCache(toSafeCache(profile.data));
          await rcLogIn(profile.data.id);
        }
        return { success: true, message: response.message };
      }

      return { success: false, message: response.message, error: response.error };
    } catch {
      return { success: false, message: "Network error", error: "server_error" };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      await storage.clearAll();
      await rcLogOut();
    }
  };

  const updateUser = async (data: Partial<User>): Promise<ApiResponse<User>> => {
    if (!user) return { success: false, message: "Not authenticated" };

    const response = await authApi.updateProfile(data);
    if (response.success && response.data) {
      setUser(response.data);
      await storage.setUserCache(toSafeCache(response.data));
    }
    return response;
  };

  const refreshProfile = async (): Promise<void> => {
    try {
      const response = await authApi.getProfile();
      if (response.success && response.data) {
        setUser(response.data);
        await storage.setUserCache(toSafeCache(response.data));
      }
    } catch {
      // silently ignore
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        login,
        signup,
        logout,
        updateUser,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
