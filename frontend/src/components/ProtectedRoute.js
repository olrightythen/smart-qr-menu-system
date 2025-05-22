"use client";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProtectedRoute({ children }) {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Only redirect when loading has finished and the user is not logged in
    if (!isLoading) {
      if (!isLoggedIn) {
        router.replace("/login");
      }
      // Mark checking as complete regardless of login state
      setIsChecking(false);
    }
  }, [isLoggedIn, isLoading, router]);

  // Show loading state while checking
  if (isLoading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-orange-500 border-b-transparent border-l-transparent border-r-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If not logged in, return nothing (redirect will happen in useEffect)
  if (!isLoggedIn) return null;

  // If logged in, render the children
  return children;
}
