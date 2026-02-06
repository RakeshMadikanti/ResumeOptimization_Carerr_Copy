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
        const jdsJson = formData.get("jds") as string;
        const namesJson = formData.get("names") as string;
        const prompt = formData.get("prompt") as string;

        const provider = formData.get("provider") as string;
        const model = formData.get("model") as string;

        // Check for OpenAI API Key
        const apiKey = process.env.OPENAI_API_KEY || "";
        if (!apiKey) return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });

        if (!file || !jdsJson || !namesJson) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Parse arrays
        const jds: string[] = JSON.parse(jdsJson);
        const names: string[] = JSON.parse(namesJson);

        if (jds.length === 0 || jds.length !== names.length) {
            return NextResponse.json({ error: "Invalid JDs or names" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const tempDir = os.tmpdir();
        const inputPath = join(tempDir, `input_${Date.now()}.docx`);

        await writeFile(inputPath, buffer);

        // Process each JD sequentially
        const results: Array<{ name: string; buffer?: Buffer; error?: string; jobTitle?: string }> = [];
        const tempFiles: string[] = [inputPath];

        for (let i = 0; i < jds.length; i++) {
            const jd = jds[i];
            const customName = names[i];
            const outputPath = join(tempDir, `output_${Date.now()}_${i}.docx`);
            const jdPath = join(tempDir, `jd_${Date.now()}_${i}.txt`);
            const promptPath = join(tempDir, `prompt_${Date.now()}_${i}.txt`);

            tempFiles.push(outputPath, jdPath, promptPath);

            try {
                await writeFile(jdPath, jd);
                await writeFile(promptPath, prompt);

                const scriptPath = join(process.cwd(), "scripts", "optimizer.py");
                const pythonCmd = getPythonCommand();
                const command = `${pythonCmd} "${scriptPath}" "${inputPath}" "${outputPath}" "${jdPath}" "${promptPath}" "${provider}" "${model}" "${apiKey}"`;

                const { stdout, stderr } = await execAsync(command);

                // Log stderr for debugging
                if (stderr) {
                    console.error(`Python stderr for JD ${i + 1}:`, stderr);
                }

                const result = JSON.parse(stdout);

                if (result.status === "success") {
                    const fileBuffer = await readFile(outputPath);
                    // Use custom name or fallback to Optimized_Resume
                    const finalName = customName.trim() || `Optimized_Resume_${i + 1}`;
                    results.push({
                        name: `${finalName}.docx`,
                        buffer: fileBuffer,
                        jobTitle: result.job_title || "N/A"
                    });
                } else {
                    results.push({ name: `${customName || `Optimized_Resume_${i + 1}`}.docx`, error: result.message || "Unknown error" });
                }
            } catch (e: any) {
                console.error(`Failed to process JD ${i + 1}:`, e);
                // Include stderr in error message for debugging (sanitized)
                const errorDetails = e.stderr || e.message || "Processing failed";
                const safeError = errorDetails.replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED]');
                results.push({ name: `${customName}.docx`, error: safeError });
            }
        }

        // Create ZIP file
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();

        let successCount = 0;
        let failureCount = 0;

        for (const result of results) {
            if (result.buffer) {
                zip.file(result.name, result.buffer);
                successCount++;
            } else {
                zip.file(`ERROR_${result.name}.txt`, `Failed to optimize: ${result.error}`);
                failureCount++;
            }
        }

        // Add summary file
        const summary = `Batch Processing Summary
Total: ${results.length}
Successful: ${successCount}
Failed: ${failureCount}

Detailed Results:
${results.map((r, i) => {
            if (r.buffer) {
                return `${i + 1}. ${r.name}: SUCCESS - Tailored for "${r.jobTitle}"`;
            } else {
                return `${i + 1}. ${r.name}: FAILED - ${r.error}`;
            }
        }).join('\n')}
`;
        zip.file("BATCH_SUMMARY.txt", summary);

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

        // Cleanup
        for (const tempFile of tempFiles) {
            try { await unlink(tempFile); } catch { }
        }

        return new NextResponse(new Uint8Array(zipBuffer), {
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="batch_resumes_${Date.now()}.zip"`,
                "X-Batch-Summary": `${successCount}/${results.length} successful`,
            },
        });

    } catch (error: any) {
        console.error("Batch optimization error:", error);
        // Sanitize error message - don't expose sensitive data
        const safeError = (error.message || "Internal Error").replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED]');
        return NextResponse.json({ error: safeError }, { status: 500 });
    }
}
