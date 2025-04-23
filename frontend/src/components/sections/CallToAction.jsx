"use client";

import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const benefits = [
  "No setup fees or monthly subscriptions",
  "Free forever for small businesses",
  "Easy to set up in under 10 minutes",
  "24/7 customer support",
];

export default function CallToAction() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
      setEmail('');
    }, 1500);
  };

  return (
    <section className="py-16 md:py-24 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-white dark:from-gray-900 dark:to-gray-950 z-0"></div>
      
      {/* Background circles */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-orange-100/50 dark:bg-orange-900/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-green-100/50 dark:bg-green-900/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl"></div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="max-w-4xl mx-auto rounded-2xl bg-card shadow-xl border border-border overflow-hidden">
          <div className="grid md:grid-cols-2">
            <div className="p-8 md:p-12">
              <h2 className="text-3xl font-bold mb-4">Ready to digitize your menu?</h2>
              <p className="text-muted-foreground mb-6">
                Join thousands of restaurants using Smart QR Menu System. Get started today with our 30-day free trial.
              </p>
              
              <ul className="space-y-3 mb-8">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mt-0.5">
                      <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="ml-3">{benefit}</span>
                  </li>
                ))}
              </ul>
              
              {isSubmitted ? (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-green-800 dark:text-green-300">
                  <p className="font-medium">Thank you for your interest!</p>
                  <p className="text-sm">We'll be in touch with you shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="flex-1"
                    />
                    <Button 
                      type="submit" 
                      variant="orange"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Sending...' : 'Get Started'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    By signing up, you agree to our Terms of Service and Privacy Policy.
                  </p>
                </form>
              )}
            </div>
            
            <div className="bg-gradient-to-br from-orange-500 to-red-600 hidden md:block">
              <div className="h-full flex items-center justify-center p-6">
                <div className="text-white max-w-xs">
                  <h3 className="text-2xl font-bold mb-4">Elevate Your Dining Experience</h3>
                  <p className="opacity-90 mb-6">
                    "Smart QR Menu System has revolutionized how we operate. Our customers love it, and we've seen a significant increase in order value."
                  </p>
                  <div>
                    <div className="font-medium">Aarav Patel</div>
                    <div className="opacity-75 text-sm">Spice Garden Restaurant</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-24 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to get started?</h2>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Button size="lg" variant="orange">
              Create Your QR Menu <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline">
              Contact Sales
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}