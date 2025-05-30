"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Upload, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function CreateMenu() {
  const router = useRouter();
  const [menuItems, setMenuItems] = useState([
    {
      name: "",
      price: "",
      description: "",
      category: "",
      image: null,
      imagePreview: null,
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, token } = useAuth();
  const fileInputRefs = useRef([]);

  const triggerFileSelect = (index) => {
    if (fileInputRefs.current[index]) {
      fileInputRefs.current[index].click();
    }
  };

  const handleFileChange = (e, index) => {
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
    const newMenuItems = [...menuItems];
    newMenuItems[index].image = file;
    newMenuItems[index].imagePreview = URL.createObjectURL(file);
    setMenuItems(newMenuItems);
  };

  const addMenuItem = () => {
    setMenuItems([
      ...menuItems,
      {
        name: "",
        price: "",
        description: "",
        category: "",
        image: null,
        imagePreview: null,
      },
    ]);
  };

  const removeMenuItem = (index) => {
    // Release object URL to prevent memory leaks
    if (menuItems[index]?.imagePreview) {
      URL.revokeObjectURL(menuItems[index].imagePreview);
    }

    const newItems = menuItems.filter((_, i) => i !== index);
    setMenuItems(newItems);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...menuItems];
    newItems[index][field] = value;
    setMenuItems(newItems);
  };

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      menuItems.forEach((item) => {
        if (item.imagePreview) {
          URL.revokeObjectURL(item.imagePreview);
        }
      });
    };
  }, []);

  const validateItems = () => {
    const errors = [];
    menuItems.forEach((item, index) => {
      if (!item.name.trim()) {
        errors.push(`Item #${index + 1}: Name is required`);
      }
      if (!item.price.trim()) {
        errors.push(`Item #${index + 1}: Price is required`);
      } else if (isNaN(parseFloat(item.price)) || parseFloat(item.price) <= 0) {
        errors.push(`Item #${index + 1}: Price must be a positive number`);
      }
      if (!item.category.trim()) {
        errors.push(`Item #${index + 1}: Category is required`);
      }
    });

    return errors;
  };

  const handleSubmit = async () => {
    // Validate inputs
    const errors = validateItems();
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }

    if (!user?.id || !token) {
      toast.error("You must be logged in to create a menu");
      return;
    }

    setIsSubmitting(true);

    try {
      // Create form data to send files
      const formData = new FormData();

      // Convert menu items to JSON and add to form data
      // Exclude the actual file and preview URL from JSON
      const itemsForJson = menuItems.map(
        ({ image, imagePreview, ...item }) => item
      );
      formData.append("menuItems", JSON.stringify(itemsForJson));

      // Add each image with its index
      menuItems.forEach((item, index) => {
        if (item.image) {
          formData.append(`image_${index}`, item.image);
        }
      });

      const response = await fetch(
        `http://localhost:8000/api/menu/create/${user.id}/`,
        {
          method: "POST",
          headers: {
            Authorization: `Token ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success("Menu created successfully!");
        router.push("/dashboard/manage-menu");
      } else {
        const errorMessage = data.details
          ? `Failed to create menu: ${
              Array.isArray(data.details) ? data.details[0] : data.details
            }`
          : "Failed to create menu. Please check your inputs.";
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred while submitting the menu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Create Menu</h1>
        <Button
          onClick={addMenuItem}
          className="bg-orange-500 hover:bg-orange-600 text-white"
          disabled={isSubmitting}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      </div>

      <div className="space-y-6">
        {menuItems.map((item, index) => (
          <div
            key={index}
            className="bg-card rounded-lg border border-border p-6 relative"
          >
            <button
              type="button"
              onClick={() => removeMenuItem(index)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Item Name*</label>
                  <Input
                    value={item.name}
                    onChange={(e) =>
                      handleItemChange(index, "name", e.target.value)
                    }
                    placeholder="e.g., Butter Chicken"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Price*</label>
                  <Input
                    type="number"
                    value={item.price}
                    onChange={(e) =>
                      handleItemChange(index, "price", e.target.value)
                    }
                    placeholder="e.g., 250"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Category*</label>
                  <Input
                    value={item.category}
                    onChange={(e) =>
                      handleItemChange(index, "category", e.target.value)
                    }
                    placeholder="e.g., Main Course"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={item.description}
                    onChange={(e) =>
                      handleItemChange(index, "description", e.target.value)
                    }
                    placeholder="Describe your dish..."
                    className="h-32"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">
                    Item Image
                  </label>
                  <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                    {item.imagePreview ? (
                      <div className="space-y-2">
                        <div className="relative w-full aspect-video mx-auto">
                          <img
                            src={item.imagePreview}
                            alt="Preview"
                            className="rounded-md object-cover w-full h-full"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleItemChange(index, "image", null) &
                              handleItemChange(index, "imagePreview", null)
                            }
                            className="absolute top-2 right-2 bg-black/50 rounded-full p-1 hover:bg-black/70 transition-colors"
                          >
                            <X className="h-4 w-4 text-white" />
                          </button>
                        </div>
                        <p className="text-sm text-green-600 flex items-center justify-center">
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Image
                          uploaded
                        </p>
                      </div>
                    ) : (
                      <>
                        <input
                          ref={(el) => (fileInputRefs.current[index] = el)}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => handleFileChange(e, index)}
                          aria-label="Upload image file"
                        />
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => triggerFileSelect(index)}
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
          </div>
        ))}

        <div className="flex justify-end space-x-4">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/manage-menu")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-orange-500 hover:bg-orange-600 text-white"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating Menu..." : "Publish Menu"}
          </Button>
        </div>
      </div>
    </main>
  );
}
