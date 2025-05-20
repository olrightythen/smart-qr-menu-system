"use client";

import {
  QrCode,
  Mail,
  Phone,
  MapPin,
  Facebook,
  Instagram,
  Twitter,
} from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    {
      title: "Product",
      links: [
        { label: "Features", href: "#features" },
        { label: "How It Works", href: "#how-it-works" },
        { label: "Pricing", href: "#" },
        { label: "Demo", href: "#" },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "Blog", href: "#" },
        { label: "Support Center", href: "#" },
        { label: "Documentation", href: "#" },
        { label: "Success Stories", href: "#" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About Us", href: "#" },
        { label: "Careers", href: "#" },
        { label: "Contact", href: "#" },
        { label: "Privacy Policy", href: "#" },
      ],
    },
  ];

  return (
    <footer id="contact" className="bg-muted/60 border-t border-border">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Brand section */}
          <div className="md:col-span-2">
            <div className="flex items-center mb-4">
              <QrCode className="h-8 w-8 text-orange-500 mr-2" />
              <span className="font-bold text-xl">Smart QR Menu</span>
            </div>
            <p className="text-muted-foreground mb-6 max-w-md">
              Transforming restaurant menus into digital experiences. Helping
              small businesses grow with smart technology.
            </p>
            <div className="space-y-3">
              <div className="flex items-center">
                <Mail className="h-5 w-5 text-muted-foreground mr-3" />
                <a
                  href="mailto:info@smartqrmenu.com"
                  className="hover:text-orange-500 transition-colors"
                >
                  info@smartqrmenu.com
                </a>
              </div>
              <div className="flex items-center">
                <Phone className="h-5 w-5 text-muted-foreground mr-3" />
                <a
                  href="tel:+9779876543210"
                  className="hover:text-orange-500 transition-colors"
                >
                  +977 9876543210
                </a>
              </div>
              <div className="flex items-start">
                <MapPin className="h-5 w-5 text-muted-foreground mr-3 mt-0.5" />
                <span>Thamel, Kathmandu, Nepal</span>
              </div>
            </div>
          </div>

          {/* Links sections */}
          {footerLinks.map((section) => (
            <div key={section.title}>
              <h3 className="font-medium text-lg mb-4">{section.title}</h3>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-muted-foreground hover:text-orange-500 transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <hr className="my-8 border-border" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-muted-foreground">
            © {currentYear} Smart QR Menu System. All rights reserved.
          </div>

          <div className="flex items-center space-x-4">
            <a
              href="#"
              className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center hover:bg-orange-100 dark:hover:bg-orange-900/20 hover:border-orange-200 dark:hover:border-orange-800 transition-colors"
            >
              <Facebook className="h-5 w-5 text-muted-foreground" />
            </a>
            <a
              href="#"
              className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center hover:bg-orange-100 dark:hover:bg-orange-900/20 hover:border-orange-200 dark:hover:border-orange-800 transition-colors"
            >
              <Instagram className="h-5 w-5 text-muted-foreground" />
            </a>
            <a
              href="#"
              className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center hover:bg-orange-100 dark:hover:bg-orange-900/20 hover:border-orange-200 dark:hover:border-orange-800 transition-colors"
            >
              <Twitter className="h-5 w-5 text-muted-foreground" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
