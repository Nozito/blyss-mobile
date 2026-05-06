import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  authApi,
  type User,
  type LoginCredentials,
  type SignupData,
  type ApiResponse,
  type SignupResponse,
} from "@/lib/api";
import { storage } from "@/lib/storage";

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

  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      try {
        // Try to load cached user for instant render
        const cached = await storage.getUserCache();
        if (cached) {
          setUser(cached as unknown as User);
        }

        // Verify token is still valid
        const accessToken = await storage.getAccessToken();
        if (!accessToken) {
          setUser(null);
          return;
        }

        const response = await authApi.getProfile();
        if (_loginSucceeded.current) return;

        if (response.success && response.data) {
          setUser(response.data);
          await storage.setUserCache(toSafeCache(response.data));
        } else {
          setUser(null);
          await storage.clearAll();
        }
      } catch {
        // Keep cached user on network error
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
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
