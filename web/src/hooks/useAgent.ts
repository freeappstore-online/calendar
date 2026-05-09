import { useState, useCallback, useRef } from "react";
import { AGENT_URL } from "../lib/api";

export interface ChatMessage {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
}

interface DeployStep {
  name: string;
  status: string;
}

export interface DeployState {
  phase: string;
  steps?: DeployStep[];
  appUrl?: string;
  error?: string;
}

interface UseAgentReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  tokensIn: number;
  tokensOut: number;
  deployState: DeployState | null;
  projects: Project[];
  currentProjectId: string | null;
  sendMessage: (message: string, aiConfig: AIConfig) => Promise<void>;
  createProject: (name: string) => string;
  switchProject: (id: string) => void;
  loadHistory: () => Promise<void>;
}

export interface AIConfig {
  provider: string;
  model: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
}

const PROJECTS_KEY = "fas_projects";

function getStoredProjects(): Project[] {
  try { return JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]"); } catch { return []; }
}

function saveStoredProjects(projects: Project[]) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function useAgent(): UseAgentReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "system", content: "Describe the app you want to build." },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [tokensIn, setTokensIn] = useState(0);
  const [tokensOut, setTokensOut] = useState(0);
  const [deployState, setDeployState] = useState<DeployState | null>(null);
  const [projects, setProjects] = useState<Project[]>(() => {
    const stored = getStoredProjects();
    if (stored.length === 0) {
      const initial = { id: crypto.randomUUID(), name: "My App", createdAt: new Date().toISOString() };
      saveStoredProjects([initial]);
      return [initial];
    }
    return stored;
  });
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => {
    return localStorage.getItem("fas_current_project") || getStoredProjects()[0]?.id || null;
  });

  const sessionId = currentProjectId;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const createProject = useCallback((name: string) => {
    const id = crypto.randomUUID();
    const project = { id, name, createdAt: new Date().toISOString() };
    const updated = [project, ...projects];
    setProjects(updated);
    saveStoredProjects(updated);
    setCurrentProjectId(id);
    localStorage.setItem("fas_current_project", id);
    setMessages([{ role: "system", content: "Describe the app you want to build." }]);
    setDeployState(null);
    setTokensIn(0);
    setTokensOut(0);
    return id;
  }, [projects]);

  const switchProject = useCallback((id: string) => {
    setCurrentProjectId(id);
    localStorage.setItem("fas_current_project", id);
    setMessages([{ role: "system", content: "Describe the app you want to build." }]);
    setDeployState(null);
    setTokensIn(0);
    setTokensOut(0);
  }, []);

  const loadHistory = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${AGENT_URL}/session/${sessionId}/history`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.messages?.length) return;

      const restored: ChatMessage[] = [];
      for (const m of data.messages) {
        if (m.role === "assistant") {
          if (m.content) restored.push({ role: "assistant", content: m.content });
          if (m.toolCalls) {
            for (const tc of m.toolCalls) {
              const label = tc.name === "write_file" ? `Writing ${tc.input?.path || "file"}` :
                            tc.name === "run_compliance_check" ? "Running compliance checks..." :
                            tc.name === "deploy" ? `Deploying ${tc.input?.id || "app"}...` :
                            tc.name;
              restored.push({ role: "tool", content: label });
            }
          }
        } else if (m.role === "tool_result" && m.toolResults) {
          for (const tr of m.toolResults) {
            if (tr.content?.length > 20) {
              restored.push({ role: "tool", content: tr.content.slice(0, 400) });
            }
          }
        } else if (m.role === "user") {
          restored.push({ role: "user", content: m.content });
        }
      }
      if (restored.length > 0) setMessages(restored);

      if (data.deployStatus?.phase === "live" && data.deployStatus.appUrl) {
        setDeployState(data.deployStatus);
      }
      if (data.appName) {
        const updated = getStoredProjects().map((p) =>
          p.id === sessionId && p.name === "My App" ? { ...p, name: data.appName } : p
        );
        setProjects(updated);
        saveStoredProjects(updated);
      }
    } catch { /* ignore */ }
  }, [sessionId]);

  const sendMessage = useCallback(async (message: string, aiConfig: AIConfig) => {
    if (!sessionId || isStreaming) return;
    setIsStreaming(true);
    addMessage({ role: "user", content: message });

    try {
      const res = await fetch(`${AGENT_URL}/session/${sessionId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, aiConfig }),
      });

      if (!res.ok) {
        addMessage({ role: "assistant", content: `Error: ${await res.text()}` });
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let assistantText = "";

      // Add empty assistant message that we'll update
      const assistantIdx = messagesRef.current.length + 1; // +1 for user message we just added
      addMessage({ role: "assistant", content: "" });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let evt;
          try { evt = JSON.parse(raw); } catch { continue; }

          if (evt.type === "text") {
            assistantText += evt.data;
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated.findIndex((m, i) => i >= assistantIdx && m.role === "assistant");
              if (last >= 0) updated[last] = { role: "assistant", content: assistantText };
              return updated;
            });
          } else if (evt.type === "tool_call") {
            const tc = JSON.parse(evt.data);
            const label = tc.name === "deploy" ? `Deploying: ${tc.input?.name}...` :
                          tc.name === "write_file" ? `Writing ${tc.input?.path}` :
                          tc.name === "run_compliance_check" ? "Running compliance checks..." :
                          tc.name === "search_files" ? `Searching for "${tc.input?.pattern}"` :
                          tc.name === "push_update" ? `Pushing update to ${tc.input?.id}...` :
                          tc.name;
            addMessage({ role: "tool", content: label });
          } else if (evt.type === "tool_result") {
            const tr = JSON.parse(evt.data);
            if (tr.tool === "deploy") {
              setDeployState({ phase: "provisioning", steps: [] });
            } else if (!["write_file", "read_file", "list_files", "delete_file"].includes(tr.tool) && tr.result) {
              addMessage({ role: "tool", content: `${tr.tool}:\n${tr.result.slice(0, 400)}` });
            }
          } else if (evt.type === "usage") {
            const u = JSON.parse(evt.data);
            if (u.input) setTokensIn((prev) => prev + u.input);
            if (u.output) setTokensOut((prev) => prev + u.output);
          } else if (evt.type === "deploy_status") {
            const ds = JSON.parse(evt.data);
            setDeployState(ds);
          } else if (evt.type === "error") {
            assistantText += `\nError: ${evt.data}`;
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated.findIndex((m, i) => i >= assistantIdx && m.role === "assistant");
              if (last >= 0) updated[last] = { role: "assistant", content: assistantText };
              return updated;
            });
          }
        }
      }

      if (!assistantText) {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated.findIndex((m, i) => i >= assistantIdx && m.role === "assistant");
          if (last >= 0) updated[last] = { role: "assistant", content: "(No response)" };
          return updated;
        });
      }
    } catch (err) {
      addMessage({ role: "assistant", content: `Connection error: ${(err as Error).message}` });
    } finally {
      setIsStreaming(false);
    }
  }, [sessionId, isStreaming, addMessage]);

  return {
    messages, isStreaming, tokensIn, tokensOut, deployState,
    projects, currentProjectId,
    sendMessage, createProject, switchProject, loadHistory,
  };
}
