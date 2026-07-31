import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "https://kkawataki.com"),
  title: {
    default: "Rental Japanese Guy",
    template: "%s · Rental Japanese Guy",
  },
  description:
    "Book a Japanese local in Tokyo for four hours or longer, shaped around what you want to see, eat, learn, or talk about.",
  openGraph: {
    title: "Rental Japanese Guy",
    description: "Tokyo, without the tourist script.",
    images: [{ url: "/og.png", width: 1731, height: 909 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rental Japanese Guy",
    description: "Tokyo, without the tourist script.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <TooltipProvider>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
            <Toaster
              position="top-center"
              offset={{ top: 88 }}
              mobileOffset={{
                top: "calc(env(safe-area-inset-top, 0px) + 5rem)",
              }}
              richColors
            />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
