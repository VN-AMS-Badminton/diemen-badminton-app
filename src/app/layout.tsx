import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { LiveAnnouncer } from "@/components/ui/live-announcer";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: "Diemen Badminton",
  description: "Diemen badminton club — sign up, RSVP, pay.",
  openGraph: {
    title: "Diemen Badminton",
    description: "Diemen badminton club — sign up, RSVP, pay.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#004185" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1626" },
  ],
};

// Runs before hydration to prevent dark-mode flash (FOUC).
const themeInitScript = `
(function () {
  try {
    var t = localStorage.getItem('theme');
    var prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (t === 'dark' || (!t && prefers)) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={montserrat.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh font-sans antialiased" suppressHydrationWarning>
        <LiveAnnouncer>{children}</LiveAnnouncer>
      </body>
    </html>
  );
}
