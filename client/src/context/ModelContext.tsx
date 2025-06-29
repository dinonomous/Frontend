"use client";
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { LocalModel } from '../api/ollama';

type Theme = 'light' | 'dark';

type ModelContextType = {
  // Model-related state
  model: string;
  setModel: (model: string) => void;
  currentModelData: LocalModel | null;
  setCurrentModelData: (modelData: LocalModel | null) => void;
  isModelLoaded: boolean;
  setIsModelLoaded: (loaded: boolean) => void;
  loadedModels: Set<string>;
  addLoadedModel: (model: string) => void;
  removeLoadedModel: (model: string) => void;
  clearLoadedModels: () => void;
  
  // Theme-related state
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDarkMode: boolean;
};

const ModelContext = createContext<ModelContextType | null>(null);

export const ModelProvider = ({ children }: { children: React.ReactNode }) => {
  // Model state
  const [model, setModel] = useState('');
  const [currentModelData, setCurrentModelData] = useState<LocalModel | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [loadedModels, setLoadedModels] = useState<Set<string>>(new Set());
  
  // Theme state with system preference detection
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check if we're in browser environment
    if (typeof window !== 'undefined') {
      // Try to get saved theme from localStorage
      const savedTheme = localStorage.getItem('theme') as Theme;
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
        return savedTheme;
      }
      // Fallback to system preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  // Model management functions
  const addLoadedModel = useCallback((model: string) => {
    setLoadedModels(prev => new Set(prev).add(model));
  }, []);

  const removeLoadedModel = useCallback((model: string) => {
    setLoadedModels(prev => {
      const newSet = new Set(prev);
      newSet.delete(model);
      return newSet;
    });
  }, []);

  const clearLoadedModels = useCallback(() => {
    setLoadedModels(new Set());
  }, []);

  const handleSetModel = useCallback((newModel: string) => {
    setModel(newModel);
    setIsModelLoaded(false); // Reset loading state when changing models
  }, []);

  // Theme management functions
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  const isDarkMode = theme === 'dark';

  // Apply theme to document
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement;
      
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = (e: MediaQueryListEvent) => {
        // Only update if no theme is saved in localStorage
        const savedTheme = localStorage.getItem('theme');
        if (!savedTheme) {
          setThemeState(e.matches ? 'dark' : 'light');
        }
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  const contextValue: ModelContextType = {
    // Model-related
    model,
    setModel: handleSetModel,
    currentModelData,
    setCurrentModelData,
    isModelLoaded,
    setIsModelLoaded,
    loadedModels,
    addLoadedModel,
    removeLoadedModel,
    clearLoadedModels,
    
    // Theme-related
    theme,
    setTheme,
    toggleTheme,
    isDarkMode
  };

  return (
    <ModelContext.Provider value={contextValue}>
      {children}
    </ModelContext.Provider>
  );
};

export const useModel = () => {
  const context = useContext(ModelContext);
  if (!context) {
    throw new Error('useModel must be used within ModelProvider');
  }
  return context;
};

// Convenience hook for theme-only operations
export const useTheme = () => {
  const { theme, setTheme, toggleTheme, isDarkMode } = useModel();
  return { theme, setTheme, toggleTheme, isDarkMode };
};