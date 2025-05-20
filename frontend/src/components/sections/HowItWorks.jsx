"use client";

import { useRef, useEffect } from "react";
import { ScanLine, List, ShoppingCart } from "lucide-react";
import Image from "next/image";

const steps = [
  {
    number: 1,
    icon: ScanLine,
    title: "Scan",
    image: "/scan.jpg",
    description:
      "Customers scan the QR code on your table with their smartphone camera.",
    color: "bg-orange-500",
  },
  {
    number: 2,
    icon: List,
    title: "Browse",
    image: "/browse.jpg",
    description:
      "They browse your full menu with images, descriptions, and prices.",
    color: "bg-green-500",
  },
  {
    number: 3,
    icon: ShoppingCart,
    title: "Order",
    image: "/order.jpg",
    description:
      "Customers place and pay for their order directly from their phone.",
    color: "bg-blue-500",
  },
];

const StepCard = ({ step, index }) => {
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
      className="flex-1 relative z-20 opacity-0 translate-y-10 transition-all duration-700"
      style={{ transitionDelay: `${index * 200}ms` }}
    >
      <div className="bg-card rounded-xl p-6 h-full flex flex-col shadow-sm border border-border hover:shadow-md transition-shadow duration-300">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center text-white mb-6 mx-auto ${step.color}`}
        >
          <step.icon className="h-8 w-8" />
        </div>

        <div className="text-center mb-4">
          <h3 className="text-2xl font-bold mb-2">{step.title}</h3>
          <p className="text-muted-foreground">{step.description}</p>
        </div>

        <div className="mt-auto">
          <div className="rounded-lg overflow-hidden border border-border aspect-video bg-muted">
            <Image
              src={step.image}
              alt={step.title}
              width={600}
              height={400}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default function HowItWorks() {
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
      id="how-it-works"
      ref={sectionRef}
      className="py-16 md:py-24 relative overflow-hidden opacity-0 translate-y-4 transition-all duration-700"
    >
      {/* Background decor */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 w-32 h-32 bg-orange-100 dark:bg-orange-900/20 rounded-full blur-2xl opacity-60"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-green-100 dark:bg-green-900/20 rounded-full blur-3xl opacity-60"></div>
      </div>

      <div className="container mx-auto px-4 md:px-6 relative">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-xl text-muted-foreground">
            Simple, intuitive, and ready in minutes. Follow these three easy
            steps:
          </p>
        </div>

        <div className="flex flex-col md:flex-row flex-wrap items-stretch justify-between gap-8 relative">
          {steps.map((step, index) => (
            <StepCard key={step.number} step={step} index={index} />
          ))}
        </div>

        <div className="hidden md:block absolute top-24 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-green-500 to-blue-500 z-0"></div>
      </div>
    </section>
  );
}
