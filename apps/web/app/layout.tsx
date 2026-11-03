import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./components/auth-provider";
import { ThemeProvider } from "./components/theme-provider";
import { LanguageProvider } from "./components/language-provider";

export const metadata: Metadata = {
  title: "Celi Tools — Portal Admin Tools",
  description: "Konversi dan kompres file, olah JSON, encoding, dan kriptografi dalam satu portal.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <LanguageProvider><ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider></LanguageProvider>
      </body>
    </html>
  );
}
