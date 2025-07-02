"use client";
import { useAuth } from '@/context/AuthContext';
import { LoginModal } from '@/components/LoginModal';
import { SignupModal } from '@/components/SignupModal';
import { useTheme } from '@/context/ModelContext';
import { useState } from 'react';

export default function HeaderWithAuth() {
  const { isAuthenticated, logout } = useAuth();
  const { theme } = useTheme();
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  // If login fails with user not found, open signup modal (handled in LoginModal)
  const handleOpenSignup = () => {
    setShowLogin(false);
    setShowSignup(true);
  };

  // Utility for text color based on theme
  const textColor = theme === 'dark' ? 'text-white' : 'text-black';

  return (
    <header className={`sticky top-0 z-20 px-6 py-4 flex justify-end bg-background ${textColor}`}>
      {isAuthenticated ? (
        <button
          className={`px-4 py-2 rounded bg-red-500 hover:bg-red-600 transition ${textColor}`}
          onClick={logout}
        >
          Logout
        </button>
      ) : (
        <>
          <button
            className={`px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 transition ${textColor}`}
            onClick={() => setShowLogin(true)}
          >
            Login
          </button>
          <LoginModal
            open={showLogin}
            onClose={() => setShowLogin(false)}
            onSignup={handleOpenSignup}
            theme={theme}
          />
          <SignupModal
            open={showSignup}
            onClose={() => setShowSignup(false)}
            onLogin={() => {
              setShowSignup(false);
              setShowLogin(true);
            }}
            theme={theme}
          />
        </>
      )}
    </header>
  );
}
