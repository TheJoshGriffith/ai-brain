import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "AI Brain",
  description: "Self-hosted Markdown knowledge base and AI brain",
};

// Runs before paint: applies the saved theme (System/Light/Dark) + accent so
// there's no flash, and keeps "System" in sync with the OS.
const themeBootstrap = `(function(){try{
  var t=localStorage.getItem('theme')||'system';
  var mq=matchMedia('(prefers-color-scheme: dark)');
  var apply=function(){var dark=t==='dark'||(t==='system'&&mq.matches);
    document.documentElement.setAttribute('data-theme',dark?'dark':'light');};
  apply(); mq.addEventListener&&mq.addEventListener('change',function(){if((localStorage.getItem('theme')||'system')==='system')apply();});
  var a=localStorage.getItem('accent'); if(a)document.documentElement.style.setProperty('--accent',a);
}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
