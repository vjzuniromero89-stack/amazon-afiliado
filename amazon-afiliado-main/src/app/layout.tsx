import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Amazon Affiliate Command",
  description:
    "Tu centro de operaciones para crear, revisar y publicar en Pinterest.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
