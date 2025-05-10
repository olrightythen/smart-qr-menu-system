"use client";

import { useState, useCallback, useEffect } from "react";
import { ArrowLeft, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation"; // Changed from next/router to next/navigation
import toast from "react-hot-toast"; // Added missing import

export default function Login() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({
    email: "",
    password: "",
  });

  // Ensure component is mounted before using router
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      // Clear error when user types
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: "" }));
      }
    },
    [errors]
  );

  const validateForm = useCallback(() => {
    const newErrors = {};
    const { email, password } = formData;

    // Validate Email
    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      newErrors.email = "Enter a valid email";
    }

    // Validate Password
    if (!password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      if (!validateForm()) return;

      setIsLoading(true);
      try {
        const response = await fetch(
          "http://127.0.0.1:8000/api/vendor/login/",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(formData),
          }
        );

        const data = await response.json();
        if (response.ok) {
          if (mounted) {
            router.push("/dashboard");
          }
        } else if (response.status === 401) {
          setErrors((prev) => ({
            ...prev,
            password: "Invalid email or password",
          }));
        } else {
          setErrors((prev) => ({
            ...prev,
            email: "An error occurred. Please try again.",
          }));
        }
      } catch (error) {
        toast.error("An error occurred. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [validateForm, router, mounted]
  );

  const FormField = ({ label, icon: Icon, type, name, placeholder }) => (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
      </label>
      <div className="relative">
        <Icon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          type={type}
          name={name}
          placeholder={placeholder}
          value={formData[name]}
          onChange={handleChange}
          className={`pl-10 ${errors[name] ? "border-red-500" : ""}`}
        />
        {errors[name] && (
          <p className="text-red-500 text-xs mt-1">{errors[name]}</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-card rounded-xl shadow-lg border border-border p-8">
          <div className="mb-8">
            <Link
              href="/"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to home
            </Link>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Welcome back</h1>
            <p className="text-muted-foreground">
              Sign in to your account to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              label="Email"
              icon={Mail}
              type="text"
              name="email"
              placeholder="Enter your email"
            />

            <FormField
              label="Password"
              icon={Lock}
              type="password"
              name="password"
              placeholder="Enter your password"
            />

            <Button
              type="submit"
              variant="orange"
              className="w-full mt-4"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">
              Don't have an account?{" "}
            </span>
            <Link
              href="/signup"
              className="text-orange-500 hover:text-orange-600 font-medium"
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
