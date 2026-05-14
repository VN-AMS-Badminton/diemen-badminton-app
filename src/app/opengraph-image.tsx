import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Diemen Badminton";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #16a34a 0%, #052e16 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 220 }}>🏸</div>
        <div style={{ fontSize: 72, fontWeight: 700, marginTop: 16 }}>
          Diemen Badminton
        </div>
        <div style={{ fontSize: 32, opacity: 0.85, marginTop: 8 }}>
          Sign up · RSVP · Pay
        </div>
      </div>
    ),
    size,
  );
}
