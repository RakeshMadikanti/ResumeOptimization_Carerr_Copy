"use client";

import { useState, useEffect } from "react";
import { Upload, FileText, Sparkles, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ResumeForm() {
    const [file, setFile] = useState<File | null>(null);
    const [jd, setJd] = useState("");
    const [prompt, setPrompt] = useState("");
    const [savedPrompts, setSavedPrompts] = useState<string[]>([]);
    const [provider, setProvider] = useState<"gemini" | "openai">("openai");
    const [model, setModel] = useState("gpt-4o");
    const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "completed" | "error">("idle");
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

    // Load saved prompts on mount
    useEffect(() => {
        const saved = localStorage.getItem("savedPrompts");
        if (saved) {
            setSavedPrompts(JSON.parse(saved));
        }
    }, []);

    const savePrompt = () => {
        if (!prompt.trim()) return;
        if (savedPrompts.includes(prompt.trim())) return;
        const newPrompts = [...savedPrompts, prompt.trim()];
        setSavedPrompts(newPrompts);
        localStorage.setItem("savedPrompts", JSON.stringify(newPrompts));
    };

    const deletePrompt = (promptToDelete: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newPrompts = savedPrompts.filter(p => p !== promptToDelete);
        setSavedPrompts(newPrompts);
        localStorage.setItem("savedPrompts", JSON.stringify(newPrompts));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !jd) return;

        setStatus("uploading");

        const formData = new FormData();
        formData.append("resume", file);
        formData.append("jd", jd);
        formData.append("prompt", prompt || "Highlight experience relevant to the job requirements."); // Fallback for backend if empty
        formData.append("provider", provider);
        formData.append("model", model);

        try {
            setStatus("processing");
            const res = await fetch("/api/optimize", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) throw new Error("Optimization failed");

            // Handle file blob response
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            setDownloadUrl(url);
            setStatus("completed");
        } catch (error) {
            console.error(error);
            setStatus("error");
        }
    };

    return (
        <div className="w-full max-w-2xl bg-card border border-border/50 rounded-xl shadow-2xl overflow-hidden backdrop-blur-sm">
            <div className="p-8 space-y-6">

                {/* File Upload */}
                <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Upload Original Resume (DOCX)
                    </label>
                    <div className={cn(
                        "border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center hover:bg-muted/50 transition cursor-pointer relative",
                        file && "border-primary/50 bg-primary/5"
                    )}>
                        <input
                            type="file"
                            accept=".docx"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                        />
                        <div className="flex flex-col items-center gap-2">
                            {file ? (
                                <>
                                    <FileText className="h-10 w-10 text-primary" />
                                    <p className="font-medium text-foreground">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                                </>
                            ) : (
                                <>
                                    <Upload className="h-10 w-10 text-muted-foreground" />
                                    <p className="font-medium text-muted-foreground">Drag & drop or click to upload</p>
                                    <p className="text-xs text-muted-foreground">Supports .docx only</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Job Description */}
                <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">
                        Job Description
                    </label>
                    <textarea
                        className="flex min-h-[150px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                        placeholder="Paste the job description here..."
                        value={jd}
                        onChange={(e) => setJd(e.target.value)}
                    />
                </div>

                {/* Custom Prompt */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium leading-none">
                            Custom Instructions (Optional)
                        </label>
                        <button
                            onClick={savePrompt}
                            type="button"
                            disabled={!prompt}
                            className="text-xs text-primary hover:underline font-medium disabled:opacity-50 disabled:no-underline"
                        >
                            + Save to Favorites
                        </button>
                    </div>
                    <input
                        className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="e.g. Focus on leadership skills..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                    />

                    {/* Saved Prompts */}
                    {savedPrompts.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            {savedPrompts.map((p, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => setPrompt(p)}
                                    className="group flex items-center gap-2 bg-secondary/50 hover:bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-xs cursor-pointer transition-colors max-w-full"
                                >
                                    <span className="truncate max-w-[200px]">{p}</span>
                                    <button
                                        onClick={(e) => deletePrompt(p, e)}
                                        className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* AI Settings */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none">AI Provider</label>
                        <select
                            value={provider}
                            onChange={(e) => {
                                const p = e.target.value as "gemini" | "openai";
                                setProvider(p);
                                setModel(p === "gemini" ? "gemini-1.5-flash" : "gpt-4o");
                            }}
                            className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <option value="openai">OpenAI (ChatGPT)</option>
                            <option value="gemini">Google Gemini</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none">Model</label>
                        <select
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {provider === "openai" ? (
                                <>
                                    <option value="gpt-4o">GPT-4o (Best)</option>
                                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fast)</option>
                                </>
                            ) : (
                                <>
                                    <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast)</option>
                                    <option value="gemini-1.5-pro">Gemini 1.5 Pro (Powerful)</option>
                                </>
                            )}
                        </select>
                    </div>
                </div>

                {/* Action Button */}
                <button
                    onClick={handleSubmit}
                    disabled={!file || !jd || status === "processing" || status === "uploading"}
                    className={cn(
                        "w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-11 px-8",
                        status === "completed" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                >
                    {status === "processing" || status === "uploading" ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                        </>
                    ) : status === "completed" ? (
                        <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Completed!
                        </>
                    ) : (
                        <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Optimize Resume
                        </>
                    )}
                </button>

                {/* Download Section */}
                {status === "completed" && downloadUrl && (
                    <div className="pt-4 animate-in fade-in slide-in-from-top-4">
                        <a
                            href={downloadUrl}
                            download={`optimized_${file?.name}`}
                            className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-11 px-8 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Download Optimized Resume
                        </a>
                    </div>
                )}

            </div>
        </div>
    );
}
