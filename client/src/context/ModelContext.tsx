"use client";
import React, { createContext, useContext, useState, useCallback } from 'react';
import { LocalModel } from '../api/ollama';

type ModelContextType = {
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
};

const ModelContext = createContext<ModelContextType | null>(null);

export const ModelProvider = ({ children }: { children: React.ReactNode }) => {
  const [model, setModel] = useState('');
  const [currentModelData, setCurrentModelData] = useState<LocalModel | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [loadedModels, setLoadedModels] = useState<Set<string>>(new Set());

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

  return (
    <ModelContext.Provider value={{ 
      model, 
      setModel: handleSetModel,
      currentModelData,
      setCurrentModelData,
      isModelLoaded,
      setIsModelLoaded,
      loadedModels,
      addLoadedModel,
      removeLoadedModel,
      clearLoadedModels
    }}>
      {children}
    </ModelContext.Provider>
  );
};

export const useModel = () => {
  const context = useContext(ModelContext);
  if (!context) throw new Error('useModel must be used within ModelProvider');
  return context;
};