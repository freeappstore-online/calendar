import { useState } from "react";
import { Nav } from "../components/Nav";
import { useAuth } from "../hooks/useAuth";
import { deleteAccount } from "../lib/api";

export function Profile() {
  const { user, loading, hasGitHubModels, signIn, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAccount() {
    if (!confirm("Are you sure you want to delete your account? This cannot be undone.")) return;
    if (!confirm("This will permanently remove all your data. Last chance — continue?")) return;
    setDeleting(true);
    await deleteAccount();
    window.location.href = "/";
  }

  if (loading) {
    return (<><Nav /><div className="container py-16 text-center" style={{ color: "var(--muted)" }}>Loading...</div></>);
  }

  if (!user) {
    return (
      <><Nav /><div className="container py-16 text-center">
        <p className="mb-4" style={{ color: "var(--muted)" }}>
          Sign in to view your profile.
        </p>
        <button
          onClick={signIn}
          className="px-5 py-2 rounded-xl text-sm font-semibold border"
          style={{
            background: "transparent",
            color: "var(--ink)",
            borderColor: "var(--line)",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Sign in with GitHub
        </button>
      </div></>
    );
  }

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown";

  return (
    <>
    <Nav />
    <div className="container py-12" style={{ maxWidth: 600 }}>
      {/* Avatar + name card */}
      <div
        className="flex items-center gap-6 p-8 rounded-2xl border mb-8"
        style={{ background: "var(--panel)", borderColor: "var(--line)" }}
      >
        {user.photo_url && (
          <img
            src={user.photo_url}
            alt={user.name}
            className="rounded-full border-2 shrink-0"
            style={{ width: 72, height: 72, borderColor: "var(--line)" }}
          />
        )}
        <div>
          <h2 className="text-xl font-bold mb-0.5">{user.name}</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {user.email}
          </p>
        </div>
      </div>

      {/* Account details */}
      <div className="mb-8">
        <h3
          className="text-base font-bold mb-3 pb-2 border-b"
          style={{ borderColor: "var(--line)" }}
        >
          Account Details
        </h3>
        <DetailRow label="Provider" value="GitHub" />
        <DetailRow label="Member since" value={memberSince} />
        <DetailRow
          label="GitHub Models"
          value={hasGitHubModels ? "Connected" : "Not connected"}
          valueStyle={{ color: hasGitHubModels ? "var(--success)" : "var(--muted)" }}
        />
      </div>

      {/* Session */}
      <div className="mb-8">
        <h3
          className="text-base font-bold mb-3 pb-2 border-b"
          style={{ borderColor: "var(--line)" }}
        >
          Session
        </h3>
        <button
          onClick={signOut}
          className="px-5 py-2 rounded-xl text-sm font-semibold border"
          style={{
            background: "transparent",
            color: "var(--ink)",
            borderColor: "var(--line)",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Sign out
        </button>
      </div>

      {/* Danger zone */}
      <div
        className="rounded-2xl border p-6"
        style={{
          background: "color-mix(in srgb, var(--error) 6%, var(--panel))",
          borderColor: "color-mix(in srgb, var(--error) 25%, var(--line))",
        }}
      >
        <h3 className="text-base font-bold mb-1" style={{ color: "var(--error)" }}>
          Danger Zone
        </h3>
        <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
          Permanently delete your account, session, and all stored data. This cannot be undone.
        </p>
        <button
          onClick={handleDeleteAccount}
          disabled={deleting}
          className="px-5 py-2 rounded-xl text-sm font-semibold text-white"
          style={{
            background: "var(--error)",
            border: "none",
            cursor: deleting ? "not-allowed" : "pointer",
            opacity: deleting ? 0.6 : 1,
            fontFamily: "inherit",
          }}
        >
          {deleting ? "Deleting…" : "Delete my account"}
        </button>
      </div>
    </div>
    </>
  );
}

function DetailRow({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: React.CSSProperties;
}) {
  return (
    <div
      className="flex justify-between items-center py-2.5 border-b text-sm"
      style={{ borderColor: "var(--line)" }}
    >
      <span className="font-medium" style={{ color: "var(--muted)" }}>
        {label}
      </span>
      <span className="font-semibold" style={valueStyle}>
        {value}
      </span>
    </div>
  );
}
