import { ShieldCheck, Zap, WholeWord, Sparkles, LayoutTemplate, MousePointerClick } from "lucide-react";

export function Features() {
    const features = [
        {
            icon: <LayoutTemplate className="w-6 h-6" />,
            title: "Exact Format Preservation",
            desc: "We don't break your layout. Fonts, bullets, and margins stay exactly where they are."
        },
        {
            icon: <WholeWord className="w-6 h-6" />,
            title: "ATS Keyword Injection",
            desc: "Smartly weaves in keywords from the JD to ensure you pass automated screens."
        },
        {
            icon: <Zap className="w-6 h-6" />,
            title: "Cutting-Edge AI Models",
            desc: "Powered by OpenAI's latest GPT-5 and GPT-4.1 family models for best-in-class results."
        },
        {
            icon: <Sparkles className="w-6 h-6" />,
            title: "Smart Rewriting",
            desc: "Doesn't just swap words. It rewrites bullet points to sound more impactful."
        },
        {
            icon: <MousePointerClick className="w-6 h-6" />,
            title: "Custom Instructions",
            desc: "Tell the AI exactly what to focus on (e.g., 'Emphasize my leadership')."
        },
        {
            icon: <ShieldCheck className="w-6 h-6" />,
            title: "Private & Secure",
            desc: "Your data is processed securely and never shared with third parties."
        }
    ];

    return (
        <section className="py-24 bg-secondary/20 relative">
            <div className="container px-4 md:px-6 mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Why AutoResume?</h2>
                    <p className="mx-auto max-w-[700px] text-muted-foreground mt-4 text-lg">
                        Built for serious job seekers who value quality and speed.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((f, i) => (
                        <div key={i} className="flex gap-4 p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
                            <div className="mt-1 bg-primary/10 p-2 rounded-lg h-fit text-primary">
                                {f.icon}
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
                                <p className="text-muted-foreground text-sm">{f.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
