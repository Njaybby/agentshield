// Shared artwork for generated icons and social cards (next/og ImageResponse).

export function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 3.5 26 7.5v8.2c0 6.1-4.3 10.6-10 12.8C10.3 26.3 6 21.8 6 15.7V7.5l10-4Z" stroke="#ededef" strokeWidth="2" strokeLinejoin="round" />
      <path d="M11 11.5 13 8.5l1.2 3M21 11.5 19 8.5l-1.2 3" stroke="#ededef" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M11.5 16c1.2-1.1 2.8-1.1 4 0M16.5 16c1.2-1.1 2.8-1.1 4 0" stroke="#ededef" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function SocialCard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#0a0a0b",
        padding: "64px 72px",
        color: "#ededef",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Mark size={52} />
        <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: -0.5 }}>AgentShield</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2.5, maxWidth: 900 }}>
          Stop the agent before it signs the drain.
        </div>
        <div style={{ fontSize: 30, color: "#a1a1aa", maxWidth: 900, lineHeight: 1.35 }}>
          Pre-signing review for autonomous trading agents. Built with Strands Agents on AWS.
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, fontSize: 24 }}>
        {[
          ["ALLOW", "#3ecf8e"],
          ["BLOCK", "#f0565c"],
          ["QUARANTINE", "#f2b441"],
        ].map(([label, color]) => (
          <div
            key={label}
            style={{
              display: "flex",
              padding: "8px 16px",
              borderRadius: 8,
              border: `2px solid ${color}55`,
              background: `${color}1a`,
              color,
              letterSpacing: 1.5,
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
