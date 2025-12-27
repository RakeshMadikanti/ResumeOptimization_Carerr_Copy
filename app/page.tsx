import { ResumeForm } from "@/components/ResumeForm";

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-between p-24 relative overflow-hidden">

            {/* Background Gradients */}
            <div className="absolute top-0 left-1/2 w-[1000px] h-[400px] -translate-x-1/2 -translate-y-1/2 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />

            <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex-col lg:flex">
                <div className="text-center mb-12 space-y-4">
                    <h1 className="text-4xl font-extrabold tracking-tight lg:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        AutoResume
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Upload your resume, paste the job description, and let AI tailor your application in seconds perfectly preserving your format.
                    </p>
                </div>

                <ResumeForm />
            </div>
        </main>
    )
}
