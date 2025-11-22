"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  BarChart2,
  Settings,
  Heart,
  Zap,
  User,
  Cloud,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleGenerativeAI } from "@google/generative-ai";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

// --- Types ---

interface Profile {
  name: string;
  onboardingComplete: boolean;
  preferences: {
    goal: "Health Tracking" | "Planning" | "Symptom Management";
    checkInFrequency: "Morning" | "Evening" | "Both";
  };
  insights: Insight[];
}

interface Insight {
  pattern: string;
  confidence: number;
  learnedDate: string;
}

interface CycleLog {
  date: string;
  mood: string;
  symptoms: string[];
  flow: "Light" | "Medium" | "Heavy" | "Spotting" | null;
  note: string;
}

interface Message {
  id: string;
  sender: "user" | "nora";
  text: string;
  timestamp: number;
  type?: "text" | "log-confirmation";
  data?: any;
}

// --- Utils ---

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// --- Main Component ---

export default function LunaFlow() {
  // State
  const [profile, setProfile] = useState<Profile | null>(null);
  const [logs, setLogs] = useState<CycleLog[]>([]);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [view, setView] = useState<"chat" | "dashboard" | "profile">("chat");
  const [apiKey, setApiKey] = useState(""); // In a real app, use env var
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  useEffect(() => {
    // Load from localStorage
    const storedProfile = localStorage.getItem("luna_profile");
    const storedLogs = localStorage.getItem("luna_logs");
    const storedChat = localStorage.getItem("luna_chat");

    if (storedProfile) setProfile(JSON.parse(storedProfile));
    if (storedLogs) setLogs(JSON.parse(storedLogs));
    if (storedChat) setChatHistory(JSON.parse(storedChat));

    // Check for API Key in env (simulated)
    const envKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (envKey) {
      setApiKey(envKey);
    } else {
      // If no env key, we might need to ask user or use a demo mode
      // For now, let's assume we might need to ask for it if it's missing
      if (!localStorage.getItem("luna_api_key")) {
        setShowApiKeyInput(true);
      } else {
        setApiKey(localStorage.getItem("luna_api_key") || "");
      }
    }
  }, []);

  useEffect(() => {
    // Save to localStorage
    if (profile) localStorage.setItem("luna_profile", JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem("luna_logs", JSON.stringify(logs));
  }, [logs]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    localStorage.setItem("luna_chat", JSON.stringify(chatHistory));
    scrollToBottom();
  }, [chatHistory]);

  // --- Theme Logic ---
  const getTheme = () => {
    if (!logs.length) return "from-[#f5f3ff] via-[#faf5ff] to-[#f0fdf4]";
    const lastLog = logs[logs.length - 1];
    // Simple heuristic
    if (lastLog.symptoms.includes("Cramps") || lastLog.mood === "Pain")
      return "from-[#e0f2fe] via-[#f3e8ff] to-[#e0e7ff]";
    if (lastLog.mood === "Energetic" || lastLog.mood === "Happy")
      return "from-[#fff1f2] via-[#fff7ed] to-[#ecfccb]";
    if (lastLog.mood === "Sad" || lastLog.mood === "Irritable")
      return "from-[#fff1f2] via-[#fdf2f8] to-[#f5f3ff]";
    return "from-[#f5f3ff] via-[#faf5ff] to-[#f0fdf4]";
  };

  // --- Proactive Logic ---
  useEffect(() => {
    if (!profile) return;

    const checkIn = () => {
      const now = new Date();
      const lastCheckIn = localStorage.getItem("luna_last_checkin");
      const todayStr = now.toDateString();

      if (lastCheckIn !== todayStr && now.getHours() >= 9) {
        // Trigger Morning Check-in
        const msg: Message = {
          id: "daily-checkin-" + Date.now(),
          sender: "nora",
          text: `Good morning ${profile.name}! ☀️ Ready to log for today?`,
          timestamp: Date.now(),
        };
        setChatHistory((prev) => [...prev, msg]);
        localStorage.setItem("luna_last_checkin", todayStr);
      }
    };

    const timer = setInterval(checkIn, 60000); // Check every minute
    checkIn(); // Check on mount

    return () => clearInterval(timer);
  }, [profile]);

  // --- AI Logic ---

  const generateAIResponse = async (
    userInput: string,
    currentLogs: CycleLog[],
    userProfile: Profile
  ) => {
    if (!apiKey) {
      return {
        text: "I need a Gemini API key to work my magic! Please add it in settings.",
        extractedData: null,
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const systemPrompt = `
      You are Nora, an empathetic cycle assistant.
      User: ${userProfile.name} | Goal: ${userProfile.preferences.goal}
      Recent logs: ${JSON.stringify(currentLogs.slice(-3))}
      
      Your task is to:
      1. Analyze the user's input.
      2. Extract cycle data if present (mood, symptoms, flow).
      3. Generate a warm, empathetic response.
      
      Return a JSON object with this structure (do NOT use markdown formatting for the JSON):
      {
        "response": "Your text response here",
        "extracted_data": {
          "mood": "string or null",
          "symptoms": ["array of strings"],
          "flow": "Light/Medium/Heavy/Spotting or null",
          "emotional_note": "summary of feelings"
        }
      }
    `;

    try {
      const result = await model.generateContent([
        systemPrompt,
        `User said: "${userInput}"`,
      ]);
      const response = await result.response;
      const text = response.text();

      // Clean up markdown code blocks if present
      const cleanText = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      return JSON.parse(cleanText);
    } catch (error) {
      console.error("Gemini Error:", error);
      return {
        response:
          "I'm having a little trouble connecting to my brain right now. 💜 But I'm listening.",
        extractedData: null,
      };
    }
  };

  // --- Handlers ---

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: inputValue,
      timestamp: Date.now(),
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    // Simulate "thinking" time or actual API call
    if (profile) {
      const aiResult = await generateAIResponse(inputValue, logs, profile);

      setIsTyping(false);

      const hasData =
        aiResult.extracted_data &&
        (aiResult.extracted_data.mood ||
          aiResult.extracted_data.symptoms?.length > 0 ||
          aiResult.extracted_data.flow);

      const noraMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "nora",
        text: aiResult.response || aiResult.text, // Fallback if structure differs
        timestamp: Date.now(),
        type: hasData ? "log-confirmation" : "text",
        data: hasData ? aiResult.extracted_data : undefined,
      };
      setChatHistory((prev) => [...prev, noraMsg]);

      if (hasData) {
        const newLog: CycleLog = {
          date: new Date().toISOString(),
          mood: aiResult.extracted_data.mood || "Neutral",
          symptoms: aiResult.extracted_data.symptoms || [],
          flow: aiResult.extracted_data.flow || null,
          note: aiResult.extracted_data.emotional_note || "",
        };
        setLogs((prev) => [...prev, newLog]);

        // Add a confirmation "system" message or just let Nora say it
        // Nora's response should already cover it based on the prompt
      }
    } else {
      // Handle Onboarding via Chat
      handleOnboardingStep(inputValue);
    }
  };

  const handleOnboardingStep = (input: string) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      // Simple state machine for onboarding (could be improved)
      if (!profile) {
        // Initial state - creating profile
        const newProfile: Profile = {
          name: input,
          onboardingComplete: false,
          preferences: { goal: "Health Tracking", checkInFrequency: "Morning" },
          insights: [],
        };
        setProfile(newProfile);
        setChatHistory((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            sender: "nora",
            text: `Nice to meet you, ${input}! 🌙 What brings you here?`,
            timestamp: Date.now(),
          },
        ]);
        // In a real implementation, we'd ask for goal and frequency next
        // For this demo, we'll just mark complete after name for simplicity or add buttons
        setProfile((p) => (p ? { ...p, onboardingComplete: true } : null));
      }
    }, 1000);
  };

  // --- Render Helpers ---

  if (!profile && !chatHistory.length) {
    // Initial Onboarding Trigger
    return (
      <div className='min-h-screen bg-gradient-to-br from-[#f5f3ff] via-[#faf5ff] to-[#f0fdf4] flex items-center justify-center p-6'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className='bg-white/30 backdrop-blur-xl border border-white/40 p-10 rounded-3xl shadow-[0_20px_60px_rgba(31,38,135,0.15)] max-w-md w-full text-center'
        >
          <div className='w-20 h-20 bg-white/40 backdrop-blur-md rounded-full mx-auto mb-6 flex items-center justify-center text-3xl shadow-sm border border-white/50'>
            🌙
          </div>
          <h1 className='text-3xl font-light text-slate-700 mb-3 tracking-wide'>
            Hi, I&apos;m Nora
          </h1>
          <p className='text-slate-600 mb-8 leading-relaxed'>
            I&apos;m here to help you understand your cycle and yourself.
          </p>
          <button
            onClick={() => {
              setChatHistory([
                {
                  id: "init",
                  sender: "nora",
                  text: "Hi! I'm Nora 🌙 What should I call you?",
                  timestamp: Date.now(),
                },
              ]);
            }}
            className='px-8 py-4 bg-gradient-to-r from-purple-200/60 to-pink-200/60 backdrop-blur-xl border border-white/50 rounded-full text-slate-700 font-light shadow-[0_8px_32px_rgba(31,38,135,0.1)] hover:shadow-[0_12px_40px_rgba(31,38,135,0.15)] hover:scale-105 transition-all duration-500 active:scale-100'
          >
            Get Started
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-h-screen bg-gradient-to-br text-slate-700 font-sans relative overflow-hidden transition-colors duration-1000",
        getTheme()
      )}
    >
      {/* Background Elements */}
      <div className='fixed top-20 left-10 text-purple-100 opacity-30 animate-float pointer-events-none'>
        <Cloud className='w-32 h-32' strokeWidth={0.5} />
      </div>
      <div
        className='fixed bottom-20 right-10 text-emerald-50 opacity-40 animate-float pointer-events-none'
        style={{ animationDelay: "2s" }}
      >
        <Cloud className='w-48 h-48' strokeWidth={0.5} />
      </div>

      {/* Header */}
      <header className='fixed top-0 w-full bg-white/30 backdrop-blur-xl z-10 border-b border-white/40 shadow-[0_4px_30px_rgba(0,0,0,0.03)]'>
        <div className='max-w-md mx-auto px-6 h-20 flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 bg-white/40 backdrop-blur-md rounded-full flex items-center justify-center text-lg shadow-sm border border-white/50'>
              🌙
            </div>
            <span className='text-xl font-light tracking-wide text-slate-700'>
              LunaFlow
            </span>
          </div>
          <button
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            className='p-3 hover:bg-white/40 rounded-full transition-all duration-300 hover:scale-105 active:scale-95'
          >
            <Settings size={20} className='text-slate-500' strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* API Key Input Modal */}
      <AnimatePresence>
        {showApiKeyInput && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4'
          >
            <div className='bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm'>
              <h3 className='font-semibold mb-4'>Settings</h3>
              <label className='block text-sm text-gray-600 mb-2'>
                Gemini API Key
              </label>
              <input
                type='password'
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  localStorage.setItem("luna_api_key", e.target.value);
                }}
                className='w-full p-2 border rounded-lg mb-4 bg-gray-50'
                placeholder='Enter your API key'
              />
              <button
                onClick={() => setShowApiKeyInput(false)}
                className='w-full bg-gray-900 text-white py-2 rounded-lg'
              >
                Save & Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className='pt-24 pb-32 max-w-md mx-auto min-h-screen px-6'>
        {view === "chat" && (
          <div className='flex flex-col gap-6'>
            {chatHistory.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={cn(
                  "max-w-[85%] p-5 rounded-3xl shadow-sm text-base leading-relaxed font-light tracking-wide",
                  msg.sender === "user"
                    ? "self-end bg-gradient-to-r from-purple-100/60 to-pink-100/60 backdrop-blur-lg border border-white/40 shadow-[0_4px_16px_rgba(31,38,135,0.06)] text-slate-700 rounded-tr-sm"
                    : "self-start bg-white/40 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_rgba(31,38,135,0.08)] text-slate-700 rounded-tl-sm"
                )}
              >
                {msg.text}
                {msg.type === "log-confirmation" && msg.data && (
                  <div className='mt-4 flex flex-wrap gap-2'>
                    {msg.data.mood && (
                      <span className='px-4 py-2 bg-white/40 rounded-full text-xs font-medium text-purple-600 border border-white/50 shadow-sm'>
                        {msg.data.mood}
                      </span>
                    )}
                    {msg.data.symptoms?.map((s: string) => (
                      <span
                        key={s}
                        className='px-4 py-2 bg-white/40 rounded-full text-xs font-medium text-slate-600 border border-white/50 shadow-sm'
                      >
                        {s}
                      </span>
                    ))}
                    {msg.data.flow && (
                      <span className='px-4 py-2 bg-white/40 rounded-full text-xs font-medium text-rose-500 border border-white/50 shadow-sm'>
                        {msg.data.flow} Flow
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className='self-start bg-white/40 backdrop-blur-xl p-5 rounded-3xl rounded-tl-sm flex gap-2 shadow-[0_8px_32px_rgba(31,38,135,0.08)] border border-white/40'
              >
                <span
                  className='w-2 h-2 bg-purple-300 rounded-full animate-bounce'
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className='w-2 h-2 bg-purple-300 rounded-full animate-bounce'
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className='w-2 h-2 bg-purple-300 rounded-full animate-bounce'
                  style={{ animationDelay: "300ms" }}
                />
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {view === "dashboard" && (
          <div className='space-y-8 animate-fadeIn'>
            {/* Phase Card */}
            <div className='bg-white/30 backdrop-blur-xl border border-white/40 rounded-3xl p-8 shadow-[0_8px_32px_rgba(31,38,135,0.08)] hover:shadow-[0_12px_40px_rgba(31,38,135,0.12)] transition-all duration-500 hover:scale-[1.02]'>
              <div className='flex items-center gap-3 mb-4'>
                <div className='text-purple-300'>
                  <Sparkles className='w-6 h-6' strokeWidth={1.5} />
                </div>
                <h3 className='text-sm uppercase tracking-widest text-slate-500'>
                  Current Phase
                </h3>
              </div>
              <div className='text-3xl font-light text-slate-700 mb-2'>
                Follicular Phase
              </div>
              <p className='text-slate-600 leading-relaxed'>
                Creativity is high! Great time to brainstorm new ideas.
              </p>
            </div>

            {/* Insights */}
            <div className='bg-white/30 backdrop-blur-xl border border-white/40 rounded-3xl p-8 shadow-[0_8px_32px_rgba(31,38,135,0.08)] hover:shadow-[0_12px_40px_rgba(31,38,135,0.12)] transition-all duration-500'>
              <h3 className='text-xl font-light text-slate-700 mb-6 flex items-center gap-3'>
                <Zap size={20} className='text-amber-300' strokeWidth={1.5} />
                What I Know About You
              </h3>
              <ul className='space-y-4'>
                <li className='flex items-center gap-4 text-slate-600 bg-white/20 p-4 rounded-2xl border border-white/30'>
                  <span className='w-2 h-2 bg-emerald-300 rounded-full shadow-[0_0_10px_rgba(110,231,183,0.5)]' />
                  Energetic days 12-14 (92%)
                </li>
                <li className='flex items-center gap-4 text-slate-600 bg-white/20 p-4 rounded-2xl border border-white/30'>
                  <span className='w-2 h-2 bg-purple-300 rounded-full shadow-[0_0_10px_rgba(216,180,254,0.5)]' />
                  Cramps start day -1
                </li>
              </ul>
            </div>

            {/* Health Report */}
            <div className='bg-white/30 backdrop-blur-xl border border-white/40 rounded-3xl p-8 shadow-[0_8px_32px_rgba(31,38,135,0.08)]'>
              <h3 className='text-xl font-light text-slate-700 mb-4 flex items-center gap-3'>
                <Heart size={20} className='text-rose-300' strokeWidth={1.5} />
                Health Report
              </h3>
              <p className='text-slate-600 mb-6 leading-relaxed'>
                Based on your logs, here is a summary for your provider.
              </p>
              <button className='w-full py-4 bg-white/40 border border-white/50 rounded-2xl text-slate-600 hover:bg-white/60 transition-all duration-300 shadow-sm hover:shadow-md'>
                Generate PDF Summary
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Navigation & Input Area */}
      <div className='fixed bottom-0 w-full bg-white/40 backdrop-blur-xl border-t border-white/40 pb-safe z-20 shadow-[0_-4px_30px_rgba(0,0,0,0.03)]'>
        {view === "chat" && (
          <div className='max-w-md mx-auto p-6 pb-2 flex gap-3 items-center'>
            <input
              type='text'
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Tell Nora how you're feeling..."
              className='flex-1 bg-white/40 backdrop-blur-lg border border-white/50 rounded-2xl px-6 py-4 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-300/50 focus:bg-white/50 transition-all duration-300 shadow-inner'
            />
            <button
              onClick={handleSendMessage}
              className='p-4 bg-gradient-to-r from-purple-200/60 to-pink-200/60 backdrop-blur-xl border border-white/50 rounded-full text-slate-700 hover:shadow-[0_8px_20px_rgba(31,38,135,0.15)] hover:scale-105 transition-all duration-300 active:scale-95 shadow-[0_4px_16px_rgba(31,38,135,0.1)]'
            >
              <Send size={20} strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* Bottom Nav */}
        <div className='max-w-md mx-auto px-8 py-4 flex justify-between items-center text-slate-400'>
          <button
            onClick={() => setView("chat")}
            className={cn(
              "flex flex-col items-center gap-1 transition-all duration-300",
              view === "chat"
                ? "text-purple-400 scale-105"
                : "hover:text-slate-500"
            )}
          >
            <div
              className={cn(
                "p-2 rounded-2xl transition-all duration-500",
                view === "chat" && "bg-white/50 shadow-sm"
              )}
            >
              <Send
                size={22}
                strokeWidth={1.5}
                className={view === "chat" ? "fill-purple-100" : ""}
              />
            </div>
            <span className='text-[10px] font-medium tracking-wide'>Chat</span>
          </button>
          <button
            onClick={() => setView("dashboard")}
            className={cn(
              "flex flex-col items-center gap-1 transition-all duration-300",
              view === "dashboard"
                ? "text-purple-400 scale-105"
                : "hover:text-slate-500"
            )}
          >
            <div
              className={cn(
                "p-2 rounded-2xl transition-all duration-500",
                view === "dashboard" && "bg-white/50 shadow-sm"
              )}
            >
              <BarChart2
                size={22}
                strokeWidth={1.5}
                className={view === "dashboard" ? "fill-purple-100" : ""}
              />
            </div>
            <span className='text-[10px] font-medium tracking-wide'>
              Insights
            </span>
          </button>
          <button
            onClick={() => setView("profile")}
            className={cn(
              "flex flex-col items-center gap-1 transition-all duration-300",
              view === "profile"
                ? "text-purple-400 scale-105"
                : "hover:text-slate-500"
            )}
          >
            <div
              className={cn(
                "p-2 rounded-2xl transition-all duration-500",
                view === "profile" && "bg-white/50 shadow-sm"
              )}
            >
              <User
                size={22}
                strokeWidth={1.5}
                className={view === "profile" ? "fill-purple-100" : ""}
              />
            </div>
            <span className='text-[10px] font-medium tracking-wide'>
              Profile
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
