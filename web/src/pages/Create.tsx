import { useEffect, useRef, useState } from "react";
import { Nav } from "../components/Nav";
import { useAuth } from "../hooks/useAuth";
import { useAgent, type AIConfig } from "../hooks/useAgent";

const MODEL_OPTIONS: Record<string, { value: string; label: string }[]> = {
  github: [
    { value: "openai/gpt-4.1", label: "GPT-4.1" },
    { value: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { value: "openai/gpt-4o", label: "GPT-4o" },
    { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  ],
  anthropic: [
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
  ],
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  ],
  google: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  ],
};

export function Create() {
  const { user, loading, signIn, githubToken } = useAuth();
  const agent = useAgent();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [provider, setProvider] = useState(() => localStorage.getItem("fas_provider") || "github");
  const [model, setModel] = useState(() => localStorage.getItem("fas_model") || "openai/gpt-4.1");
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => { agent.loadHistory(); }, [agent.currentProjectId]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [agent.messages]);
  useEffect(() => { localStorage.setItem("fas_provider", provider); }, [provider]);
  useEffect(() => { localStorage.setItem("fas_model", model); }, [model]);

  if (loading) return null;

  const handleSend = async () => {
    const msg = inputValue.trim();
    if (!msg || agent.isStreaming) return;
    const key = provider === "github" ? (githubToken || "") : apiKey;
    if (!key) { alert(provider === "github" ? "GitHub Models not available. Sign out and back in." : "Enter your API key in settings."); return; }
    setInputValue("");
    await agent.sendMessage(msg, { provider, model, apiKey: key, temperature, maxTokens: 16384 } as AIConfig);
  };

  const previewUrl = agent.deployState?.phase === "live" ? agent.deployState.appUrl : null;

  if (!user) {
    return (
      <>
        <Nav />
        <main className="flex flex-col items-center justify-center text-center" style={{ minHeight: "60vh", padding: "4rem 1.5rem", maxWidth: 640, margin: "0 auto" }}>
          <h1 className="text-4xl font-extrabold tracking-tight mb-3">VibeCode</h1>
          <p className="text-lg mb-8" style={{ color: "var(--muted)", maxWidth: 480 }}>
            Describe the app you want. An AI agent builds it, deploys it, and you get a live app on FreeAppStore — in minutes.
          </p>
          <button onClick={signIn} className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white" style={{ background: "var(--accent)" }}>
            Sign in with GitHub to start
          </button>
          <p className="text-sm mt-3" style={{ color: "var(--muted)" }}>Free to use. AI runs through GitHub Models — no API key needed.</p>
        </main>
      </>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: "100dvh", overflow: "hidden" }}>
      <Nav />
      <div className="grid flex-1 min-h-0 grid-cols-1 md:grid-cols-2">
        {/* Chat */}
        <div className="flex flex-col overflow-hidden border-r" style={{ borderColor: "var(--line)" }}>
          <Toolbar
            agent={agent}
            provider={provider} setProvider={setProvider}
            model={model} setModel={setModel}
            apiKey={apiKey} setApiKey={setApiKey}
            temperature={temperature} setTemperature={setTemperature}
            settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen}
          />
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2" style={{ minHeight: 0 }}>
            {agent.messages.map((m, i) => <Message key={i} role={m.role} content={m.content} />)}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex gap-2 shrink-0" style={{ padding: "0.5rem 0.75rem", borderTop: "1px solid var(--line)", background: "var(--panel)" }}>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Build me a meditation timer..."
              rows={1}
              className="flex-1 resize-none"
              style={{ border: "1px solid var(--line)", borderRadius: "0.5rem", padding: "0.4rem 0.6rem", background: "var(--paper)", color: "var(--ink)", fontSize: "0.86rem", minHeight: 34, maxHeight: 100, fontFamily: "inherit" }}
            />
            <button onClick={handleSend} disabled={agent.isStreaming} className="self-end" style={{ padding: "0.4rem 0.85rem", background: "var(--accent)", color: "white", border: "none", borderRadius: "0.5rem", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", opacity: agent.isStreaming ? 0.5 : 1 }}>
              Send
            </button>
          </div>
        </div>
        {/* Preview */}
        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 shrink-0" style={{ padding: "0.35rem 0.75rem", borderBottom: "1px solid var(--line)", background: "var(--panel)", fontSize: "0.78rem" }}>
            <span className="font-bold">Preview</span>
            {previewUrl && (
              <>
                <a href={previewUrl} target="_blank" rel="noopener" className="text-xs" style={{ color: "var(--accent)", fontFamily: "monospace" }}>{previewUrl.replace("https://", "")}</a>
                <a href={previewUrl} target="_blank" rel="noopener" className="ml-auto text-xs font-semibold" style={{ color: "var(--accent)" }}>Open in new tab</a>
              </>
            )}
          </div>
          <div className="flex-1 flex items-center justify-center" style={{ background: "var(--paper)", minHeight: 0, overflow: "hidden" }}>
            {previewUrl ? <iframe src={previewUrl} title="Preview" className="w-full h-full border-0" /> :
             agent.deployState ? <DeployLog state={agent.deployState} /> :
             <div className="text-center p-8" style={{ color: "var(--muted)" }}><p>Your app will appear here once deployed.</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function Toolbar({ agent, provider, setProvider, model, setModel, apiKey, setApiKey, temperature, setTemperature, settingsOpen, setSettingsOpen }: any) {
  const sel: React.CSSProperties = { padding: "0.2rem 0.4rem", border: "1px solid var(--line)", borderRadius: "0.3rem", background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", fontSize: "0.78rem" };
  const btn: React.CSSProperties = { background: "none", border: "1px solid var(--line)", borderRadius: "0.3rem", padding: "0.15rem 0.4rem", cursor: "pointer", color: "var(--ink)", fontSize: "0.78rem" };

  return (
    <>
      <div className="flex items-center gap-2 shrink-0" style={{ padding: "0.35rem 0.75rem", borderBottom: "1px solid var(--line)", background: "var(--panel)", fontSize: "0.78rem" }}>
        <select value={agent.currentProjectId || ""} onChange={(e) => agent.switchProject(e.target.value)} style={sel}>
          {agent.projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={() => { const n = prompt("Project name:"); if (n) agent.createProject(n.trim()); }} style={btn}>+</button>
        <span className="ml-auto" style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
          In: <strong>{agent.tokensIn.toLocaleString()}</strong> Out: <strong>{agent.tokensOut.toLocaleString()}</strong>
        </span>
        <button onClick={() => setSettingsOpen(!settingsOpen)} style={btn}>&#9881;</button>
      </div>
      {settingsOpen && (
        <div className="flex flex-wrap items-center gap-2 shrink-0" style={{ padding: "0.35rem 0.75rem", borderBottom: "1px solid var(--line)", background: "var(--panel)", fontSize: "0.78rem" }}>
          <select value={provider} onChange={(e) => { setProvider(e.target.value); setModel(MODEL_OPTIONS[e.target.value]?.[0]?.value || ""); }} style={sel}>
            <option value="github">GitHub Models</option><option value="anthropic">Anthropic</option><option value="openai">OpenAI</option><option value="google">Google</option>
          </select>
          <select value={model} onChange={(e) => setModel(e.target.value)} style={sel}>
            {(MODEL_OPTIONS[provider] || []).map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {provider !== "github" && <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API key" style={{ ...sel, width: 140 }} />}
          <select value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} style={sel}>
            <option value={0}>Temp 0</option><option value={0.3}>Temp 0.3</option><option value={0.7}>Temp 0.7</option><option value={1}>Temp 1</option>
          </select>
        </div>
      )}
    </>
  );
}

function Message({ role, content }: { role: string; content: string }) {
  const styles: Record<string, React.CSSProperties> = {
    user: { alignSelf: "flex-end", background: "var(--accent)", color: "white", borderBottomRightRadius: "0.15rem" },
    assistant: { alignSelf: "flex-start", background: "var(--panel)", border: "1px solid var(--line)", borderBottomLeftRadius: "0.15rem" },
    tool: { alignSelf: "flex-start", fontSize: "0.72rem", fontFamily: "monospace", background: "var(--panel)", border: "1px solid var(--line)", color: "var(--muted)", padding: "0.25rem 0.5rem", borderRadius: "0.35rem" },
    system: { alignSelf: "center", fontSize: "0.78rem", color: "var(--muted)", background: "none" },
  };
  return (
    <div style={{ maxWidth: "88%", padding: "0.55rem 0.75rem", borderRadius: "0.75rem", fontSize: "0.86rem", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", ...styles[role] }}>
      {content}
    </div>
  );
}

const DEPLOY_STEPS = ["GitHub repo", "CF Pages", "Custom domain", "DNS", "Store listing", "Pushing code", "Building", "Live"];

function DeployLog({ state }: { state: { phase: string; steps?: { name: string; status: string }[]; appUrl?: string; error?: string } }) {
  return (
    <div className="w-full p-6" style={{ fontSize: "0.82rem" }}>
      <h3 className="font-bold mb-3">Deploying your app</h3>
      {DEPLOY_STEPS.map((name) => {
        const step = state.steps?.find((s) => s.name === name);
        let status = "pending";
        if (step) status = step.status === "ok" ? "done" : step.status === "skip" ? "skip" : "fail";
        else if (state.phase === "live") status = "done";
        else if (state.phase === "pushing" && name === "Pushing code") status = "active";
        else if (state.phase === "building" && name === "Building") status = "active";
        const color = { done: "#16a34a", skip: "#d97706", fail: "#dc2626", active: "var(--accent)", pending: "var(--line)" }[status];
        return (
          <div key={name} className="flex items-center gap-2 py-1" style={{ color: ["done", "active"].includes(status) ? "var(--ink)" : "var(--muted)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
            {name}
          </div>
        );
      })}
      {state.phase === "live" && state.appUrl && (
        <div className="mt-3 p-2 rounded font-semibold" style={{ background: "color-mix(in srgb, #16a34a 10%, var(--panel))", color: "#16a34a" }}>
          Live! <a href={state.appUrl} target="_blank" rel="noopener" style={{ color: "#16a34a" }}>{state.appUrl.replace("https://", "")}</a>
        </div>
      )}
      {state.phase === "error" && <div className="mt-3 p-2 rounded text-sm" style={{ color: "#dc2626" }}>{state.error}</div>}
    </div>
  );
}
