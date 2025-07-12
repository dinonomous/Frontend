"use client";
import { useModel } from '@/context/ModelContext';
import { listModels, loadModel, unloadModel, LocalModel } from '../api/ollama';
import { useEffect, useState } from 'react';
import { ChevronDown, Loader2, Circle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';

export const ModelSelector = () => {
  const { model, setModel } = useModel();
  const [availableModels, setAvailableModels] = useState<LocalModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingModel, setLoadingModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch available models on component mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await listModels();
        setAvailableModels(response.models);
        
        // Set default model if none selected and models are available
        if (!model && response.models.length > 0) {
          setModel(response.models[0].name);
        }
      } catch (err) {
        setError('Failed to fetch models');
        console.error('Error fetching models:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, [model, setModel]);

  const handleModelChange = async (selectedModel: string) => {
    if (selectedModel === model) return;

    try {
      setLoadingModel(selectedModel);
      setError(null);

      // Unload current model if one is loaded
      if (model) {
        await unloadModel(model);
      }

      // Load new model
      await loadModel(selectedModel);
      setModel(selectedModel);
    } catch (err) {
      setError(`Failed to load model: ${selectedModel}`);
      console.error('Error loading model:', err);
    } finally {
      setLoadingModel(null);
    }
  };

  const formatModelSize = (size: number): string => {
    const gb = size / (1024 * 1024 * 1024);
    return gb > 1 ? `${gb.toFixed(1)}GB` : `${(size / (1024 * 1024)).toFixed(0)}MB`;
  };

  const getSelectedModelInfo = (): LocalModel | null => {
    return availableModels.find(m => m.name === model) || null;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500 dark:text-neutral-400">Model:</label>
        <div className="bg-transparent border border-gray-300 dark:border-neutral-600 rounded px-2 py-1 text-sm animate-pulse">
          Loading models...
        </div>
      </div>
    );
  }

  const selectedModelInfo = getSelectedModelInfo();

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500 dark:text-neutral-400">Model:</label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="min-w-[200px] justify-between dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-50"
              disabled={!!loadingModel}
            >
              <div className="flex items-center gap-2 truncate">
                {loadingModel && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                <span className="truncate">
                  {selectedModelInfo 
                    ? `${selectedModelInfo.name} (${selectedModelInfo.details.parameter_size})`
                    : model || 'Select Model'
                  }
                </span>
              </div>
              <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            className="w-80 dark:bg-neutral-800 dark:border-neutral-700 max-h-60 overflow-y-auto"
            align="start"
          >
            <DropdownMenuLabel className="dark:text-neutral-50">
              Available Models
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="dark:bg-neutral-700" />
            
            {availableModels.map((m) => (
              <DropdownMenuItem
                key={m.digest}
                onClick={() => handleModelChange(m.name)}
                className="cursor-pointer dark:text-neutral-50 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
                disabled={loadingModel === m.name}
              >
                <div className="flex items-center gap-2 w-full">
                  <div className="flex items-center gap-2 flex-1">
                    {loadingModel === m.name ? (
                      <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                    ) : (
                      <Circle 
                        className={`h-3 w-3 ${
                          m.name === model 
                            ? 'text-green-500 fill-current' 
                            : 'text-gray-400'
                        }`} 
                      />
                    )}
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-medium truncate">{m.name}</span>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-400">
                        <span>{m.details.parameter_size}</span>
                        <span>•</span>
                        <span>{formatModelSize(m.size)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
            
            {availableModels.length === 0 && (
              <DropdownMenuItem disabled>
                <span className="text-gray-500 dark:text-neutral-400">
                  No models available
                </span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Model status indicator */}
      <div className="flex items-center gap-2 text-xs">
        <div className={`w-2 h-2 rounded-full ${
          loadingModel ? 'bg-yellow-500' : 'bg-green-500'
        }`}></div>
        <span className="text-gray-400 dark:text-neutral-400">
          {loadingModel ? `Loading ${loadingModel}...` : `Active: ${model}`}
        </span>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="text-xs text-red-500 dark:text-red-400 mt-1">
          {error}
        </div>
      )}
    </div>
  );
};