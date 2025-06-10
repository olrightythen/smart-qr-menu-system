import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/context/AuthContext";
 
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Smart QR Menu System",
  description:
    "Digitize your restaurant menu with QR codes. Help customers scan, browse, and order food easily.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <ThemeProvider>
            <Toaster position="top-right" />
            <main>{children}</main>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
