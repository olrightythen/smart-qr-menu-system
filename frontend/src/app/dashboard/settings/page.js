"use client";

import { useState, useEffect, useRef } from "react";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  Camera,
  Loader2,
  Upload,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

export default function Settings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [selectedLogo, setSelectedLogo] = useState(null);
  const { user, token, updateUserData } = useAuth();
  const fileInputRef = useRef(null);

  // Initialize formData with empty values
  const [formData, setFormData] = useState({
    restaurant_name: "",
    owner_name: "",
    email: "",
    phone: "",
    location: "",
    description: "",
    opening_time: "",
    closing_time: "",
  });

  // Add validation errors state
  const [errors, setErrors] = useState({
    restaurant_name: "",
    owner_name: "",
    email: "",
    phone: "",
    location: "",
    description: "",
    opening_time: "",
    closing_time: "",
  });

  // Fetch vendor data function
  const fetchVendorData = async () => {
    // Skip if no user or token - avoids unnecessary API calls
    if (!user?.id || !token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `http://localhost:8000/api/vendor/${user.id}/`,
        {
          headers: {
            Authorization: `Token ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }

      const data = await response.json();

      // Update form data
      setFormData({
        restaurant_name: data.restaurant_name || "",
        owner_name: data.owner_name || "",
        email: data.email || "",
        phone: data.phone || "",
        location: data.location || "",
        description: data.description || "",
        opening_time: data.opening_time || "",
        closing_time: data.closing_time || "",
      });

      if (data.logo) {
        setLogoPreview(data.logo);
      }
    } catch (err) {
      console.error("Error loading settings:", err);
      setError("Failed to load settings. Please refresh and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Move data fetching to a dedicated useEffect that runs AFTER the initial render
  // and only when user/token are available
  useEffect(() => {
    fetchVendorData();
  }, [user, token]); // Only re-run when user or token changes

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

  const handleLogoClick = () => {
    fileInputRef.current.click();
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validation for file type and size
    const validTypes = ["image/jpeg", "image/png", "image/jpg", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a valid image file (JPEG, PNG, GIF)");
      return;
    }

    // Max file size: 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Store the file for later submission with the form
    setSelectedLogo(file);
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
    };
    let isValid = true;

    // Restaurant name validation
    if (!formData.restaurant_name.trim()) {
      newErrors.restaurant_name = "Restaurant name is required";
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

    // Phone validation (optional but must be valid if provided)
    if (formData.phone.trim()) {
      const phoneRegex = /(\+977)?[9][7-8]\d{8}/;
      if (!phoneRegex.test(formData.phone.replace(/\s+/g, ""))) {
        newErrors.phone = "Enter a valid phone number (e.g. +977 9812345678)";
        isValid = false;
      }
    }

    // Location validation
    if (!formData.location.trim()) {
      newErrors.location = "Addrress is required";
      isValid = false;
    }
    // Owner name validation (optional but must be valid if provided)
    if (formData.owner_name.trim() && formData.owner_name.length < 3) {
      newErrors.owner_name = "Owner name must be at least 3 characters";
      isValid = false;
    }

    // Description validation (optional but must be valid if provided)
    if (formData.description.trim() && formData.description.length < 20) {
      newErrors.description = "Description must be at least 20 characters";
      isValid = false;
    }

    // Business hours validation
    if (formData.opening_time && formData.closing_time) {
      if (formData.opening_time >= formData.closing_time) {
        newErrors.closing_time = "Closing time must be after opening time";
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    if (!validateForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    setIsSaving(true);

    try {
      // Create a FormData object to handle both text fields and file
      const submitData = new FormData();

      // Add all text form fields to FormData
      Object.keys(formData).forEach((key) => {
        if (formData[key] !== null && formData[key] !== undefined) {
          submitData.append(key, formData[key]);
        }
      });

      // Add the logo file if one was selected
      if (selectedLogo) {
        submitData.append("logo", selectedLogo);
      }

      const response = await fetch(
        `http://localhost:8000/api/vendor/${user.id}/update/`,
        {
          method: "PUT",
          headers: {
            Authorization: `Token ${token}`,
            // Don't set Content-Type header when using FormData
            // The browser will set it with the correct boundary
          },
          body: submitData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update settings");
      }

      const data = await response.json();

      // Update user data in context
      const updatedUser = {
        ...user,
        ...formData,
        logo: data.logo || user.logo,
      };
      if (updateUserData) {
        updateUserData(updatedUser);
      }

      // Clear the selected logo since it's been uploaded
      setSelectedLogo(null);

      toast.success("Settings updated successfully");
    } catch (error) {
      console.error("Error updating settings:", error);
      toast.error(error.message || "Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-xl font-semibold mb-4">
                  Restaurant Information
                </h2>

                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Restaurant Name*
                      </label>
                      <div className="relative">
                        <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          name="restaurant_name"
                          value={formData.restaurant_name}
                          onChange={handleChange}
                          className={`pl-10 ${
                            errors.restaurant_name
                              ? "border-red-500 focus-visible:ring-red-500"
                              : ""
                          }`}
                          required
                        />
                      </div>
                      {errors.restaurant_name && (
                        <p className="text-xs font-medium text-red-500 mt-1">
                          {errors.restaurant_name}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Owner Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          name="owner_name"
                          value={formData.owner_name}
                          onChange={handleChange}
                          className={`pl-10 ${
                            errors.owner_name
                              ? "border-red-500 focus-visible:ring-red-500"
                              : ""
                          }`}
                        />
                      </div>
                      {errors.owner_name && (
                        <p className="text-xs font-medium text-red-500 mt-1">
                          {errors.owner_name}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Email Address*
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          className={`pl-10 ${
                            errors.email
                              ? "border-red-500 focus-visible:ring-red-500"
                              : ""
                          }`}
                          required
                          type="email"
                        />
                      </div>
                      {errors.email && (
                        <p className="text-xs font-medium text-red-500 mt-1">
                          {errors.email}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Phone Number
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          className={`pl-10 ${
                            errors.phone
                              ? "border-red-500 focus-visible:ring-red-500"
                              : ""
                          }`}
                          placeholder="+977 9812345678"
                        />
                      </div>
                      {errors.phone && (
                        <p className="text-xs font-medium text-red-500 mt-1">
                          {errors.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Address</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        className={`pl-10 ${
                          errors.location
                            ? "border-red-500 focus-visible:ring-red-500"
                            : ""
                        }`}
                      />
                    </div>
                    {errors.location && (
                      <p className="text-xs font-medium text-red-500 mt-1">
                        {errors.location}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={4}
                      className={`${
                        errors.description
                          ? "border-red-500 focus-visible:ring-red-500"
                          : ""
                      }`}
                      placeholder="Brief description of your restaurant..."
                    />
                    {errors.description && (
                      <p className="text-xs font-medium text-red-500 mt-1">
                        {errors.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      If provided, description should be at least 20 characters
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-2">
                      Business Hours
                    </label>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Open</label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            name="opening_time"
                            type="time"
                            value={formData.opening_time}
                            onChange={handleChange}
                            className={`pl-10 w-full ${
                              errors.opening_time
                                ? "border-red-500 focus-visible:ring-red-500"
                                : ""
                            }`}
                          />
                        </div>
                        {errors.opening_time && (
                          <p className="text-xs font-medium text-red-500 mt-1">
                            {errors.opening_time}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Close</label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            name="closing_time"
                            type="time"
                            value={formData.closing_time}
                            onChange={handleChange}
                            className={`pl-10 w-full ${
                              errors.closing_time
                                ? "border-red-500 focus-visible:ring-red-500"
                                : ""
                            }`}
                          />
                        </div>
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
            </div>

            <div className="space-y-6">
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-xl font-semibold mb-4">Restaurant Logo</h2>

                <div className="text-center">
                  <div
                    className="w-32 h-32 mx-auto bg-muted rounded-xl flex items-center justify-center mb-4 overflow-hidden cursor-pointer"
                    onClick={handleLogoClick}
                  >
                    {logoPreview || user?.logo ? (
                      <img
                        src={logoPreview || user?.logo}
                        alt="Restaurant Logo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Camera className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />

                  <Button
                    variant="outline"
                    className="w-full"
                    type="button"
                    onClick={handleLogoClick}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {selectedLogo ? "Change Logo" : "Upload Logo"}
                  </Button>

                  {selectedLogo && (
                    <p className="text-xs text-green-600 mt-1">
                      New logo selected - save to upload
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground mt-2">
                    Recommended size: 500x500px (max 5MB)
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4 mt-6">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                fetchVendorData();
                setSelectedLogo(null);
              }}
            >
              Reset
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      )}
    </main>
  );
}
