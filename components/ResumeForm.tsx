"use client";

import { useState, useEffect } from "react";
import { Upload, FileText, Sparkles, Loader2, Trash2, Save, AlertCircle, CheckCircle2, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveResumeToDB, getResumesFromDB, deleteResumeFromDB, SavedResume } from "@/lib/db";
import { useAuth } from "@clerk/nextjs";

interface SavedPrompt {
    name: string;
    content: string;
}

export function ResumeForm() {
    const { userId, isLoaded } = useAuth();

    const [file, setFile] = useState<File | null>(null);
    const [prompt, setPrompt] = useState("");
    const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);

    // Mode: basic or pro
    const [mode, setMode] = useState<"basic" | "pro">("basic");

    // Job Descriptions
    interface JobDescription {
        id: string;
        companyRole: string;
        description: string;
    }
    const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([
        { id: crypto.randomUUID(), companyRole: "", description: "" }
    ]);

    // Resume Caching State
    const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);

    // Prompt Saving UI State
    const [isSavingPrompt, setIsSavingPrompt] = useState(false);
    const [newPromptName, setNewPromptName] = useState("");

    const [model, setModel] = useState("gpt-5.2");
    const [processingJdId, setProcessingJdId] = useState<Set<string>>(new Set());

    // Per-JD status messages (success or error)
    const [jdMessages, setJdMessages] = useState<Record<string, { type: "success" | "error"; text: string }>>({});

    // Load saved prompts & resumes on mount
    useEffect(() => {
        if (!isLoaded || !userId) return;

        const saved = localStorage.getItem(`savedPrompts_${userId}`);
        if (saved) {
            setSavedPrompts(JSON.parse(saved));
        } else {
            setSavedPrompts([]);
        }

        loadResumes(userId);
    }, [isLoaded, userId]);

    const loadResumes = async (uid: string) => {
        try {
            const list = await getResumesFromDB(uid);
            setSavedResumes(list);
        } catch (e) {
            console.error("Failed to load resumes", e);
        }
    };

    const handleFileChange = async (newFile: File | null) => {
        setFile(newFile);
        if (newFile && userId) {
            try {
                await saveResumeToDB(newFile, userId);
                loadResumes(userId);
            } catch (e) {
                console.error("Failed to save resume", e);
            }
        }
    };

    const selectResume = (r: SavedResume) => {
        setFile(r.file);
    };

    const deleteResume = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!userId) return;
        await deleteResumeFromDB(id);
        loadResumes(userId);
        if (file && savedResumes.find(r => r.id === id)?.file.name === file.name) {
            setFile(null);
        }
    };

    const savePrompt = () => {
        if (!prompt.trim() || !newPromptName.trim() || !userId) return;

        const newEntry: SavedPrompt = { name: newPromptName.trim(), content: prompt.trim() };
        const newPrompts = [...savedPrompts, newEntry];

        setSavedPrompts(newPrompts);
        localStorage.setItem(`savedPrompts_${userId}`, JSON.stringify(newPrompts));

        setIsSavingPrompt(false);
        setNewPromptName("");
    };

    const deletePrompt = (idx: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!userId) return;
        const newPrompts = savedPrompts.filter((_, i) => i !== idx);
        setSavedPrompts(newPrompts);
        localStorage.setItem(`savedPrompts_${userId}`, JSON.stringify(newPrompts));
    };

    // Job Description Management
    const addJobDescription = () => {
        if (jobDescriptions.length < 3) {
            setJobDescriptions([...jobDescriptions, { id: crypto.randomUUID(), companyRole: "", description: "" }]);
        }
    };

    const removeJobDescription = (id: string) => {
        if (jobDescriptions.length > 1) {
            setJobDescriptions(jobDescriptions.filter(jd => jd.id !== id));
            setJdMessages(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
        }
    };

    const updateJobDescription = (id: string, field: "companyRole" | "description", value: string) => {
        setJobDescriptions(jobDescriptions.map(jd =>
            jd.id === id ? { ...jd, [field]: value } : jd
        ));
        if (jdMessages[id]) {
            setJdMessages(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
        }
    };

    // Handle individual JD optimization — downloads DOCX directly
    const handleOptimizeSingle = async (jd: JobDescription) => {
        if (!file || !jd.description.trim()) return;

        // In Pro mode, prompt is required
        if (mode === "pro" && !prompt.trim()) {
            setJdMessages(prev => ({
                ...prev,
                [jd.id]: { type: "error", text: "Pro mode requires prompt instructions" }
            }));
            return;
        }

        setProcessingJdId(prev => new Set(prev).add(jd.id));
        setJdMessages(prev => {
            const next = { ...prev };
            delete next[jd.id];
            return next;
        });

        const formData = new FormData();
        formData.append("resume", file);
        formData.append("jd", jd.description);
        formData.append("name", jd.companyRole.trim() || "Optimized_Resume");
        formData.append("prompt", prompt || "Highlight experience relevant to the job requirements.");
        formData.append("provider", "openai");
        formData.append("model", model);
        formData.append("mode", mode);

        try {
            const response = await fetch("/api/optimize-single", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Optimization failed');
            }

            const blob = await response.blob();
            const fileName = jd.companyRole.trim() || "Optimized_Resume";
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${fileName}.docx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            setJdMessages(prev => ({
                ...prev,
                [jd.id]: { type: "success", text: `✓ Downloaded ${fileName}.docx` }
            }));
        } catch (error: any) {
            console.error(error);
            setJdMessages(prev => ({
                ...prev,
                [jd.id]: { type: "error", text: error.message || "Error optimizing resume" }
            }));
        } finally {
            setProcessingJdId(prev => {
                const newSet = new Set(prev);
                newSet.delete(jd.id);
                return newSet;
            });
        }
    };

    const isPro = mode === "pro";

    return (
        <div className="w-full max-w-2xl bg-card border border-border/50 rounded-xl shadow-2xl overflow-hidden backdrop-blur-sm">
            <div className="p-8 space-y-6">

                {/* Mode Toggle */}
                <div className="flex items-center justify-center gap-1 p-1 bg-secondary/30 rounded-lg border border-border/50">
                    <button
                        type="button"
                        onClick={() => setMode("basic")}
                        className={cn(
                            "flex-1 py-2.5 px-4 rounded-md text-sm font-semibold transition-all duration-200",
                            !isPro
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Basic
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode("pro")}
                        className={cn(
                            "flex-1 py-2.5 px-4 rounded-md text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2",
                            isPro
                                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm shadow-purple-500/25"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Crown className="w-4 h-4" />
                        Pro
                    </button>
                </div>

                {/* Pro Mode Description */}
                {isPro && (
                    <div className="text-xs text-muted-foreground bg-purple-500/5 border border-purple-500/20 rounded-lg px-4 py-3 animate-in fade-in slide-in-from-top-1">
                        <span className="font-semibold text-purple-400">Pro Mode</span> — Your prompt is sent directly to ChatGPT with zero app modifications. You have full control over the instructions.
                    </div>
                )}

                {/* File Upload */}
                <div className="space-y-4">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Upload Original Resume (DOCX)
                    </label>
                    <div className={cn(
                        "border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:bg-muted/50 transition cursor-pointer relative",
                        file && "border-primary/50 bg-primary/5"
                    )}>
                        <input
                            type="file"
                            accept=".docx"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
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
                                    <p className="text-xs text-muted-foreground">Supports .docx only (max 10MB)</p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Recent Resumes List */}
                    {savedResumes.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Resumes</p>
                            <div className="flex flex-wrap gap-2">
                                {savedResumes.slice(0, 3).map((r) => (
                                    <div
                                        key={r.id}
                                        onClick={() => selectResume(r)}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-2 rounded-md border text-sm cursor-pointer transition-all hover:bg-accent group",
                                            file?.name === r.name ? "bg-accent border-primary/50" : "bg-background border-border"
                                        )}
                                    >
                                        <FileText className="w-3 h-3 text-muted-foreground" />
                                        <span className="truncate max-w-[120px]">{r.name}</span>
                                        <button
                                            onClick={(e) => deleteResume(r.id, e)}
                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Prompt Instructions — changes based on mode */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium leading-none flex items-center gap-2">
                            {isPro ? (
                                <>
                                    <span>Prompt Instructions</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">Required</span>
                                </>
                            ) : (
                                "Custom Instructions (Optional)"
                            )}
                        </label>
                        {!isSavingPrompt ? (
                            <button
                                onClick={() => setIsSavingPrompt(true)}
                                type="button"
                                disabled={!prompt}
                                className="text-xs text-primary hover:underline font-medium disabled:opacity-50 disabled:no-underline flex items-center gap-1"
                            >
                                <Save className="w-3 h-3" />
                                Save to Favorites
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                                <input
                                    autoFocus
                                    className="h-6 w-32 rounded border border-input bg-background px-2 text-xs"
                                    placeholder="Name (e.g. Sales)"
                                    value={newPromptName}
                                    onChange={(e) => setNewPromptName(e.target.value)}
                                />
                                <button
                                    onClick={savePrompt}
                                    type="button"
                                    disabled={!newPromptName}
                                    className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:opacity-90 disabled:opacity-50"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => setIsSavingPrompt(false)}
                                    type="button"
                                    className="text-xs text-muted-foreground hover:text-foreground"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>

                    {isPro ? (
                        <textarea
                            className={cn(
                                "flex min-h-[140px] w-full rounded-md border bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y",
                                isPro ? "border-purple-500/30" : "border-input"
                            )}
                            placeholder="Enter your full prompt instructions for ChatGPT. Your prompt will be sent directly — the app adds no modifications.&#10;&#10;Example: You are a resume expert. Rewrite the professional summary and experience bullet points to align with the given JD..."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                        />
                    ) : (
                        <input
                            className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="e.g. Focus on leadership skills..."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                        />
                    )}

                    {/* Saved Prompts Chips */}
                    {savedPrompts.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            {savedPrompts.map((p, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => setPrompt(p.content)}
                                    title={p.content}
                                    className="group flex items-center gap-2 bg-secondary/50 hover:bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full text-xs cursor-pointer transition-colors max-w-full border border-transparent hover:border-primary/20"
                                >
                                    <Sparkles className="w-3 h-3 text-primary" />
                                    <span className="font-medium truncate max-w-[150px]">{p.name}</span>
                                    <button
                                        onClick={(e) => deletePrompt(idx, e)}
                                        className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Job Descriptions */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium leading-none">
                            Job Descriptions ({jobDescriptions.length}/3)
                        </label>
                        {jobDescriptions.length < 3 && (
                            <button
                                type="button"
                                onClick={addJobDescription}
                                className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
                            >
                                + Add Another JD
                            </button>
                        )}
                    </div>

                    {jobDescriptions.map((jd, index) => (
                        <div key={jd.id} className="space-y-2 p-4 border border-border/50 rounded-lg bg-secondary/10">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    JD #{index + 1}
                                </span>
                                {jobDescriptions.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeJobDescription(jd.id)}
                                        className="h-6 w-6 rounded-full hover:bg-destructive/10 flex items-center justify-center text-destructive hover:text-destructive transition-colors"
                                        title="Remove this job description"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </button>
                                )}
                            </div>

                            <input
                                className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                placeholder="Company/Role (e.g., Google_SWE, Meta_Backend)"
                                value={jd.companyRole}
                                onChange={(e) => updateJobDescription(jd.id, "companyRole", e.target.value)}
                            />

                            <textarea
                                className="flex min-h-[120px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                                placeholder="Paste the job description here..."
                                value={jd.description}
                                onChange={(e) => updateJobDescription(jd.id, "description", e.target.value)}
                            />

                            {/* Individual Optimize Button */}
                            <button
                                type="button"
                                onClick={() => handleOptimizeSingle(jd)}
                                disabled={!file || !jd.description.trim() || processingJdId.has(jd.id)}
                                className={cn(
                                    "w-full h-10 rounded-md font-medium text-sm flex items-center justify-center gap-2 transition-all",
                                    isPro
                                        ? "bg-gradient-to-r from-purple-600/20 to-indigo-600/20 text-purple-300 hover:from-purple-600/30 hover:to-indigo-600/30 border border-purple-500/30"
                                        : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30",
                                    "disabled:opacity-50 disabled:cursor-not-allowed"
                                )}
                            >
                                {processingJdId.has(jd.id) ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Optimizing{isPro ? " (Pro)" : ""}...
                                    </>
                                ) : (
                                    <>
                                        {isPro ? <Crown className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                                        Optimize for this JD{isPro ? " (Pro)" : ""}
                                    </>
                                )}
                            </button>

                            {/* Inline Status Message */}
                            {jdMessages[jd.id] && (
                                <div className={cn(
                                    "flex items-center gap-2 text-sm px-3 py-2 rounded-md animate-in fade-in slide-in-from-top-1",
                                    jdMessages[jd.id].type === "success"
                                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                        : "bg-destructive/10 text-red-400 border border-destructive/20"
                                )}>
                                    {jdMessages[jd.id].type === "success" ? (
                                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                                    ) : (
                                        <AlertCircle className="h-4 w-4 shrink-0" />
                                    )}
                                    <span className="truncate">{jdMessages[jd.id].text}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* AI Model Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">AI Model</label>
                    <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <optgroup label="🔥 GPT-5 Family (Latest)">
                            <option value="gpt-5.2">GPT-5.2 (Most Powerful)</option>
                            <option value="gpt-5.2-pro">GPT-5.2 Pro (Premium)</option>
                            <option value="gpt-5-mini">GPT-5 Mini (Fast)</option>
                            <option value="gpt-5-nano">GPT-5 Nano (Fastest)</option>
                        </optgroup>
                        <optgroup label="⚡ GPT-4.1 Family">
                            <option value="gpt-4.1">GPT-4.1 (Balanced)</option>
                            <option value="gpt-4.1-mini">GPT-4.1 Mini (Fast)</option>
                            <option value="gpt-4.1-nano">GPT-4.1 Nano (Budget)</option>
                        </optgroup>
                    </select>
                </div>

            </div>
        </div>
    );
}
