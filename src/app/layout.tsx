import type { Metadata, Viewport } from "next";
import { ConversionProvider } from "@/ui/providers/conversion-provider";
import { I18nProvider } from "@/i18n/provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "openConv — private, client-side file converter",
  description:
    "Open-source file converter that runs entirely in your browser. Images, data, documents, audio and video — your files never leave your device.",
  applicationName: "openConv",
  keywords: ["file converter", "client-side", "privacy", "open source", "image", "video", "audio"],
  authors: [{ name: "Mustafa Karakulak" }],
};

export const viewport: Viewport = {
  themeColor: "#0b0b12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // lang/dir start at the default locale and are updated on the client by
  // I18nProvider; suppressHydrationWarning covers that imperative mutation.
  return (
    <html lang="en" dir="ltr" className="dark" suppressHydrationWarning>
      <body className="min-h-dvh font-sans text-zinc-100 antialiased">
        <I18nProvider>
          <ConversionProvider>{children}</ConversionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
