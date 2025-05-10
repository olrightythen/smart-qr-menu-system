"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Store, Mail, Lock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function Signup() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    restaurant_name: "",
    email: "",
    location: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({
    restaurant_name: "",
    email: "",
    location: "",
    password: "",
    confirmPassword: "",
  });

  // Ensure component is mounted before using router
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    const newErrors = {
      restaurant_name: "",
      email: "",
      location: "",
      password: "",
      confirmPassword: "",
    };
    let isValid = true;

    if (!formData.restaurant_name.trim()) {
      newErrors.restaurant_name = "Restaurant name is required";
      isValid = false;
    }

    if (!formData.location.trim()) {
      newErrors.location = "Location is required";
      isValid = false;
    }

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

    if (!formData.password) {
      newErrors.password = "Password is required";
      isValid = false;
    } else if (formData.password.length < 8) {
      newErrors.password = "Minimum 8 characters required";
      isValid = false;
    } else {
      const passStrength =
        /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/;
      if (!passStrength.test(formData.password)) {
        newErrors.password =
          "Include uppercase, lowercase, number, special character";
        isValid = false;
      }
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Confirm your password";
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
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/vendor/register/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: formData.email,
            email: formData.email,
            password: formData.password,
            restaurant_name: formData.restaurant_name,
            location: formData.location,
          }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        // Only redirect if component is mounted
        if (mounted) {
          router.push("/login");
          toast.success("Registration successful! Please log in.");
        }
      } else {
        // error message using toast
        toast.error(data.error || "Registration failed.");
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const formFields = [
    {
      label: "Restaurant Name",
      name: "restaurant_name",
      type: "text",
      placeholder: "Your restaurant name",
      icon: (
        <Store className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
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
      label: "Location",
      name: "location",
      type: "text",
      placeholder: "Restaurant location",
      icon: (
        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
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
            <h1 className="text-2xl font-bold mb-2">Sign Up</h1>
            <p className="text-muted-foreground">
              Register to manage your digital menu
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
                    className={`pl-10 ${
                      errors[field.name]
                        ? "border-red-500 focus-visible:ring-red-500"
                        : ""
                    }`}
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
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already registered? </span>
            <Link
              href="/login"
              className="text-orange-500 hover:text-orange-600 font-medium"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
