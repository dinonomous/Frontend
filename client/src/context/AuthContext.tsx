"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { parseJwt } from "@/utils/parseJwt"; // helper to parse the token payload
import { useRouter } from "next/navigation";
import Cookies from "js-cookie"; // For reading cookies client-side

// Define the shape of the Auth context
type AuthContextType = {
  isAuthenticated: boolean;
  username: string | null;
  logout: () => void;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // On mount, check for tokens in cookies
    const idToken = Cookies.get("id_token");
    if (idToken) {
      try {
        const parsed = parseJwt(idToken);
        setUsername(parsed["cognito:username"] || parsed["email"] || null);
        setIsAuthenticated(true);
      } catch (err) {
        console.error("Invalid token", err);
        setIsAuthenticated(false);
        setUsername(null);
      }
    } else {
      setIsAuthenticated(false);
      setUsername(null);
    }
    setLoading(false);
  }, []);

  const logout = () => {
    Cookies.remove("id_token");
    Cookies.remove("access_token");
    Cookies.remove("refresh_token");
    setIsAuthenticated(false);
    setUsername(null);
    router.push("/api/logout"); // You can handle server-side Cognito logout here
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, username, logout, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
