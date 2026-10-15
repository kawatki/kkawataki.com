import type { Metadata } from "next";
import Script from "next/script";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const googleAnalyticsId =
  process.env.SITE_URL === "https://kkawataki.com"
    ? process.env.GA_MEASUREMENT_ID
    : undefined;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "https://kkawataki.com"),
  title: {
    default: "Rental Japanese Guy",
    template: "%s · Rental Japanese Guy",
  },
  description:
    "Book a flexible Japanese local as your guide, temporary homie, plus-one, cultural translator, or practical problem-solver in Tokyo.",
  openGraph: {
    title: "Rental Japanese Guy",
    description: "Tokyo, with a Japanese guy on your side.",
    images: [{ url: "/og.png", width: 1731, height: 909 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rental Japanese Guy",
    description: "Tokyo, with a Japanese guy on your side.",
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
      <head>
        {/* Keep this in the initial head: extension mutations before hydration
            conflict with React. The site provides its own dark theme. */}
        <meta name="darkreader-lock" content="true" />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
            <TooltipProvider>
              <SiteHeader />
              <main className="flex-1">{children}</main>
              <SiteFooter />
              <Toaster />
            </TooltipProvider>
        </ThemeProvider>
      </body>
      {googleAnalyticsId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${googleAnalyticsId}');
            `}
          </Script>
        </>
      )}
    </html>
  );
}
