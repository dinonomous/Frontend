"use client";
import Image from "next/image";
import { useState } from "react";
import { ModelProvider } from '@/context/ModelContext';
import { ModelSelector } from '@/components/ModelSelector';
import { ChatInput } from '@/components/ChatInput';
import ChatBot from "@/pages/Chat";
import Navbar from "@/components/navbar";

export default function Home() {
  return (
    <ModelProvider>
      <div className="">
        <Navbar />
      </div>
    </ModelProvider>
  );
}