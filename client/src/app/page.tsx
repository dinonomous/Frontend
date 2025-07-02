"use client";
import Image from "next/image";
import { useState } from "react";
import { ModelProvider } from '@/context/ModelContext';
import { ModelSelector } from '@/components/ModelSelector';
import { ChatInput } from '@/components/ChatInput';
import ChatBot from "@/pages/Chat";

export default function Home() {

  return (
    <ModelProvider>
      <div className="">
        
      </div>
    </ModelProvider>
  );
}