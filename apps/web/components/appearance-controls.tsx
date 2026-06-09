"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const ACCENTS = ["#3565F6", "#7A5AF0", "#16A06A", "#E0822A", "#E0473C"];

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

export function AppearanceControls() {
  const [theme, setTheme] = useState<Theme>("system");
  const [accent, setAccent] = useState<string>(ACCENTS[0]!);

  useEffect(() => {
    setTheme((localStorage.getItem("theme") as Theme) || "system");
    setAccent(localStorage.getItem("accent") || ACCENTS[0]!);
  }, []);

  const chooseTheme = (t: Theme) => {
    setTheme(t);
    localStorage.setItem("theme", t);
    applyTheme(t);
  };
  const chooseAccent = (a: string) => {
    setAccent(a);
    localStorage.setItem("accent", a);
    document.documentElement.style.setProperty("--accent", a);
  };

  return (
    <div className="panel-card">
      <div className="ph">
        <div>
          <h3>Appearance</h3>
          <p>Theme follows your OS by default. Accent recolors the whole UI.</p>
        </div>
      </div>
      <div className="pb">
        <div className="cfg-row">
          <div className="lbl"><div className="t">Theme</div><div className="d">System / Light / Dark</div></div>
          <div className="ctl">
            <div className="seg">
              {(["system", "light", "dark"] as Theme[]).map((t) => (
                <button key={t} data-on={theme === t} onClick={() => chooseTheme(t)} style={{ textTransform: "capitalize" }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="cfg-row">
          <div className="lbl"><div className="t">Accent color</div><div className="d">Used for highlights & actions</div></div>
          <div className="ctl">
            {ACCENTS.map((a) => (
              <button
                key={a}
                onClick={() => chooseAccent(a)}
                aria-label={`Accent ${a}`}
                style={{
                  width: 24, height: 24, borderRadius: 6, background: a, cursor: "pointer",
                  border: accent.toLowerCase() === a.toLowerCase() ? "2px solid var(--fg)" : "1px solid var(--border)",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
