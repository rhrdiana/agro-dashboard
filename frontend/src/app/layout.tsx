import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgroAI Dashboard",
  description: "Dashboard AI Pertanian dengan Next.js dan Python",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}