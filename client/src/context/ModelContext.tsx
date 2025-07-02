"use client";
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { LocalModel } from '../api/ollama';
import { fetchPersonas, type Persona } from '../api/persona';
import { listModels } from '../api/ollama';

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

  // Persona-related state
  personas: Persona[];
  selectedPersona: string;
  setSelectedPersona: (persona: string) => void;
  selectedPersonaData: Persona | null;
  isPersonasLoading: boolean;
  personasError: string | null;
  refreshPersonas: () => Promise<void>;

  // Loading states
  isInitializing: boolean;
};

const ModelContext = createContext<ModelContextType | null>(null);

export const ModelProvider = ({ children }: { children: React.ReactNode }) => {
  // Model state
  const [model, setModel] = useState('');
  const [currentModelData, setCurrentModelData] = useState<LocalModel | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [loadedModels, setLoadedModels] = useState<Set<string>>(new Set());
  
  // Persona state
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState('general');
  const [isPersonasLoading, setIsPersonasLoading] = useState(true);
  const [personasError, setPersonasError] = useState<string | null>(null);

  const [isInitializing, setIsInitializing] = useState(true);
  const [theme, setThemeState] = useState<Theme>(() => {

    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as Theme;
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
        return savedTheme;
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  // Load personas function
  const loadPersonas = useCallback(async () => {
    try {
      setIsPersonasLoading(true);
      setPersonasError(null);
      const fetchedPersonas = await fetchPersonas();
      setPersonas(fetchedPersonas);

      if (!fetchedPersonas.some(p => p.value === selectedPersona)) {
        const defaultPersona = fetchedPersonas.find(p => p.value === 'general') || fetchedPersonas[0];
        if (defaultPersona) {
          setSelectedPersona(defaultPersona.value);
        }
      }
    } catch (error) {
      console.error('Failed to load personas:', error);
      setPersonasError(error instanceof Error ? error.message : 'Failed to load personas');
    } finally {
      setIsPersonasLoading(false);
    }
  }, [selectedPersona]);

  // Refresh personas function
  const refreshPersonas = useCallback(async () => {
    await loadPersonas();
  }, [loadPersonas]);

  // Load models function (you can implement this based on your API)
  const loadModels = useCallback(async () => {
    try {
      const response = await listModels()
      setModel(response.models[0].name)
      console.log('Loading models...');
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  }, []);

  // Initialize data on mount
  useEffect(() => {
    const initializeData = async () => {
      setIsInitializing(true);
      
      // Load personas and models in parallel
      await Promise.all([
        loadPersonas(),
        loadModels()
      ]);
      
      setIsInitializing(false);
    };

    initializeData();
  }, [loadPersonas, loadModels]);

  // Restore selected persona from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPersona = localStorage.getItem('selectedPersona');
      if (savedPersona && personas.some(p => p.value === savedPersona)) {
        setSelectedPersona(savedPersona);
      }
    }
  }, [personas]);

  // Save selected persona to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedPersona) {
      localStorage.setItem('selectedPersona', selectedPersona);
    }
  }, [selectedPersona]);

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

  // Persona management functions
  const handleSetSelectedPersona = useCallback((persona: string) => {
    setSelectedPersona(persona);
  }, []);

  // Get selected persona data
  const selectedPersonaData = personas.find(p => p.value === selectedPersona) || null;

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
    isDarkMode,

    // Persona-related
    personas,
    selectedPersona,
    setSelectedPersona: handleSetSelectedPersona,
    selectedPersonaData,
    isPersonasLoading,
    personasError,
    refreshPersonas,

    // Loading states
    isInitializing
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

// Convenience hook for persona-only operations
export const usePersona = () => {
  const { 
    personas, 
    selectedPersona, 
    setSelectedPersona, 
    selectedPersonaData, 
    isPersonasLoading, 
    personasError, 
    refreshPersonas 
  } = useModel();
  
  return { 
    personas, 
    selectedPersona, 
    setSelectedPersona, 
    selectedPersonaData, 
    isPersonasLoading, 
    personasError, 
    refreshPersonas 
  };
};