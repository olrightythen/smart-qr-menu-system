"use client";

import { useState } from "react";
import { ArrowLeft, User, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export default function Signup() {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    const newErrors = {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    };
    let isValid = true;

    // Validate Name
    if (!formData.name) {
      newErrors.name = "Name is required";
      isValid = false;
    } else {
      const nameFormat = /^[a-zA-Z]+[a-zA-Z\s]*?[^0-9]$/;
      if (!nameFormat.test(formData.name)) {
        newErrors.name = "Enter a valid name";
        isValid = false;
      }
    }

    // Validate Email
    if (!formData.email) {
      newErrors.email = "Email is required";
      isValid = false;
    } else {
      const mailFormat = /^[a-zA-Z0-9._%+-]+@[a-zA-Z.-]+\.[a-zA-Z]{2,}$/;
      if (!mailFormat.test(formData.email)) {
        newErrors.email = "Enter a valid email";
        isValid = false;
      }
    }

    // Validate Password
    if (!formData.password) {
      newErrors.password = "Password is required";
      isValid = false;
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters long";
      isValid = false;
    } else {
      const passStrength =
        /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/;
      if (!passStrength.test(formData.password)) {
        newErrors.password =
          "Password must include at least one uppercase letter, one lowercase letter, one digit and one special character";
        isValid = false;
      }
    }

    // Validate Confirm Password
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm the password";
      isValid = false;
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
  };

  const formFields = [
    {
      label: "Full Name",
      name: "name",
      type: "text",
      placeholder: "Enter your name",
      icon: (
        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
      ),
    },
    {
      label: "Email",
      name: "email",
      type: "email",
      placeholder: "Enter your email",
      icon: (
        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
      ),
    },
    {
      label: "Password",
      name: "password",
      type: "password",
      placeholder: "Create a password",
      icon: (
        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
      ),
    },
    {
      label: "Confirm Password",
      name: "confirmPassword",
      type: "password",
      placeholder: "Confirm your password",
      icon: (
        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4 mt-16">
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
            <h1 className="text-2xl font-bold mb-2">Create an account</h1>
            <p className="text-muted-foreground">
              Sign up to get started with Smart QR Menu
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formFields.map((field) => (
              <div key={field.name} className="space-y-2">
                <label
                  htmlFor={field.name}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {field.label}
                </label>
                <div className="relative">
                  {field.icon}
                  <Input
                    id={field.name}
                    name={field.name}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={formData[field.name]}
                    onChange={handleChange}
                    className={`pl-10 ${errors[field.name] ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                </div>
                {errors[field.name] && (
                  <p className="text-xs font-medium text-red-500 mt-1">
                    {errors[field.name]}
                  </p>
                )}
              </div>
            ))}

            <Button
              type="submit"
              variant="orange"
              className="w-full mt-4"
              disabled={isLoading}
            >
              {isLoading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">
              Already have an account?{" "}
            </span>
            <Link
              href="/login"
              className="text-orange-500 hover:text-orange-600 font-medium"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
