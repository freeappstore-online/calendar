const API_URL = "https://api.freeappstore.online";
const AGENT_URL = "https://agent.freeappstore.online";

export { API_URL, AGENT_URL };

export interface User {
  id: string;
  email: string;
  name: string;
  photo_url: string | null;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  hasGitHubModels: boolean;
  githubToken: string | null;
  loading: boolean;
}

export async function fetchAuth(): Promise<{ user: User | null; hasGitHubModels: boolean }> {
  const res = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
  return res.json();
}

export async function fetchGitHubToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/auth/github-token`, { credentials: "include" });
    const data = await res.json();
    return data.token || null;
  } catch {
    return null;
  }
}

export async function getSignInUrl(redirect: string): Promise<string> {
  const res = await fetch(`${API_URL}/auth/github/url?redirect=${encodeURIComponent(redirect)}`, { credentials: "include" });
  const data = await res.json();
  return data.url;
}

export async function signOut(): Promise<void> {
  await fetch(`${API_URL}/auth/signout`, { method: "POST", credentials: "include" });
}

export async function deleteAccount(): Promise<void> {
  await fetch(`${API_URL}/auth/delete`, { method: "POST", credentials: "include" });
}
