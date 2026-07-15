import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { AuthProvider } from "@/components/AuthProvider";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "5280 Command Center",
  description: "Internal dashboard for 5280 Mobile Detailing & Auto Studio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
