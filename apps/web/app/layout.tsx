import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "DRAX Device Cloud",
  description: "Virtual Android device management",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
