import { Upload, FileText, Download } from "lucide-react";

export function HowItWorks() {
    const steps = [
        {
            icon: <Upload className="w-8 h-8 text-primary" />,
            title: "Upload Resume",
            desc: "Upload your existing resume in DOCX format. We preserve your exact formatting."
        },
        {
            icon: <FileText className="w-8 h-8 text-primary" />,
            title: "Paste Job Description",
            desc: "Copy the JD you are applying for. Our AI analyzes the keywords and requirements."
        },
        {
            icon: <Download className="w-8 h-8 text-primary" />,
            title: "Download Optimized",
            desc: "Get a perfectly tailored resume that beats the ATS, ready to submit in seconds."
        }
    ];

    return (
        <section className="py-24 relative overflow-hidden">
            <div className="container px-4 md:px-6 mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">How It Works</h2>
                    <p className="mx-auto max-w-[700px] text-muted-foreground mt-4 text-lg">
                        Three simple steps to your dream job interview.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {steps.map((step, i) => (
                        <div key={i} className="flex flex-col items-center text-center p-6 bg-card border border-border/50 rounded-xl shadow-lg hover:shadow-xl transition-all">
                            <div className="p-4 bg-primary/10 rounded-full mb-4">
                                {step.icon}
                            </div>
                            <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                            <p className="text-muted-foreground">{step.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
