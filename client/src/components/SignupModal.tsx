import React, { useState } from "react";
import { register } from "@/api/auth";

export const SignupModal = ({
  open,
  onClose,
  onLogin,
  theme,
}: {
  open: boolean;
  onClose: () => void;
  onLogin: () => void;
  theme?: 'light' | 'dark';
}) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!username || !email || !password) {
      setLocalError("All fields are required");
      return;
    }
    setLoading(true);
    try {
      await register(username, email, password);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        onLogin();
      }, 1000);
    } catch (err: any) {
      setLocalError("Registration failed");
    } finally {
      setLoading(false);
    }
  };

  // Placeholder for Google sign-in
  const handleGoogleSignIn = () => {
    alert("Google sign-in not implemented. Integrate with your backend.");
  };

  const textColor = theme === 'dark' ? 'text-white' : 'text-black';

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className={`bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6 w-full max-w-xs ${textColor}`}>
        <h2 className={`text-lg font-semibold mb-4 ${textColor}`}>Sign Up</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className={`w-full px-3 py-2 border rounded bg-transparent ${textColor}`}
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            disabled={loading}
            autoFocus
          />
          <input
            className={`w-full px-3 py-2 border rounded bg-transparent ${textColor}`}
            placeholder="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={loading}
          />
          <input
            className={`w-full px-3 py-2 border rounded bg-transparent ${textColor}`}
            placeholder="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={loading}
          />
          {localError && (
            <div className="text-red-500 text-sm">{localError}</div>
          )}
          <button
            type="submit"
            className={`w-full bg-blue-600 py-2 rounded hover:bg-blue-700 transition ${textColor}`}
            disabled={loading}
          >
            {loading ? "Signing up..." : "Sign Up"}
          </button>
        </form>
        <button
          className={`w-full mt-3 bg-red-500 py-2 rounded hover:bg-red-600 transition ${textColor}`}
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          Sign up with Google
        </button>
        <div className="flex justify-between mt-4">
          <button
            className={`text-xs hover:underline ${textColor}`}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={`text-xs text-blue-600 hover:underline ${textColor}`}
            onClick={onLogin}
          >
            Already have an account? Login
          </button>
        </div>
        {success && (
          <div className="text-green-600 text-sm mt-2">Registration successful! Redirecting...</div>
        )}
      </div>
    </div>
  );
};
