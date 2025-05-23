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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import DashboardSidebar from "@/components/dashboard/Sidebar";
import DashboardHeader from "@/components/dashboard/Header";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

export default function Settings() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [selectedLogo, setSelectedLogo] = useState(null);
  const { user, token, updateUserData } = useAuth();
  const fileInputRef = useRef(null);

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

  // Fetch vendor data when component mounts
  useEffect(() => {
    if (user?.id && token) {
      fetchVendorData();
    } else {
      setIsLoading(false);
    }
  }, [user, token]);

  const fetchVendorData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `http://localhost:8000/api/vendor/${user.id}/`,
        {
          headers: {
            Authorization: `Token ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch vendor data");
      }

      const data = await response.json();

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

      // Check if logo is a complete URL or a relative path
      if (data.logo) {
        // If it's a relative URL, make sure to add the base URL
        const logoUrl = data.logo.startsWith('http') ? data.logo : `http://localhost:8000${data.logo}`;
        setLogoPreview(logoUrl);
      }

      setError(null);
    } catch (error) {
      console.error("Error fetching vendor data:", error);
      setError("Failed to load your restaurant information. Please try again.");
      toast.error("Could not load your settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!formData.restaurant_name.trim()) {
      toast.error("Restaurant name is required");
      return;
    }

    if (!formData.email.trim()) {
      toast.error("Email address is required");
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
        const errorData = await response.json();
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
    <div className="min-h-screen bg-background">
      <DashboardSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <div
        className={`${
          isSidebarOpen ? "lg:ml-64" : "lg:ml-20"
        } transition-all duration-300`}
      >
        <DashboardHeader onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />

        <main className="p-4 md:p-6 space-y-6">
          <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
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
                        <div>
                          <label className="text-sm font-medium">
                            Restaurant Name*
                          </label>
                          <div className="relative">
                            <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              name="restaurant_name"
                              value={formData.restaurant_name}
                              onChange={handleChange}
                              className="pl-10"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-medium">
                            Owner Name
                          </label>
                          <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              name="owner_name"
                              value={formData.owner_name}
                              onChange={handleChange}
                              className="pl-10"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">
                            Email Address*
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              name="email"
                              value={formData.email}
                              onChange={handleChange}
                              className="pl-10"
                              required
                              type="email"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-medium">
                            Phone Number
                          </label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              name="phone"
                              value={formData.phone}
                              onChange={handleChange}
                              className="pl-10"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium">Address</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            name="location"
                            value={formData.location}
                            onChange={handleChange}
                            className="pl-10"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium">
                          Description
                        </label>
                        <Textarea
                          name="description"
                          value={formData.description}
                          onChange={handleChange}
                          rows={4}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">
                          Business Hours
                        </label>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium">Open</label>
                            <Input
                              name="opening_time"
                              type="time"
                              value={formData.opening_time}
                              onChange={handleChange}
                              className="w-full"
                            />
                          </div>

                          <div>
                            <label className="text-sm font-medium">Close</label>
                            <Input
                              name="closing_time"
                              type="time"
                              value={formData.closing_time}
                              onChange={handleChange}
                              className="w-full"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-card rounded-xl border border-border p-6">
                    <h2 className="text-xl font-semibold mb-4">
                      Restaurant Logo
                    </h2>

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
      </div>
    </div>
  );
}
