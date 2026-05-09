import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const NAV_LINKS = [
  { to: "https://freeappstore.online", label: "Apps", external: true },
  { to: "https://freegamestore.online", label: "Games", external: true },
  { to: "https://freeappstore.online/about.html", label: "About", external: true },
  { to: "https://freeappstore.online/contribute.html", label: "Build", external: true },
  { to: "/", label: "VibeCode" },
  { to: "https://proappstore.online", label: "Pro", external: true, className: "pro-link" },
];

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signIn } = useAuth();
  const location = useLocation();

  return (
    <header className="border-b" style={{ borderColor: "var(--line)", padding: "0.75rem 0" }}>
      <div className="container flex items-center justify-between">
        <Link to="/" className="text-xl font-extrabold tracking-tight no-underline" style={{ color: "var(--ink)" }}>
          Free <span style={{ color: "var(--accent)" }}>Apps</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-5">
          {NAV_LINKS.map((link) =>
            link.external ? (
              <a
                key={link.to}
                href={link.to}
                className={`text-sm font-semibold no-underline ${link.className || ""}`}
                style={{ color: link.className === "pro-link" ? "var(--pro)" : "var(--muted)" }}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-semibold no-underline"
                style={{ color: location.pathname === link.to ? "var(--ink)" : "var(--muted)" }}
              >
                {link.label}
              </Link>
            ),
          )}
          {user ? (
            <Link to="/profile">
              <img
                src={user.photo_url || ""}
                alt={user.name}
                className="rounded-full border-2"
                style={{ width: 28, height: 28, borderColor: "var(--line)" }}
              />
            </Link>
          ) : (
            <button
              onClick={signIn}
              className="text-sm font-semibold"
              style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
            >
              Sign in
            </button>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden"
          onClick={() => setMenuOpen(true)}
          style={{ background: "none", border: "none", fontSize: "1.2rem", color: "var(--ink)", cursor: "pointer" }}
          aria-label="Menu"
        >
          &#9776;
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.3)" }}
            onClick={() => setMenuOpen(false)}
          />
          <nav
            className="fixed top-0 right-0 z-50 flex flex-col gap-1 p-4"
            style={{
              width: 220,
              height: "100dvh",
              background: "var(--surface)",
              borderLeft: "1px solid var(--line)",
              boxShadow: "-4px 0 20px rgba(0,0,0,0.1)",
            }}
          >
            <button
              onClick={() => setMenuOpen(false)}
              className="self-end mb-2"
              style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "1rem", cursor: "pointer" }}
            >
              &#10005;
            </button>
            {NAV_LINKS.map((link) =>
              link.external ? (
                <a
                  key={link.to}
                  href={link.to}
                  className="block py-2 text-base font-semibold no-underline"
                  style={{ color: link.className === "pro-link" ? "var(--pro)" : "var(--muted)" }}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.to}
                  to={link.to}
                  className="block py-2 text-base font-semibold no-underline"
                  style={{ color: location.pathname === link.to ? "var(--ink)" : "var(--muted)" }}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ),
            )}
            {user ? (
              <Link to="/profile" className="flex items-center gap-2 mt-4" onClick={() => setMenuOpen(false)}>
                <img
                  src={user.photo_url || ""}
                  alt={user.name}
                  className="rounded-full"
                  style={{ width: 24, height: 24 }}
                />
                <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{user.name}</span>
              </Link>
            ) : (
              <button
                onClick={() => { setMenuOpen(false); signIn(); }}
                className="mt-4 text-sm font-semibold"
                style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
              >
                Sign in
              </button>
            )}
          </nav>
        </>
      )}
    </header>
  );
}
