import type { Metadata } from "next";
import { Geist, Geist_Mono, Poppins, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { NextAuthProvider } from "@/components/providers/next-auth-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tech360 — AI-Powered Business Operating System",
  description:
    "Strategy. Software. Automation. Growth. Tech360 is the operating system your business deserves — CRM, AI Command Center, WhatsApp & Social automation, and AgentOS workflows in one platform.",
  keywords: [
    "Tech360",
    "AI Business OS",
    "CRM",
    "AI Agents",
    "WhatsApp Business",
    "Workflow Automation",
    "Bangladesh software company",
    "bdtech360",
  ],
  authors: [{ name: "Tech360" }],
  openGraph: {
    title: "Tech360 — AI-Powered Business Operating System",
    description:
      "Strategy. Software. Automation. Growth. The operating system your business deserves.",
    siteName: "Tech360",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tech360 — AI-Powered Business Operating System",
    description:
      "Strategy. Software. Automation. Growth.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} ${inter.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <NextAuthProvider>
            <QueryProvider>
              {children}
              <Toaster richColors position="bottom-right" />
            </QueryProvider>
          </NextAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
