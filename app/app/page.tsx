"use client";

import { ResumeForm } from "@/components/ResumeForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

export default function AppPage() {
    return (
        <div className="min-h-screen bg-background text-foreground relative overflow-hidden flex flex-col items-center py-4 px-4">
            {/* Background Gradients */}
            <div className="absolute top-0 left-1/2 w-[1000px] h-[400px] -translate-x-1/2 -translate-y-1/2 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />

            {/* Header / Nav Back */}
            <div className="w-full max-w-5xl z-10 mb-4 flex items-center justify-between">
                <Link href="/" className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Home
                </Link>
                <h1 className="text-xl font-bold tracking-tight">AutoResume Builder</h1>
                <div className="flex items-center gap-4">
                    <UserButton afterSignOutUrl="/" />
                </div>
            </div>

            <div className="w-full max-w-6xl z-10">
                <div className="text-center mb-4 space-y-1">
                    <h2 className="text-3xl font-extrabold tracking-tight lg:text-4xl">
                        Optimize Your Resume
                    </h2>
                    <p className="text-muted-foreground">
                        Upload your DOCX, paste the JD, and let our AI do the rest.
                    </p>
                </div>

                <div className="flex justify-center">
                    <ResumeForm />
                </div>
            </div>
        </div>
    );
}
