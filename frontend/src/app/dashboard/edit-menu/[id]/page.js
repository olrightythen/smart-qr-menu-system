"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { use } from "react"; // Import use from React
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Upload, X } from "lucide-react";
import toast from "react-hot-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditMenuItem({ params }) {
  const router = useRouter();
  // Unwrap the params Promise with React.use()
  const unwrappedParams = use(params);
  const { id } = unwrappedParams;

  const { user, token } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Initialize with placeholder data
  const [menuItem, setMenuItem] = useState({
    name: "",
    price: "",
    description: "",
    category: "",
    is_available: true,
    image_url: null,
  });

  // Track the new image file
  const [newImage, setNewImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    if (user?.id && token && id) {
      fetchMenuItem();
    }
  }, [user, token, id]);

  const fetchMenuItem = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/menu/item/${id}/`,
        {
          method: "GET",
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch menu item");
      }

      const data = await response.json();
      setMenuItem(data);
      // Initialize image preview with current image
      setImagePreview(data.image_url);
    } catch (error) {
      console.error("Error fetching menu item:", error);
      toast.error("Failed to load menu item details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setMenuItem((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large. Maximum size is 5MB.");
      return;
    }

    // Check file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Please use JPEG, PNG, or WebP.");
      return;
    }

    // Create a preview URL and store the file
    setNewImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    // If there was a preview URL, revoke it to prevent memory leaks
    if (imagePreview && imagePreview !== menuItem.image_url) {
      URL.revokeObjectURL(imagePreview);
    }
    setNewImage(null);
    setImagePreview(menuItem.image_url);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate inputs
    if (!menuItem.name.trim()) {
      toast.error("Name is required");
      return;
    }

    const price = parseFloat(menuItem.price);
    if (isNaN(price) || price <= 0) {
      toast.error("Price must be a positive number");
      return;
    }

    if (!menuItem.category.trim()) {
      toast.error("Category is required");
      return;
    }

    setIsSaving(true);

    try {
      // Create form data to send files
      const formData = new FormData();
      formData.append("name", menuItem.name);
      formData.append("price", menuItem.price);
      formData.append("category", menuItem.category);
      formData.append("description", menuItem.description || "");
      formData.append("is_available", menuItem.is_available);

      // Add image only if a new one was selected
      if (newImage) {
        formData.append("image", newImage);
      }

      const response = await fetch(
        `http://localhost:8000/api/menu/item/${id}/`,
        {
          method: "PUT",
          headers: {
            Authorization: `Token ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success("Menu item updated successfully");
        router.push("/dashboard/manage-menu");
      } else {
        const errorMessage = data.details
          ? `Failed to update menu item: ${
              Array.isArray(data.details) ? data.details[0] : data.details
            }`
          : "Failed to update menu item. Please check your inputs.";
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error("Error updating menu item:", error);
      toast.error("An error occurred while updating the menu item.");
    } finally {
      setIsSaving(false);
    }
  };

  // Cleanup function for object URL when component unmounts
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview !== menuItem.image_url) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview, menuItem.image_url]);

  return (
    <main className="p-4 md:p-6 space-y-6">
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={() => router.back()} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl md:text-3xl font-bold">Edit Menu Item</h1>
      </div>

      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="bg-card rounded-xl border border-border p-6"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Item Name*</label>
                <Input
                  name="name"
                  value={menuItem.name}
                  onChange={handleChange}
                  placeholder="e.g., Butter Chicken"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium">Price*</label>
                <Input
                  name="price"
                  type="number"
                  value={menuItem.price}
                  onChange={handleChange}
                  placeholder="e.g., 250"
                  step="0.01"
                  min="0"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium">Category*</label>
                <Input
                  name="category"
                  value={menuItem.category}
                  onChange={handleChange}
                  placeholder="e.g., Main Course"
                  required
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  name="description"
                  value={menuItem.description}
                  onChange={handleChange}
                  placeholder="Describe your dish..."
                  className="h-32"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">
                  Item Image
                </label>
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                  {imagePreview ? (
                    <div className="space-y-2">
                      <div className="relative w-full aspect-video mx-auto">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="rounded-md object-cover w-full h-full"
                        />
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute top-2 right-2 bg-black/50 rounded-full p-1 hover:bg-black/70 transition-colors"
                        >
                          <X className="h-4 w-4 text-white" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleFileChange}
                        aria-label="Upload image file"
                      />
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={triggerFileSelect}
                        type="button"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Image
                      </Button>
                      <p className="text-sm text-muted-foreground mt-2">
                        PNG, JPG up to 5MB
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4 mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      )}
    </main>
  );
}
