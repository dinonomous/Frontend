// Settings Panel
import { useModel } from "@/context/ModelContext";
import { Moon, Sun } from 'lucide-react';
import { ModelSelector } from "./ModelSelector";


import React from 'react'

export const SettingsPanel = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {

    const { theme, setTheme, toggleTheme, isDarkMode, model } = useModel();
  

  if (!isOpen) return null;

  return (
    <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-50">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Theme
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setTheme('light')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                theme === 'light' 
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Sun size={16} />
              Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                theme === 'dark' 
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Moon size={16} />
              Dark
            </button>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            AI Model
          </label>
          <div className="space-y-2">
            <ModelSelector />
          </div>
        </div>
      </div>
    </div>
  );
};
