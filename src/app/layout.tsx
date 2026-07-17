import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";
import { SessionProviderWrapper } from "@/components/session-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LabDoc — Interactive Lab Procedure Documentation",
  description: "Document and present lab procedures as slide-based modules with rich text, code snippets. Built by ATOM.",
  keywords: ["lab", "documentation", "slides", "education", "procedure"],
  authors: [{ name: "LabDoc" }],
  icons: {
    icon: "/favicon_Dark.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <SessionProviderWrapper>
          <Providers>{children}</Providers>
        </SessionProviderWrapper>
        <Toaster />
      </body>
    </html>
  );
}
