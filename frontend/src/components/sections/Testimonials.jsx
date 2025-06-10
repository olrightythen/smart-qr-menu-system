"use client";

import { useState, useEffect, useRef } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Fallback class joiner instead of `cn`
function mergeClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

const testimonials = [
  {
    id: 1,
    name: "Priya Sharma",
    role: "Restaurant Owner",
    avatar:
      "https://images.pexels.com/photos/3763188/pexels-photo-3763188.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&dpr=2",
    content:
      "Smart QR Menu System transformed how we operate. Our customers love the digital menu and the ability to order and pay without waiting. We've seen a 30% increase in orders since implementing it.",
    rating: 5,
  },
  {
    id: 2,
    name: "Rajesh Kunwar",
    role: "Street Food Vendor",
    avatar:
      "https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&dpr=2",
    content:
      "As a street food vendor, I never thought I could afford such technology. It's incredibly affordable and has helped me organize my small business. My regular customers appreciate the loyalty discounts sent via SMS.",
    rating: 5,
  },
  {
    id: 3,
    name: "Laxmi Neupane",
    role: "Hotel Manager",
    avatar:
      "/images/laxmi-neupane.png", // Local image for Laxmi Neupane
    content:
      "Our Neupane Hotel has seen a significant boost in customer satisfaction. The Smart QR Menu System is easy to use, and our guests love the convenience of ordering from their phones. The analytics dashboard helps us understand customer preferences better.",
    rating: 4,
  },
  {
    id: 4,
    name: "Bikash Thapa",
    role: "Restaurant Owner",
    avatar:
      "https://images.pexels.com/photos/2128807/pexels-photo-2128807.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&dpr=2",
    content:
      "We've reduced our order taking time by 70% and virtually eliminated order errors. Our staff can focus more on providing great service rather than running back and forth taking orders. It's been a game-changer.",
    rating: 5,
  },
];

export default function Testimonials() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef(null);

  const goToTestimonial = (index) => {
    if (isAnimating) return;

    setIsAnimating(true);
    setActiveIndex(index);

    setTimeout(() => {
      setIsAnimating(false);
    }, 500);
  };

  const nextTestimonial = () => {
    goToTestimonial((activeIndex + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    goToTestimonial(
      (activeIndex - 1 + testimonials.length) % testimonials.length
    );
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("animate-fade-in");
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      nextTestimonial();
    }, 6000);

    return () => clearInterval(timer);
  }, [activeIndex]);

  return (
    <section
      id="testimonials"
      className="py-16 md:py-24 bg-muted/30"
      ref={containerRef}
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16 opacity-0 transform translate-y-4 transition-all duration-700 animate-fade-in">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            What Our Users Say
          </h2>
          <p className="text-xl text-muted-foreground">
            Join hundreds of happy restaurant owners who've transformed their
            business
          </p>
        </div>

        <div className="relative max-w-4xl mx-auto px-8">
          {/* Navigation Buttons */}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 z-10">
            <Button
              onClick={prevTestimonial}
              variant="ghost"
              size="icon"
              className="rounded-full bg-background/80 backdrop-blur-sm shadow-sm"
              disabled={isAnimating}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </div>

          <div className="absolute top-1/2 -translate-y-1/2 right-0 z-10">
            <Button
              onClick={nextTestimonial}
              variant="ghost"
              size="icon"
              className="rounded-full bg-background/80 backdrop-blur-sm shadow-sm"
              disabled={isAnimating}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Testimonial Cards */}
          <div className="relative h-[400px] md:h-[300px] overflow-hidden">
            {testimonials.map((testimonial, index) => (
              <div
                key={testimonial.id}
                className={mergeClasses(
                  "absolute inset-0 flex flex-col md:flex-row items-center gap-6 bg-card rounded-xl p-6 shadow-sm border border-border transition-all duration-500",
                  index === activeIndex
                    ? "opacity-100 translate-x-0 z-10"
                    : index < activeIndex
                    ? "opacity-0 -translate-x-full z-0"
                    : "opacity-0 translate-x-full z-0"
                )}
              >
                <div className="flex-shrink-0 md:w-1/4">
                  <div className="w-24 h-24 rounded-full overflow-hidden mx-auto border-4 border-orange-100 dark:border-orange-900/30">
                    <img
                      src={testimonial.avatar}
                      alt={testimonial.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                <div className="flex-1 text-center md:text-left">
                  <div className="flex justify-center md:justify-start mb-2">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={mergeClasses(
                          "w-5 h-5",
                          i < testimonial.rating
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-gray-300"
                        )}
                      />
                    ))}
                  </div>

                  <p className="mb-4 italic">"{testimonial.content}"</p>

                  <div>
                    <h4 className="font-semibold">{testimonial.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {testimonial.role}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Dots Indicator */}
          <div className="flex justify-center space-x-2 mt-6">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => goToTestimonial(index)}
                className={mergeClasses(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  index === activeIndex
                    ? "bg-orange-500 w-6"
                    : "bg-gray-300 dark:bg-gray-600"
                )}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
