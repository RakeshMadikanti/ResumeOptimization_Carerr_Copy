import sys
import json
import os
from openai import OpenAI
from docx import Document

class OpenAIProvider:
    def generate(self, system_prompt, user_prompt, api_key, model_name):
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"}
        )
        return response.choices[0].message.content

def optimize_resume(input_path, output_path, jd_text, prompt_instruction, provider, model_name, api_key):
    try:
        doc = Document(input_path)
        
        # Helper to iterate ALL paragraphs (Body + Tables)
        def iter_all_paragraphs(document):
            for para in document.paragraphs:
                yield para
            for table in document.tables:
                for row in table.rows:
                    for cell in row.cells:
                        for para in cell.paragraphs:
                            yield para

        # specific extraction to keep context
        full_text = []
        for para in iter_all_paragraphs(doc):
            if para.text.strip():
                full_text.append(para.text.strip())
        
        resume_content = "\n".join(full_text)
        
        system_prompt = f"""
        You are a resume rewriter. Your job is simple:
        
        **Goal**: {prompt_instruction}
        
        **CRITICAL INSTRUCTIONS**:
        1. You will receive a Resume and a Job Description (JD).
        2. **PROFESSIONAL SUMMARY - STRICT LENGTH RULE**:
           - Count the EXACT number of sentences in the original Professional Summary.
           - Your rewritten summary MUST have the EXACT SAME number of sentences.
           - If original has 3 sentences, output MUST have exactly 3 sentences.
           - DO NOT shorten or lengthen the summary under any circumstances.
        3. You MUST rewrite **EVERY SINGLE Experience bullet point** to match the JD. Do NOT skip any.
        4. For EACH paragraph/bullet in the resume, you MUST provide a replacement. No exceptions.
        5. The "original" field must be an EXACT copy-paste of the text from the resume I provide.
        6. The "new" field must be your rewritten version that aligns with the JD.
        7. If the domain is different (e.g., Java resume for a Data Engineering JD), completely rewrite the bullet point to be relevant.
        
        **Output Format**:
        Return ONLY a raw JSON object:
        {{
            "replacements": [
                {{"original": "exact text from resume", "new": "rewritten text for JD"}}
            ]
        }}
        """
        
        user_prompt = f"""
        Job Description:
        {jd_text}
        
        Resume Content:
        {resume_content}
        """

        # Always use OpenAI
        ai_client = OpenAIProvider()

        response_text = ai_client.generate(system_prompt, user_prompt, api_key, model_name)
        
        # Clean response if needed (Gemini sometimes adds backticks)
        response_text = response_text.replace("```json", "").replace("```", "").strip()
        
        try:
            data = json.loads(response_text)
        except json.JSONDecodeError:
            # Fallback scan
            start = response_text.find('{')
            end = response_text.rfind('}') + 1
            if start != -1 and end != -1:
                data = json.loads(response_text[start:end])
            else:
                print(json.dumps({"status": "error", "message": "Could not parse AI response", "raw": response_text}))
                sys.exit(1)

        replacements = data.get("replacements", [])
        job_title = data.get("job_title", "")
        
        # Log extracted job title for debugging
        if job_title:
            print(f"# Extracted Job Title: {job_title}", file=sys.stderr)
        
        # Replace in document
        changes_count = 0
        from difflib import SequenceMatcher

        def similar(a, b):
            return SequenceMatcher(None, a, b).ratio()

        def copy_style(source_run, target_run):
            """Copy ALL font attributes from source to target for exact visual match."""
            try:
                # Basic Formatting
                target_run.bold = source_run.bold
                target_run.italic = source_run.italic
                target_run.underline = source_run.underline
                
                # Advanced Formatting
                if source_run.font.strike is not None:
                    target_run.font.strike = source_run.font.strike
                if source_run.font.double_strike is not None:
                    target_run.font.double_strike = source_run.font.double_strike
                if source_run.font.subscript is not None:
                    target_run.font.subscript = source_run.font.subscript
                if source_run.font.superscript is not None:
                    target_run.font.superscript = source_run.font.superscript
                if source_run.font.small_caps is not None:
                    target_run.font.small_caps = source_run.font.small_caps
                if source_run.font.all_caps is not None:
                    target_run.font.all_caps = source_run.font.all_caps
                
                # Font Face and Size
                if source_run.font.name:
                    target_run.font.name = source_run.font.name
                
                if source_run.font.size:
                    target_run.font.size = source_run.font.size
                    
                # Color
                if source_run.font.color and source_run.font.color.rgb:
                    target_run.font.color.rgb = source_run.font.color.rgb
            except Exception:
                pass

        for replacement in replacements:
            original = replacement["original"]
            new_text = replacement["new"]
            
            # Robust search with Fuzzy Matching
            # Normalize whitespace for comparison
            norm_original = " ".join(original.split())
            
            best_match_para = None
            best_ratio = 0.0

            # First pass: Look for the best paragraph match
            for para in iter_all_paragraphs(doc):
                norm_para = " ".join(para.text.split())
                
                # Skip empty or too short paragraphs
                if len(norm_para) < 10:
                    continue

                # Check whole paragraph similarity
                ratio = similar(norm_original, norm_para)
                
                # Check if it's a substring (e.g. one bullet point in a list but docx treats as para)
                # If the original text is a significant part of the paragraph
                if  norm_original in norm_para:
                     ratio = 1.0 # Perfect substring match
                
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_match_para = para

            # Threshold for replacement (0.40 allows for significant AI rewrites of 'original')
            if best_match_para and best_ratio > 0.40:
                # We found the target paragraph!
                
                # 1. Capture Style from the first run (usually representative)
                captured_run = None
                if best_match_para.runs:
                    captured_run = best_match_para.runs[0]
                
                # 2. Replace the text
                # Note: Simply setting .text clears all runs and resets formatting to style default.
                # We must manually clear runs to keep paragraph-level formatting (bullets, indent)
                # then add a new run with the cloned style.
                
                best_match_para.clear() # Removes content but keeps paragraph style (e.g. List Bullet)
                new_run = best_match_para.add_run(new_text)
                
                # 3. Apply Style
                if captured_run:
                    copy_style(captured_run, new_run)
                
                changes_count += 1
                # print(f"Output: Replaced (confidence {best_ratio:.2f})")
            else:
                pass
                # print(f"Warning: Could not find match for: {original[:30]}...")

        if replacements:
            best_match_para = None # Reset
            
        verification = data.get("verification_report", {"score": 0, "is_optimized": False, "feedback": "No verification data provided."})
        
        doc.save(output_path)
        print(json.dumps({
            "status": "success", 
            "changes": changes_count,
            "job_title": job_title,
            "verification": verification
        }))

    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    # segments: script.py input output jd prompt provider model apikey
    if len(sys.argv) < 8:
        print("Usage: script.py <input> <output> <jd_or_path> <prompt_or_path> <provider> <model> <apikey>")
        sys.exit(1)
        
    input_p = sys.argv[1]
    output_p = sys.argv[2]
    jd_arg = sys.argv[3]
    prompt_arg = sys.argv[4]
    provider_arg = sys.argv[5]
    model_arg = sys.argv[6]
    
    # Get API key from environment variable (secure - not exposed in command line)
    api_key = os.environ.get('OPENAI_API_KEY', '')
    if not api_key:
        print(json.dumps({"status": "error", "message": "OPENAI_API_KEY environment variable not set"}))
        sys.exit(1)
    
    # Resolve JD
    if os.path.exists(jd_arg):
        with open(jd_arg, 'r', encoding='utf-8') as f:
            jd_t = f.read()
    else:
        jd_t = jd_arg

    # Resolve Prompt
    if os.path.exists(prompt_arg):
        with open(prompt_arg, 'r', encoding='utf-8') as f:
            prompt_t = f.read()
    else:
        prompt_t = prompt_arg
    
    optimize_resume(input_p, output_p, jd_t, prompt_t, provider_arg, model_arg, api_key)
