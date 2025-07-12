"use client";
import React, { useState } from 'react';
import {
  MessageSquare,
  Plus,
  ChevronLeft,
  ChevronRight,
  User,
  Code,
  Briefcase,
  GraduationCap,
  Stethoscope,
  Palette,
  Calculator,
  Settings,
  Loader2,
  ChevronDown
} from 'lucide-react';

const lucideIcons: Record<string, React.FC<{ className?: string }>> = {
  User,
  Code,
  Briefcase,
  GraduationCap,
  Stethoscope,
  Palette,
  Calculator,
  Settings,
  MessageSquare,
  Plus,
  ChevronLeft,
  ChevronRight,
};

import { useTheme, usePersona } from '@/context/ModelContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import SettingsPanel from './Settings';

interface ChatSidePanelProps {
  isExpanded: boolean;
  expand: () => void;
}

const ChatSidePanel: React.FC<ChatSidePanelProps> = ({ isExpanded, expand }) => {
  const { theme } = useTheme();
  const { 
    personas, 
    selectedPersona, 
    setSelectedPersona, 
    selectedPersonaData, 
    isPersonasLoading, 
    personasError, 
    refreshPersonas 
  } = usePersona();
  
  const [showSettings, setShowSettings] = useState(false);

  const chatHistory = [
    { id: 1, title: 'React Component Help', timestamp: '2 hours ago', preview: 'How to create a custom hook...' },
    { id: 2, title: 'API Integration', timestamp: '1 day ago', preview: 'Best practices for REST API...' },
    { id: 3, title: 'Database Design', timestamp: '2 days ago', preview: 'Normalization strategies...' },
    { id: 4, title: 'UI/UX Discussion', timestamp: '3 days ago', preview: 'Color theory and accessibility...' },
    { id: 5, title: 'Performance Optimization', timestamp: '1 week ago', preview: 'React rendering optimization...' },
    { id: 6, title: 'Testing Strategies', timestamp: '1 week ago', preview: 'Unit vs integration testing...' },
  ];

  return (
    <div className={`${isExpanded ? 'w-80' : 'w-16'} fixed top-0 bottom-0 z-20 h-screen dark:bg-neutral-900 dark:text-neutral-50 dark dark:border-neutral-800 bg-gray-50 border-r flex flex-col transition-all duration-300 ease-in-out`}>
      {/* Header */}
      <div className="p-4 flex items-center justify-between dark:text-neutral-50">
        {isExpanded && (
          <h2 className="text-lg font-semibold text-gray-800 dark:text-neutral-50">Chat History</h2>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { expand() }}
          className="p-2 hover:bg-gray-200"
        >
          {isExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      {/* New Chat Button */}
      <div className="p-4">
        <Button
          className="dark:text-neutral-50 w-full flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          size={isExpanded ? "default" : "sm"}
        >
          <Plus className="h-4 w-4" />
          {isExpanded && "New Chat"}
        </Button>
      </div>

      {/* Persona Selector */}
      {isExpanded && (
        <div className="px-4 pb-4 dark:text-neutral-50">
          <label className="text-sm font-medium text-gray-700 mb-2 block dark:text-neutral-50">
            Persona
          </label>
          
          {/* Loading State */}
          {isPersonasLoading && (
            <div className="flex items-center gap-2 p-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading personas...
            </div>
          )}

          {/* Error State */}
          {personasError && (
            <Alert className="mb-2">
              <AlertDescription className="text-sm">
                Failed to load personas. 
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={refreshPersonas}
                  className="p-0 h-auto ml-1"
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Persona Dropdown */}
          {!isPersonasLoading && !personasError && personas.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-50"
                >
                  <div className="flex items-center gap-2">
                    {selectedPersonaData && (
                      <>
                        {lucideIcons[selectedPersonaData.icon] && React.createElement(lucideIcons[selectedPersonaData.icon], { className: "h-4 w-4" })}
                        <span className="dark:text-neutral-50">{selectedPersonaData.label}</span>
                      </>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                className="w-72 dark:bg-neutral-800 dark:border-neutral-700"
                align="start"
              >
                <DropdownMenuLabel className="dark:text-neutral-50">
                  Choose a Persona
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="dark:bg-neutral-700" />
                {personas.map((persona) => {
                  const Icon = lucideIcons[persona.icon];
                  return (
                    <DropdownMenuItem
                      key={persona.value}
                      onClick={() => setSelectedPersona(persona.value)}
                      className="cursor-pointer dark:text-neutral-50 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
                    >
                      <div className="flex items-center gap-2">
                        {Icon && <Icon className="h-4 w-4" />}
                        <div className="flex flex-col">
                          <span className="font-medium">{persona.label}</span>
                          <span className="text-xs text-gray-500 dark:text-neutral-400">
                            {persona.value}
                          </span>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* Chat History */}
      <div className="flex-1 overflow-hidden">
        {isExpanded ? (
          <ScrollArea className="h-full px-4">
            <div className="space-y-2">
              {chatHistory.map((chat) => (
                <div
                  key={chat.id}
                  className="p-3 rounded-lg hover:bg-gray-100 hover:dark:bg-neutral-800 cursor-pointer transition-colors duration-200 border border-transparent hover:border-gray-200"
                >
                  <div className="flex items-start gap-3">
                    <MessageSquare className="h-4 w-4 text-gray-500 mt-1 flex-shrink-0 dark:text-neutral-50" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-800 truncate dark:text-neutral-50">
                        {chat.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {chat.preview}
                      </p>
                      <span className="text-xs text-gray-400 mt-2 block">
                        {chat.timestamp}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <></>
        )}
      </div>

      {/* Settings/Profile (collapsed state) */}
      {!isExpanded && (
        <div className="p-4">
          <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
          {/* <Button
            variant="ghost"
            size="sm"
            className="w-10 h-10 p-0 hover:bg-gray-200"
            title="Settings"
          >
            <Settings className="h-4 w-4 text-gray-600" />
          </Button> */}
        </div>
      )}
    </div>
  );
};

export default ChatSidePanel;