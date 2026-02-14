import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, unlink } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";

const execAsync = promisify(exec);

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Detect the correct Python command based on platform
const getPythonCommand = () => {
    return process.platform === 'win32' ? 'python' : 'python3';
};

// Allowlisted models — must match what OpenAI actually accepts
const ALLOWED_MODELS = new Set([
    "gpt-5.2", "gpt-5.2-pro", "gpt-5-mini", "gpt-5-nano",
    "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano",
]);

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("resume") as File;
        const jd = formData.get("jd") as string;
        const name = formData.get("name") as string;
        const prompt = formData.get("prompt") as string;

        const model = formData.get("model") as string;
        const mode = formData.get("mode") as string || "basic";

        // Validate model against allowlist
        if (!model || !ALLOWED_MODELS.has(model)) {
            return NextResponse.json({ error: "Invalid model selected" }, { status: 400 });
        }

        // Validate mode
        if (!['basic', 'pro'].includes(mode)) {
            return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
        }

        // Check for OpenAI API Key
        const apiKey = process.env.OPENAI_API_KEY || "";
        if (!apiKey) return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });

        if (!file || !jd) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: "File too large. Maximum size is 10MB." }, { status: 400 });
        }

        // Validate file type
        if (!file.name.endsWith('.docx')) {
            return NextResponse.json({ error: "Only .docx files are supported" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const tempDir = os.tmpdir();
        const inputPath = join(tempDir, `input_${Date.now()}.docx`);
        const outputPath = join(tempDir, `output_${Date.now()}.docx`);
        const jdPath = join(tempDir, `jd_${Date.now()}.txt`);
        const promptPath = join(tempDir, `prompt_${Date.now()}.txt`);

        const tempFiles = [inputPath, outputPath, jdPath, promptPath];

        try {
            await writeFile(inputPath, buffer);
            await writeFile(jdPath, jd);
            await writeFile(promptPath, prompt || "Highlight experience relevant to the job requirements.");

            const scriptPath = join(process.cwd(), "scripts", "optimizer.py");
            const pythonCmd = getPythonCommand();

            // Pass API key via environment variable instead of CLI argument for security
            console.log(`[AutoResume] Mode: ${mode.toUpperCase()}, Model: ${model}`);
            const command = `${pythonCmd} "${scriptPath}" "${inputPath}" "${outputPath}" "${jdPath}" "${promptPath}" "openai" "${model}" "${mode}"`;

            const { stdout, stderr } = await execAsync(command, {
                timeout: 120000, // 2 minute timeout
                env: { ...process.env, OPENAI_API_KEY: apiKey },
            });

            if (stderr) {
                console.error("Python stderr:", stderr);
            }

            const result = JSON.parse(stdout);

            if (result.status === "success") {
                const fileBuffer = await readFile(outputPath);
                const fileName = name?.trim() || "Optimized_Resume";

                // Cleanup temp files
                for (const tempFile of tempFiles) {
                    try { await unlink(tempFile); } catch { }
                }

                return new NextResponse(new Uint8Array(fileBuffer), {
                    headers: {
                        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'Content-Disposition': `attachment; filename="${fileName}.docx"`,
                    },
                });
            } else {
                for (const tempFile of tempFiles) {
                    try { await unlink(tempFile); } catch { }
                }
                return NextResponse.json({ error: result.message || "Optimization failed" }, { status: 500 });
            }
        } catch (e: any) {
            for (const tempFile of tempFiles) {
                try { await unlink(tempFile); } catch { }
            }
            console.error("Optimization error:", e);
            const errorDetails = e.stderr || e.message || "Processing failed";
            const safeError = errorDetails.replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED]');
            return NextResponse.json({ error: `Failed: ${safeError}` }, { status: 500 });
        }
    } catch (error: any) {
        console.error("Request error:", error);
        const safeError = (error.message || "Server error").replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED]');
        return NextResponse.json({ error: safeError }, { status: 500 });
    }
}
