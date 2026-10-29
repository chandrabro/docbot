import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Ask the Documents",
  description: "Ask questions and get answers based only on our documents.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
