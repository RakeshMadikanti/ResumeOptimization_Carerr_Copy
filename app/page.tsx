"use client";

import { HowItWorks } from "@/components/HowItWorks";
import { Features } from "@/components/Features";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export default function Home() {
    return (
        <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

            {/* Header */}
            <header className="absolute top-0 w-full z-50 px-6 py-4 flex justify-between items-center">
                <div className="font-bold text-xl tracking-tight">AutoResume</div>
                <div>
                    <SignedOut>
                        <SignInButton mode="modal">
                            <button className="px-4 py-2 text-sm font-medium hover:text-primary transition-colors">Sign In</button>
                        </SignInButton>
                    </SignedOut>
                    <SignedIn>
                        <UserButton afterSignOutUrl="/" />
                    </SignedIn>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative pt-20 pb-32 flex flex-col items-center justify-center min-h-[90vh] text-center">
                {/* Background Gradients */}
                <div className="absolute top-0 left-1/2 w-[1000px] h-[400px] -translate-x-1/2 -translate-y-1/2 bg-primary/20 blur-[120px] rounded-full pointer-events-none opacity-50" />
                <div className="absolute bottom-0 right-0 w-[800px] h-[600px] translate-x-1/2 -translate-y-1/2 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none opacity-30" />

                <div className="container px-4 md:px-6 z-10 flex flex-col items-center gap-8">
                    <h1 className="text-5xl font-extrabold tracking-tight lg:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-500 leading-tight pb-2 max-w-4xl">
                        AutoResume
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                        Instantly tailor your resume to any job description.
                        <br className="hidden md:block" />
                        We preserve your exact <strong>DOCX formatting</strong> using advanced AI.
                    </p>
                    <div className="flex gap-4 justify-center pt-4">
                        <Link href="/app" className="px-8 py-3 rounded-full bg-white text-black font-semibold hover:bg-gray-100 transition">
                            Get Started
                        </Link>
                        <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="px-8 py-3 rounded-full border border-white/20 hover:bg-white/10 transition">
                            Learn More
                        </button>
                    </div>
                </div>
            </section>

            <div id="how-it-works">
                <HowItWorks />
            </div>

            <Features />

            <Footer />
        </div>
    )
}
