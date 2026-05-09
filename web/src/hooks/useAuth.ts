import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { fetchAuth, fetchGitHubToken, signOut as apiSignOut, getSignInUrl, type User } from "../lib/api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  hasGitHubModels: boolean;
  githubToken: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  hasGitHubModels: false,
  githubToken: null,
  signIn: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export { AuthContext };

export function useAuthProvider(): AuthContextValue {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasGitHubModels, setHasGitHubModels] = useState(false);
  const [githubToken, setGithubToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchAuth();
        setUser(data.user);
        setHasGitHubModels(data.hasGitHubModels);
        if (data.user && data.hasGitHubModels) {
          const token = await fetchGitHubToken();
          setGithubToken(token);
        }
      } catch {
        // not authenticated
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async () => {
    const url = await getSignInUrl(window.location.href);
    window.location.href = url;
  }, []);

  const signOut = useCallback(async () => {
    await apiSignOut();
    setUser(null);
    setGithubToken(null);
    setHasGitHubModels(false);
  }, []);

  return { user, loading, hasGitHubModels, githubToken, signIn, signOut };
}
