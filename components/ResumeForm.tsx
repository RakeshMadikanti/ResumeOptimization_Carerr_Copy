"use client";

import { useState, useEffect } from "react";
import { Upload, FileText, Sparkles, Loader2, Trash2, Save, AlertCircle, CheckCircle2, Crown, Folder, User, ChevronDown, ChevronRight, Plus, PanelLeftClose, PanelLeftOpen, LayoutList, Briefcase, Scale, Award } from "lucide-react";
import { toast } from "sonner";
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

    // Model is fixed to "gpt-5.2"; UI selection removed
    const [template, setTemplate] = useState("standard");
    const [processingJdId, setProcessingJdId] = useState<Set<string>>(new Set());

    // Per-JD status messages (success or error)
    const [jdMessages, setJdMessages] = useState<Record<string, { type: "success" | "error"; text: string }>>({});

    // Candidates Directory State
    const [candidates, setCandidates] = useState<{ name: string, files: { name: string, path: string }[] }[]>([]);
    const [expandedCandidates, setExpandedCandidates] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");
    const [isAddingCandidate, setIsAddingCandidate] = useState(false);
    const [newCandidateName, setNewCandidateName] = useState("");
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Load saved prompts, resumes, & candidates on mount
    useEffect(() => {
        if (!isLoaded || !userId) return;

        const saved = localStorage.getItem(`savedPrompts_${userId}`);
        if (saved) {
            setSavedPrompts(JSON.parse(saved));
        } else {
            setSavedPrompts([]);
        }

        loadResumes(userId);
        fetchCandidates();
    }, [isLoaded, userId]);

    const fetchCandidates = () => {
        fetch(`/api/candidates?t=${Date.now()}`)
            .then(res => res.json())
            .then(data => setCandidates(data.candidates || []))
            .catch(console.error);
    };

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
                toast.success(`Uploaded ${newFile.name}`);
            } catch (e) {
                console.error("Failed to save resume", e);
                toast.error("Failed to save resume to database");
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

        toast.info("Resume deleted from database");
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

    // Candidate UI Actions
    const toggleCandidate = (name: string) => {
        setExpandedCandidates(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    }

    const handleCandidateFileClick = async (candidateName: string, fileInfo: { name: string, path: string }) => {
        try {
            toast.loading(`Loading ${fileInfo.name}...`, { id: 'load-candidate' });
            const response = await fetch(`/api/candidates/download?path=${encodeURIComponent(fileInfo.path)}`);
            if (!response.ok) throw new Error('Failed to fetch file');
            const blob = await response.blob();
            // construct a File object
            const loadedFile = new File([blob], fileInfo.name, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

            // Re-use `handleFileChange` which saves to IndexedDB and triggers state
            await handleFileChange(loadedFile);
            toast.success(`Loaded ${fileInfo.name}`, { id: 'load-candidate' });
        } catch (e) {
            console.error(e);
            toast.error(`Error loading file`, { id: 'load-candidate' });
            toast.error(`Error loading file`, { id: 'load-candidate' });
        }
    };

    const handleAddCandidate = async () => {
        if (!newCandidateName.trim()) return;
        const formData = new FormData();
        formData.append("name", newCandidateName.trim());

        try {
            const res = await fetch('/api/candidates', { method: 'POST', body: formData });
            if (!res.ok) throw new Error("Failed");
            toast.success("Candidate created");
            setNewCandidateName("");
            setIsAddingCandidate(false);
            fetchCandidates();
            setExpandedCandidates(prev => new Set(prev).add(newCandidateName.trim()));
        } catch (e) {
            toast.error("Error creating candidate");
        }
    };

    const handleDeleteCandidate = async (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Delete candidate ${name} and all their files?`)) return;
        try {
            const res = await fetch(`/api/candidates?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
            if (!res.ok) throw new Error("Failed");
            toast.success("Candidate deleted");
            fetchCandidates();
        } catch (e) {
            toast.error("Error deleting candidate");
        }
    };

    const handleUploadToCandidate = async (name: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("name", name);
        formData.append("resume", file);

        try {
            toast.loading(`Uploading to ${name}...`, { id: 'upload-candidate' });
            const res = await fetch('/api/candidates', { method: 'POST', body: formData });
            if (!res.ok) throw new Error("Failed");
            toast.success("File uploaded", { id: 'upload-candidate' });
            fetchCandidates();
            setExpandedCandidates(prev => new Set(prev).add(name));
        } catch (error) {
            toast.error("Error uploading file", { id: 'upload-candidate' });
        }
        e.target.value = ''; // reset input
    };

    const handleDeleteCandidateFile = async (path: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Delete this file?`)) return;
        try {
            const res = await fetch(`/api/candidates?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
            if (!res.ok) throw new Error("Failed");
            toast.success("File deleted");
            fetchCandidates();
        } catch (error) {
            toast.error("Error deleting file");
        }
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

        if (!prompt.trim()) {
            setJdMessages(prev => ({
                ...prev,
                [jd.id]: { type: "error", text: "Prompt instructions are required" }
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
        formData.append("model", "gpt-5.2");
        formData.append("mode", "pro");
        formData.append("template", template);

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
                const next = new Set(prev);
                next.delete(jd.id);
                return next;
            });
        }
    };

    const filteredCandidates = candidates.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="flex flex-col md:flex-row w-full items-start justify-center gap-4 lg:gap-8 max-w-7xl mx-auto px-4 xl:px-8 relative pt-4">

            {/* Optionally Show Sidebar Open Button if it's closed */}
            {!isSidebarOpen && (
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="absolute left-4 top-4 md:-ml-12 md:top-6 hidden md:flex items-center justify-center p-2 rounded-lg bg-card border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary/50 shadow-sm transition-all"
                    title="Open Candidates Directory"
                >
                    <PanelLeftOpen className="w-5 h-5" />
                </button>
            )}

            {/* Candidates Directory Sidebar */}
            <div
                className={cn(
                    "w-full md:w-64 lg:w-80 shrink-0 bg-card border border-border/50 rounded-xl shadow-2xl flex-col backdrop-blur-sm md:sticky md:top-20 self-start transition-all duration-300 origin-left overflow-hidden",
                    !isSidebarOpen ? "hidden md:hidden" : "flex"
                )}
                style={{ maxHeight: 'calc(100vh - 6rem)' }}
            >

                {/* Header */}
                <div className="p-5 border-b border-border/50 shrink-0 space-y-4 bg-secondary/5 rounded-t-xl">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Folder className="w-5 h-5 text-primary fill-primary/20" />
                            Candidates
                        </h3>
                        <div className="flex items-center gap-1">
                            {/* Compact add button */}
                            <button
                                onClick={() => setIsAddingCandidate(!isAddingCandidate)}
                                className={cn(
                                    "flex items-center justify-center p-1.5 rounded-md transition-colors",
                                    isAddingCandidate ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                )}
                                title="New Candidate"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setIsSidebarOpen(false)}
                                className="hidden md:flex items-center justify-center p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                                title="Close Sidebar"
                            >
                                <PanelLeftClose className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {isAddingCandidate && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 bg-background p-1 rounded-md border border-primary/30 shadow-sm">
                            <input
                                type="text"
                                placeholder="Name..."
                                autoFocus
                                className="flex-1 bg-transparent border-none px-2 py-1 text-xs focus:outline-none"
                                value={newCandidateName}
                                onChange={e => setNewCandidateName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddCandidate()}
                            />
                            <button
                                onClick={handleAddCandidate}
                                disabled={!newCandidateName.trim()}
                                className="px-2 py-1 bg-primary text-primary-foreground rounded text-[10px] font-bold uppercase tracking-wider hover:bg-primary/90 disabled:opacity-50"
                            >
                                Add
                            </button>
                        </div>
                    )}

                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search directory..."
                            className="w-full bg-background border border-input rounded-md pl-3 pr-8 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary h-8"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                            >
                                ×
                            </button>
                        )}
                    </div>
                </div>

                {/* Candidate List */}
                <div className="overflow-y-auto p-3 flex-1 min-h-[300px] space-y-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-border/80">
                    {candidates.length === 0 ? (
                        <div className="text-center text-xs text-muted-foreground py-10 px-4 flex flex-col items-center">
                            <User className="w-8 h-8 text-muted-foreground/30 mb-2" />
                            Directory is empty.<br /> Add a new candidate above to get started.
                        </div>
                    ) : filteredCandidates.length === 0 ? (
                        <div className="text-center text-xs text-muted-foreground py-8">
                            No matches found for "{searchTerm}"
                        </div>
                    ) : filteredCandidates.map(c => (
                        <div key={c.name} className="group/candidate bg-background border border-border/80 rounded-lg overflow-hidden transition-all hover:border-primary/30 shadow-sm hover:shadow">

                            {/* Candidate Row */}
                            <div className="flex items-center w-full px-1 py-1 pr-2">
                                <button
                                    type="button"
                                    onClick={() => toggleCandidate(c.name)}
                                    title={expandedCandidates.has(c.name) ? "Collapse Folder" : "Expand Folder"}
                                    className="flex-1 flex items-center gap-2 p-2 hover:bg-accent/50 rounded-md text-sm font-medium transition-colors text-left"
                                >
                                    <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                        <User className="w-3.5 h-3.5 text-primary" />
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="truncate leading-tight text-[13px]">{c.name}</span>
                                        <span className="text-[10px] text-muted-foreground leading-tight">
                                            {c.files.length} {c.files.length === 1 ? 'file' : 'files'}
                                        </span>
                                    </div>
                                    <div className="ml-auto">
                                        {expandedCandidates.has(c.name) ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
                                    </div>
                                </button>

                                {/* Quick actions on hover */}
                                <div className="flex items-center opacity-0 group-hover/candidate:opacity-100 transition-opacity ml-1">
                                    <label className="cursor-pointer p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors" title="Upload Resume">
                                        <Plus className="w-3.5 h-3.5" />
                                        <input
                                            type="file"
                                            accept=".docx"
                                            className="hidden"
                                            onChange={(e) => handleUploadToCandidate(c.name, e)}
                                        />
                                    </label>
                                    <button
                                        onClick={(e) => handleDeleteCandidate(c.name, e)}
                                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                        title="Delete Candidate"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Dropdown Files Array */}
                            {expandedCandidates.has(c.name) && (
                                <div className="bg-secondary/10 border-t border-border/40 p-2 space-y-1">
                                    {c.files.length === 0 ? (
                                        <div className="flex items-center justify-between bg-background border border-dashed border-border/50 rounded p-3">
                                            <span className="text-[11px] text-muted-foreground italic">No resumes uploaded</span>
                                            <label className="cursor-pointer text-[10px] font-medium bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary hover:text-primary-foreground transition-colors">
                                                Upload
                                                <input type="file" accept=".docx" className="hidden" onChange={(e) => handleUploadToCandidate(c.name, e)} />
                                            </label>
                                        </div>
                                    ) : (
                                        c.files.map((f, i) => (
                                            <div key={i} className="flex items-center group/file bg-background border border-border/50 hover:border-primary/30 hover:bg-primary/5 rounded-md transition-all">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCandidateFileClick(c.name, f)}
                                                    title="Load this resume for optimization"
                                                    className="flex-1 flex items-center gap-2 px-2 py-1.5 text-[12px] text-left text-foreground/80 hover:text-primary transition-colors overflow-hidden"
                                                >
                                                    <FileText className="w-3 h-3 text-primary shrink-0" />
                                                    <span className="truncate">{f.name}</span>
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteCandidateFile(f.path, e)}
                                                    className="opacity-0 group-hover/file:opacity-100 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-r-md transition-all shrink-0 border-l border-transparent group-hover/file:border-border/50"
                                                    title="Delete File"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Resume Builder Form Container */}
            <div className="w-full flex-1 min-w-0 max-w-3xl bg-card border border-border/50 rounded-xl shadow-2xl overflow-hidden backdrop-blur-sm self-start">
                <div className="p-4 lg:p-5 space-y-4">

                    {/* File Upload */}
                    <div className="space-y-4">
                        <label className="text-sm font-medium leading-none">
                            Upload Original Resume (DOCX)
                        </label>
                        <div className={cn(
                            "border-2 border-dashed border-muted-foreground/25 rounded-lg p-3 lg:p-4 text-center hover:bg-muted/50 transition cursor-pointer relative",
                            file && "border-primary/50 bg-primary/5"
                        )}>
                            <input
                                type="file"
                                accept=".docx"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                            />
                            <div className="flex flex-col items-center gap-2">
                                {file ? (
                                    <>
                                        <FileText className="h-8 w-8 text-primary" />
                                        <p className="font-medium text-foreground">{file?.name}</p>
                                        <p className="text-xs text-muted-foreground">{((file?.size || 0) / 1024).toFixed(2)} KB</p>
                                    </>
                                ) : (
                                    <>
                                        <Upload className="h-8 w-8 text-muted-foreground" />
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
                                                file?.name === r.name ? "bg-accent border-primary/50 ring-1 ring-primary/20" : "bg-background border-border"
                                            )}
                                        >
                                            <FileText className="w-3 h-3 text-muted-foreground" />
                                            <span className="truncate max-w-[120px]">{r.name}</span>
                                            <button
                                                onClick={(e) => deleteResume(r.id, e)}
                                                title="Delete Recent Resume"
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

                    {/* Prompt Instructions */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium leading-none flex items-center gap-2">
                                <span>Prompt Instructions</span>
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">Required</span>
                            </label>
                            {!isSavingPrompt ? (
                                <button
                                    onClick={() => setIsSavingPrompt(true)}
                                    type="button"
                                    disabled={!prompt}
                                    title="Save current prompt instructions"
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

                        <textarea
                            className="flex min-h-[80px] w-full rounded-md border bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y border-purple-500/30"
                            placeholder="Enter your full prompt instructions for ChatGPT. Your prompt will be sent directly — the app adds no modifications.&#10;&#10;Example: You are a resume expert. Rewrite the professional summary and experience bullet points to align with the given JD..."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                        />

                        {/* Saved Prompts Chips */}
                        {savedPrompts.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                                {savedPrompts.map((p, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => setPrompt(p.content)}
                                        title="Click to load this saved prompt"
                                        className="group flex items-center gap-2 bg-secondary/50 hover:bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full text-xs cursor-pointer transition-colors max-w-full border border-transparent hover:border-primary/20"
                                    >
                                        <Sparkles className="w-3 h-3 text-primary" />
                                        <span className="font-medium truncate max-w-[150px]">{p.name}</span>
                                        <button
                                            onClick={(e) => deletePrompt(idx, e)}
                                            title="Delete saved prompt"
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
                    <div className="space-y-3">
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
                            <div key={jd.id} className="space-y-2 p-3 border border-border/50 rounded-lg bg-secondary/10">
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
                                    className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    placeholder="Company/Role (e.g., Google_SWE, Meta_Backend)"
                                    value={jd.companyRole}
                                    onChange={(e) => updateJobDescription(jd.id, "companyRole", e.target.value)}
                                />

                                <textarea
                                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
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
                                        "w-full h-9 rounded-md font-medium text-sm flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-purple-600/20 to-indigo-600/20 text-purple-300 hover:from-purple-600/30 hover:to-indigo-600/30 border border-purple-500/30",
                                        "disabled:opacity-50 disabled:cursor-not-allowed"
                                    )}
                                >
                                    {processingJdId.has(jd.id) ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Optimizing...
                                        </>
                                    ) : (
                                        <>
                                            <Crown className="h-4 w-4" />
                                            Optimize for this JD
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

                    {/* Resume Format Template Selector */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium leading-none flex items-center gap-2">
                            <span>Resume Layout</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">Format</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: "standard", label: "Standard", desc: "Summary → Skills → Experience → Education", Icon: LayoutList },
                                { id: "experience-led", label: "Experience-Led", desc: "Summary → Experience → Skills → Education", Icon: Briefcase },
                                { id: "balanced", label: "Balanced", desc: "Summary → Experience → Education → Skills", Icon: Scale },
                                { id: "executive", label: "Executive", desc: "Summary → Skills → Education → Experience", Icon: Award },
                            ].map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setTemplate(t.id)}
                                    className={cn(
                                        "flex flex-col items-start gap-1.5 p-3 rounded-lg border text-left transition-all",
                                        template === t.id
                                            ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-sm"
                                            : "border-border/50 bg-background hover:bg-secondary/30 hover:border-border"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <t.Icon className={cn("w-4 h-4", template === t.id ? "text-primary" : "text-muted-foreground")} />
                                        <span className={cn("text-sm font-medium", template === t.id ? "text-foreground" : "text-foreground/80")}>{t.label}</span>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground leading-tight">{t.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
