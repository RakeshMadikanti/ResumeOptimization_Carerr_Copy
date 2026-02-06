import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, unlink } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";

const execAsync = promisify(exec);

// Detect the correct Python command based on platform
const getPythonCommand = () => {
    // On Windows, it's usually 'python', on Linux/Docker it's 'python3'
    return process.platform === 'win32' ? 'python' : 'python3';
};

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("resume") as File;
        const jd = formData.get("jd") as string;
        const name = formData.get("name") as string;
        const prompt = formData.get("prompt") as string;

        const provider = formData.get("provider") as string;
        const model = formData.get("model") as string;

        // Check for OpenAI API Key
        const apiKey = process.env.OPENAI_API_KEY || "";
        if (!apiKey) return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });

        if (!file || !jd) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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
            const command = `${pythonCmd} "${scriptPath}" "${inputPath}" "${outputPath}" "${jdPath}" "${promptPath}" "${provider}" "${model}" "${apiKey}"`;

            const { stdout, stderr } = await execAsync(command);

            // Log stderr for debugging (even on success, Python might print warnings)
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

                // Return DOCX file directly
                return new NextResponse(new Uint8Array(fileBuffer), {
                    headers: {
                        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'Content-Disposition': `attachment; filename="${fileName}.docx"`,
                    },
                });
            } else {
                // Cleanup temp files
                for (const tempFile of tempFiles) {
                    try { await unlink(tempFile); } catch { }
                }
                return NextResponse.json({ error: result.message || "Optimization failed" }, { status: 500 });
            }
        } catch (e: any) {
            // Cleanup temp files
            for (const tempFile of tempFiles) {
                try { await unlink(tempFile); } catch { }
            }
            console.error("Optimization error:", e);
            // Include stderr in error message for debugging (sanitized)
            const errorDetails = e.stderr || e.message || "Processing failed";
            const safeError = errorDetails.replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED]');
            return NextResponse.json({ error: `Failed: ${safeError}` }, { status: 500 });
        }
    } catch (error: any) {
        console.error("Request error:", error);
        // Sanitize error message - don't expose sensitive data
        const safeError = (error.message || "Server error").replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED]');
        return NextResponse.json({ error: safeError }, { status: 500 });
    }
}
