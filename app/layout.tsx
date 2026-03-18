import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zinnia Proposal Generator",
  description: "Generate custom proposals for Zinnia Group prospects",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#E8EAF0]">{children}</body>
    </html>
  );
}
