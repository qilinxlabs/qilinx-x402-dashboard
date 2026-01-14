"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PromoCanvas } from "@/components/landing/promo-canvas";
import { 
  Bot, 
  Wallet, 
  FileCode, 
  Blocks, 
  MessageSquare, 
  Zap,
  ArrowRight,
  Shield,
  Star,
  Moon,
  Sun,
} from "lucide-react";
import { SiGithub } from "@icons-pack/react-simple-icons";

const rotatingTexts = [
  { text: "Pay", color: "text-green-500" },
  { text: "Build", color: "text-blue-500" },
  { text: "Test", color: "text-purple-500" },
];

const features = [
  {
    icon: Bot,
    title: "AI-Powered Chat",
    description: "Interact with AI assistant to manage x402 payments and smart contracts in natural language.",
  },
  {
    icon: Wallet,
    title: "Developer Account",
    description: "Manage your Cronos developer account and API credentials for contract deployment",
  },
  {
    icon: FileCode,
    title: "x402 Smart Contracts",
    description: "AI-assisted x402 settlement contract creation, compilation and deployment on Cronos testnet",
  },
  {
    icon: Blocks,
    title: "x402 DApps Builder",
    description: "Build and publish x402 payment DApps with NFT minting, reward points, and split payments",
  },
  {
    icon: Shield,
    title: "Payment Management",
    description: "Send x402 payments with USDC on Cronos testnet using EIP-3009 authorization",
  },
];

export function LandingPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % rotatingTexts.length);
        setIsAnimating(false);
      }, 300);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="h-6 w-6 text-primary" />
              <span className="font-bold text-xl">Qilin x402</span>
              <Badge variant="secondary" className="ml-2">Beta</Badge>
            </div>
            <div className="flex items-center gap-4">
              <a 
                href="https://bo0.gitbook.io/qilinx-x402/" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button variant="ghost">Docs</Button>
              </a>
              {mounted && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {theme === "dark" ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                </Button>
              )}
              <Link href="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/register">
                <Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6">
            <span className="text-foreground block">Autonomous Agents for</span>
            <span className="block mt-2">
              <span 
                className={`inline-block transition-all duration-500 ${
                  isAnimating 
                    ? "opacity-0 translate-y-4" 
                    : "opacity-100 translate-y-0"
                } ${rotatingTexts[currentIndex].color} font-extrabold`}
              >
                {rotatingTexts[currentIndex].text}
              </span>
              <span className="text-primary"> x402 protocol</span>
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Agentic platform for x402 dapps on Cronos EVM
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0">
                Start Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Sign In
              </Button>
            </Link>
          </div>
          
          {/* Promo Canvas */}
          <div className="max-w-4xl mx-auto">
            <PromoCanvas />
          </div>

          {/* Documentation CTA */}
          <div className="mt-12 flex flex-col items-center gap-4">
            <p className="text-lg text-muted-foreground">New to Qilinx? Learn how to get started</p>
            <a 
              href="https://bo0.gitbook.io/qilinx-x402/" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Button size="lg" variant="outline" className="border-2 border-primary hover:bg-primary hover:text-primary-foreground">
                📖 Read the User Documentation
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">An AI-Powered x402 Payment Platform</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From AI-assisted smart contract development to one-click DApp deployment, Qilinx provides all the tools 
              you need to build and deploy x402 payment solutions on Cronos.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="border-2 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              <span className="font-semibold">Qilin x402</span>
              <span className="text-muted-foreground text-sm">© 2025</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/login" className="hover:text-foreground transition-colors">
                Sign In
              </Link>
              <Link href="/register" className="hover:text-foreground transition-colors">
                Register
              </Link>
              <a 
                href="https://github.com/0xbohu/qilinx-cronos-app/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors flex items-center gap-1"
              >
                <SiGithub className="h-4 w-4" />
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
