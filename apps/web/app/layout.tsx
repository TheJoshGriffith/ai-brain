import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Brain",
  description: "Self-hosted Markdown knowledge base and AI brain",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
