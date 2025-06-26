"use client";
import { useModel } from '@/context/ModelContext';
import { listModels, loadModel, unloadModel, LocalModel } from '../api/ollama';
import { useEffect, useState } from 'react';

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

  const formatModelInfo = (modelData: LocalModel): string => {
    const size = formatModelSize(modelData.size);
    const params = modelData.details.parameter_size;
    return `${modelData.name} (${params}, ${size})`;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500">Model:</label>
        <div className="bg-transparent border border-gray-300 rounded px-2 py-1 text-sm animate-pulse">
          Loading models...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500">Model:</label>
        <div className="bg-transparent border border-red-300 rounded px-2 py-1 text-sm text-red-600">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500">Model:</label>
        <div className="relative">
          <select
            value={model}
            onChange={(e) => handleModelChange(e.target.value)}
            disabled={!!loadingModel}
            className={`
              bg-transparent border border-gray-300 rounded px-2 py-1 text-sm
              min-w-[200px] pr-8
              ${loadingModel ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400'}
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            `}
          >
            {availableModels.map((m) => (
              <option key={m.digest} value={m.name}>
                {formatModelInfo(m)}
              </option>
            ))}
          </select>
          {loadingModel && (
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            </div>
          )}
        </div>
      </div>
      
      {/* Model status indicator */}
      <div className="flex items-center gap-2 text-xs">
        <div className={`w-2 h-2 rounded-full ${loadingModel ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
        <span className="text-gray-400">
          {loadingModel ? `Loading ${loadingModel}...` : `Active: ${model}`}
        </span>
      </div>
    </div>
  );
};