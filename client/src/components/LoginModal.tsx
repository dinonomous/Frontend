import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export const LoginModal = ({
  open,
  onClose,
  onSignup,
  theme,
}: {
  open: boolean;
  onClose: () => void;
  onSignup: () => void;
  theme?: "light" | "dark";
}) => {
  const { login, loading, error } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!username || !password) {
      setLocalError("Username and password required");
      return;
    }
    try {
      await login(username, password);
      onClose();
    } catch (err: any) {
      // If backend returns user not found, open signup modal
      if (err?.response?.data?.detail?.toLowerCase().includes("not found")) {
        onSignup();
      } else {
        setLocalError("Invalid credentials");
      }
    }
  };

  const textColor = theme === "dark" ? "text-white" : "text-black";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className={`bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6 w-full max-w-xs ${textColor}`}
      >
        <h2 className={`text-lg font-semibold mb-4 ${textColor}`}>Login</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className={`w-full px-3 py-2 border rounded bg-transparent ${textColor}`}
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            autoFocus
          />
          <input
            className={`w-full px-3 py-2 border rounded bg-transparent ${textColor}`}
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          {(localError || error) && (
            <div className="text-red-500 text-sm">{localError || error}</div>
          )}
          <button
            type="submit"
            className={`w-full bg-blue-600 py-2 rounded hover:bg-blue-700 transition ${textColor}`}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        <div className="flex justify-between mt-4">
          <button
            className={`text-xs hover:underline ${textColor}`}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={`text-xs text-blue-600 hover:underline ${textColor}`}
            onClick={onSignup}
          >
            New user? Sign up
          </button>
        </div>
      </div>
    </div>
  );
};
