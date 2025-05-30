"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Store,
  Mail,
  Lock,
  MapPin,
  User,
  Phone,
  ClipboardList,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Footer from "@/components/sections/Footer";
import Navbar from "@/components/navigation/Navbar";

export default function Signup() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    restaurant_name: "",
    owner_name: "",
    email: "",
    phone: "",
    location: "",
    description: "",
    opening_time: "10:00",
    closing_time: "22:00",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({
    restaurant_name: "",
    owner_name: "",
    email: "",
    phone: "",
    location: "",
    description: "",
    opening_time: "",
    closing_time: "",
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

    // Clear error when field is being edited
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {
      restaurant_name: "",
      owner_name: "",
      email: "",
      phone: "",
      location: "",
      description: "",
      opening_time: "",
      closing_time: "",
      password: "",
      confirmPassword: "",
    };
    let isValid = true;

    // Restaurant name validation
    if (!formData.restaurant_name.trim()) {
      newErrors.restaurant_name = "Restaurant name is required";
      isValid = false;
    } else {
      const nameRegex = /^[a-zA-Z0-9\s.,'-]{3,50}$/;
      if (!nameRegex.test(formData.restaurant_name)) {
        newErrors.restaurant_name =
          "Name must be 3-50 characters and can include letters, numbers, spaces, and basic punctuation";
        isValid = false;
      }
    }

    // Owner name validation
    if (!formData.owner_name.trim()) {
      newErrors.owner_name = "Owner name is required";
      isValid = false;
    } else {
      const nameRegex = /^[a-zA-Z\s.,'-]{3,50}$/;
      if (!nameRegex.test(formData.owner_name)) {
        newErrors.owner_name =
          "Owner name must be 3-50 characters and can include letters, spaces, and basic punctuation";
        isValid = false;
      }
    }

    // Location validation
    if (!formData.location.trim()) {
      newErrors.location = "Location is required";
      isValid = false;
    }

    // Phone validation
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
      isValid = false;
    } else {
      const phoneRegex = /^(\+\d{1,3}[- ]?)?\d{10}$/;
      if (!phoneRegex.test(formData.phone.replace(/\s+/g, ""))) {
        newErrors.phone = "Enter a valid phone number (e.g. +977 9812345678)";
        isValid = false;
      }
    }

    // Description validation
    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
      isValid = false;
    } else if (formData.description.length < 20) {
      newErrors.description = "Description must be at least 20 characters";
      isValid = false;
    }

    // Business hours validation
    if (!formData.opening_time) {
      newErrors.opening_time = "Opening time is required";
      isValid = false;
    }

    if (!formData.closing_time) {
      newErrors.closing_time = "Closing time is required";
      isValid = false;
    }

    if (formData.opening_time >= formData.closing_time) {
      newErrors.closing_time = "Closing time must be after opening time";
      isValid = false;
    }

    // Email validation
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

    // Password validation
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
          "Include uppercase, lowercase, number & special character";
        isValid = false;
      }
    }

    // Confirm password validation
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
            owner_name: formData.owner_name,
            phone: formData.phone,
            location: formData.location,
            description: formData.description,
            opening_time: formData.opening_time,
            closing_time: formData.closing_time,
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

  // Basic form fields
  const basicFormFields = [
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
      label: "Owner Name",
      name: "owner_name",
      type: "text",
      placeholder: "Full name of owner",
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
      label: "Phone Number",
      name: "phone",
      type: "tel",
      placeholder: "+977 9812345678",
      icon: (
        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
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
  ];

  // Security form fields
  const securityFormFields = [
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
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4 mt-16">
        <div className="max-w-2xl w-full">
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

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h2 className="text-lg font-medium mb-4">
                  Restaurant Information
                </h2>
                <div className="space-y-4">
                  {basicFormFields.map((field) => (
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

                  {/* Description textarea */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Restaurant Description
                    </label>
                    <div className="relative">
                      <ClipboardList className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Textarea
                        name="description"
                        placeholder="Brief description of your restaurant..."
                        value={formData.description}
                        onChange={handleChange}
                        className={`pl-10 min-h-[100px] ${
                          errors.description
                            ? "border-red-500 focus-visible:ring-red-500"
                            : ""
                        }`}
                      />
                    </div>
                    {errors.description && (
                      <p className="text-xs font-medium text-red-500 mt-1">
                        {errors.description}
                      </p>
                    )}
                  </div>

                  {/* Business Hours */}
                  <div>
                    <label className="text-sm font-medium block mb-2">
                      Business Hours
                    </label>
                    <div className="flex items-center space-x-3">
                      <div className="relative flex-1">
                        <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="time"
                          name="opening_time"
                          value={formData.opening_time}
                          onChange={handleChange}
                          className={`pl-10 ${
                            errors.opening_time
                              ? "border-red-500 focus-visible:ring-red-500"
                              : ""
                          }`}
                        />
                        {errors.opening_time && (
                          <p className="text-xs font-medium text-red-500 mt-1">
                            {errors.opening_time}
                          </p>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">to</span>
                      <div className="relative flex-1">
                        <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="time"
                          name="closing_time"
                          value={formData.closing_time}
                          onChange={handleChange}
                          className={`pl-10 ${
                            errors.closing_time
                              ? "border-red-500 focus-visible:ring-red-500"
                              : ""
                          }`}
                        />
                        {errors.closing_time && (
                          <p className="text-xs font-medium text-red-500 mt-1">
                            {errors.closing_time}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-medium mb-4">Security</h2>
                <div className="space-y-4">
                  {securityFormFields.map((field) => (
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
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                disabled={isLoading}
              >
                {isLoading ? "Creating account..." : "Create account"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">
                Already registered?{" "}
              </span>
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
      <Footer />
    </div>
  );
}
