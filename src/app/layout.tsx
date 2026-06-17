import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShotBank - Local Scene Capture",
  description: "Local desktop screenshot library for collecting cinematic reference frames.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full bg-[#09090b] text-zinc-100">{children}</body>
    </html>
  );
}
