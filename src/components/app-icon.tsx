// Rendered by next/og into PNG app icons. Inline styles only (Satori subset of CSS).
export function AppIcon({ size, maskable = false }: { size: number; maskable?: boolean }) {
  // Maskable icons need their content inside the central 80% safe zone.
  const ring = Math.round(size * (maskable ? 0.42 : 0.56));
  const stroke = Math.round(ring * 0.2);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1a5b86",
        borderRadius: maskable ? 0 : Math.round(size * 0.22),
      }}
    >
      <div
        style={{
          width: ring,
          height: ring,
          borderRadius: "50%",
          border: `${stroke}px solid #ffffff`,
          borderTopColor: "#f3b33d",
          borderBottomColor: "#f3b33d",
        }}
      />
    </div>
  );
}
