import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/sections/Footer";


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
        <ThemeProvider>
          <div className="min-h-screen bg-background">
            <Navbar />
            <main>{children}</main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
