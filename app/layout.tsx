import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "How Sure? — A critical thinking tool for public claims",
  description:
    "Paste a political statement, headline, or public claim. How Sure? separates evidence, context, rhetoric and certainty before giving you a verdict.",

  openGraph: {
    title: "How Sure? — A critical thinking tool for public claims",
    description:
      "See what a claim is based on — evidence, context, rhetoric and certainty.",
    url: "https://how-sure.vercel.app",
    siteName: "How Sure?",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "How Sure? — Critical thinking for public claims",
      },
    ],
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "How Sure?",
    description:
      "See what a public claim is actually based on.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
