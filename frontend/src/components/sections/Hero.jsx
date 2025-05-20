"use client";

import { useEffect, useState } from "react";
import { QrCode, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Image from "next/image";

export default function Hero() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-orange-200/30 blur-3xl dark:bg-orange-900/20"></div>
        <div className="absolute top-1/2 -left-32 w-96 h-96 rounded-full bg-green-200/30 blur-3xl dark:bg-green-900/20"></div>
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
          <div
            className={cn(
              "flex-1 space-y-6 text-center lg:text-left transform transition-all duration-700",
              isVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-10 opacity-0"
            )}
          >
            <div className="inline-flex items-center rounded-full px-3 py-1 text-sm bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 mb-2">
              <span className="flex h-2 w-2 rounded-full bg-orange-500 mr-2"></span>
              Upcoming Feature: SMS Discount Notifications
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">
              <span className="block">Scan. Order.</span>
              <span className="block text-orange-500">Enjoy.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0">
              Transform your menu into a digital experience. Smart QR Menu
              System helps small restaurants and street food stalls go digital
              in minutes.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button
                size="lg"
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline">
                Try Demo
              </Button>
            </div>

            <div className="flex items-center justify-center lg:justify-start space-x-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Trusted by 500+ businesses
              </p>
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 text-black rounded-full bg-gray-200 border-2 border-background flex items-center justify-center text-xs font-medium"
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            className={cn(
              "flex-1 relative transform transition-all duration-700 delay-300",
              isVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-10 opacity-0"
            )}
          >
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden p-2 border border-gray-100 dark:border-gray-700">
              <div className="aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                <Image
                  src="/burger.webp"
                  alt="Restaurant QR Menu Preview"
                  width={1260}
                  height={750}
                  className="object-cover w-full h-full"
                />
              </div>

              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 w-4/5">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <QrCode className="h-10 w-10 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">Pasta House Menu</h3>
                    <p className="text-sm text-muted-foreground">
                      Scan to view our delicious menu
                    </p>
                    <div className="mt-2 flex items-center space-x-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className="w-4 h-4 text-yellow-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                        </svg>
                      ))}
                      <span className="text-xs font-medium ml-1">
                        4.9 (120 reviews)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute -top-6 -right-6 w-12 h-12 bg-green-200 dark:bg-green-900/50 rounded-full blur-md"></div>
            <div className="absolute -bottom-8 -left-8 w-16 h-16 bg-orange-200 dark:bg-orange-900/50 rounded-full blur-md"></div>
          </div>
        </div>
      </div>
    </section>
  );
}
