import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        gap: 16,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 64, fontWeight: 800, color: "#8B3520", margin: 0 }}>404</h1>
      <p style={{ color: "#4a3f30", fontSize: 18, margin: 0 }}>Page not found</p>
      <Link
        href="/dashboard"
        style={{
          color: "#C8A24A",
          fontWeight: 700,
          fontSize: 15,
          textDecoration: "none",
          padding: "10px 24px",
          border: "2px solid #C8A24A",
          borderRadius: 8,
        }}
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
