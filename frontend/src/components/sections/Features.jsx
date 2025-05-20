"use client";

import { useRef, useEffect } from "react";
import {
  QrCode,
  UserCheck,
  CreditCard,
  Clock,
  BellRing,
  Star,
  Search,
  BookHeart,
} from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: QrCode,
    title: "QR Code Menu Creation",
    description:
      "Generate dynamic QR codes for your menu that customers can scan to view your offerings digitally.",
  },
  {
    icon: UserCheck,
    title: "Customer Registration",
    description:
      "Allow customers to create accounts to save preferences and track order history.",
  },
  {
    icon: CreditCard,
    title: "eSewa Payment Integration",
    description:
      "Enable customers to pay directly through the app with secure eSewa payment processing.",
  },
  {
    icon: Clock,
    title: "Menu Availability Updates",
    description:
      "Update menu item availability in real-time so customers always see what's currently being served.",
  },
  {
    icon: BellRing,
    title: "Discount Offers via SMS",
    description:
      "Send targeted discount offers and promotions directly to customers' phones.",
  },
  {
    icon: Star,
    title: "Customer Reviews & Ratings",
    description:
      "Build trust with transparent customer reviews and ratings for your dishes.",
  },
  {
    icon: Search,
    title: "Search, Sort & Filter",
    description:
      "Help customers find exactly what they're looking for with powerful search and filter options.",
  },
  {
    icon: BookHeart,
    title: "Personalized Recommendations",
    description:
      "Suggest dishes based on customer preferences and order history for a personalized experience.",
  },
];

const FeatureCard = ({ feature, index }) => {
  const cardRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          cardRef.current.classList.add("opacity-100", "translate-y-0");
        }
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className={cn(
        "bg-card rounded-xl p-6 shadow-sm border border-border transition-all duration-500 opacity-0 translate-y-4",
        "group hover:shadow-md hover:border-orange-200 dark:hover:border-orange-900"
      )}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="rounded-full w-12 h-12 bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center mb-4 text-orange-500 group-hover:scale-110 transition-transform duration-300">
        <feature.icon className="h-6 w-6" />
      </div>
      <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
      <p className="text-muted-foreground">{feature.description}</p>
    </div>
  );
};

export default function Features() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          sectionRef.current.classList.add("opacity-100", "translate-y-0");
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  return (
    <section
      id="features"
      ref={sectionRef}
      className="py-16 md:py-24 bg-muted/50 opacity-0 translate-y-4 transition-all duration-700"
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Powerful Features for Your Restaurant
          </h2>
          <p className="text-xl text-muted-foreground">
            Everything you need to digitize your menu and enhance customer
            experience
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
