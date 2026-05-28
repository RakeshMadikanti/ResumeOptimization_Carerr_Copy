import sys
import json
import os
import re
from openai import OpenAI
from docx import Document

def prune_job_description(raw_jd: str) -> str:
    """
    Remove boilerplate sections (benefits, EEO, company descriptions)
    from the Job Description to save input tokens, with safety guards
    to prevent false-positive truncations.
    """
    lines = raw_jd.split("\n")
    
    # Clean headers that indicate the start of boilerplate to be truncated
    boilerplate_headers = [
        "what we offer", "benefits", "perks", "compensation", 
        "equal opportunity", "diversity", "about us", "about the company", 
        "company overview", "our culture", "company culture", 
        "physical requirements", "work environment", "how to apply"
    ]
    
    # Specific keywords indicating boilerplate lines to filter out
    boilerplate_keywords = [
        r"401\(k\)",
        r"health insurance",
        r"dental insurance",
        r"vision insurance",
        r"medical insurance",
        r"dental\s*(and|&)?\s*vision",
        r"paid time off",
        r"\bpto\b",
        r"salary range",
        r"competitive salary",
        r"equal opportunity employer",
        r"visa sponsorship",
        r"hybrid work",
        r"medical\s*(and|&)?\s*dental"
    ]
    
    cleaned_lines = []
    for line in lines:
        lower_line = line.lower().strip()
        stripped_line = line.strip()
        
        # Only truncate on short lines (headers) that are NOT list bullets
        if len(stripped_line) < 50 and stripped_line:
            if not any(stripped_line.startswith(b) for b in ['*', '-', '•', '+', 'o', '–']):
                clean_match = re.sub(r'[^a-z0-9\s]+', ' ', lower_line).strip()
                if any(clean_match.startswith(header) for header in boilerplate_headers):
                    print(f"# JD Pruner: Truncated JD at boilerplate section: '{line.strip()}'", file=sys.stderr)
                    break
        cleaned_lines.append(line)
        
    filtered_lines = []
    pruned_count = 0
    for line in cleaned_lines:
        lower_line = line.lower().strip()
        if any(re.search(pattern, lower_line) for pattern in boilerplate_keywords):
            pruned_count += 1
            continue
        filtered_lines.append(line)
        
    if pruned_count > 0:
        print(f"# JD Pruner: Filtered out {pruned_count} boilerplate lines", file=sys.stderr)
        
    return "\n".join(filtered_lines).strip()


class OpenAIProvider:
    def generate(self, system_prompt, user_prompt, model_name):
        # API key is read from OPENAI_API_KEY environment variable
        client = OpenAI()
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"}
        )
        return response.choices[0].message.content

def copy_style(source_run, target_run):
    """Copy ALL font attributes from source to target for exact visual match."""
    try:
        target_run.bold = source_run.bold
        target_run.italic = source_run.italic
        target_run.underline = source_run.underline
        
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
        
        if source_run.font.name:
            target_run.font.name = source_run.font.name
        if source_run.font.size:
            target_run.font.size = source_run.font.size
        if source_run.font.color and source_run.font.color.rgb:
            target_run.font.color.rgb = source_run.font.color.rgb
    except Exception:
        pass

def iter_all_paragraphs(document):
    """Iterate ALL paragraphs: body + tables."""
    for para in document.paragraphs:
        yield para
    for table in document.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    yield para

def get_para_markdown(para):
    """Extract text from paragraph and convert run-level bolding to markdown."""
    result = ""
    for run in para.runs:
        text = run.text
        if not text: continue
        if run.bold:
            # Avoid putting ** around spaces which can cause parsing weirdness
            clean_text = text.strip()
            if clean_text:
                prefix = text[:text.find(clean_text)]
                suffix = text[len(prefix)+len(clean_text):]
                result += f"{prefix}**{clean_text}**{suffix}"
            else:
                result += text
        else:
            result += text
    return result.strip()

def replace_paragraph_text(para, new_text):
    """Replace paragraph text while preserving formatting and parsing markdown bolding."""
    captured_run = None
    if para.runs:
        # Try to find a representative run with text, fallback to first run
        for r in para.runs:
            if r.text.strip():
                captured_run = r
                break
        if not captured_run:
            captured_run = para.runs[0]
    
    para.clear()  # Removes content but keeps paragraph style (bullets, indent)
    
    # Strip any hard line breaks generated by ChatGPT to keep paragraph text wrapping native
    new_text = new_text.replace('\n', ' ')
    
    # Clean up any potential markdown list artifacts ChatGPT sometimes adds
    new_text = new_text.lstrip()
    if new_text.startswith('- '):
        new_text = new_text[2:]
    elif new_text.startswith('* ') and not new_text.startswith('**'):
        new_text = new_text[2:]
        
    # Auto-fallback: if ChatGPT forgot the asterisks but it matches a "Header Name: " layout
    if '**' not in new_text:
        match = re.match(r'^([A-Z][A-Za-z0-9\s&/\-,]{2,45}):\s(.*)', new_text)
        if match:
            new_text = f"**{match.group(1)}:** {match.group(2)}"
            
    # Parse **bold** markdown into actual Word runs
    has_markdown_bold = '**' in new_text
    parts = re.split(r'(\*\*.*?\*\*)', new_text)
    
    for part in parts:
        if not part:
            continue
            
        is_bold = part.startswith('**') and part.endswith('**')
        run_text = part[2:-2] if is_bold else part
        
        new_run = para.add_run(run_text)
        
        if captured_run:
            copy_style(captured_run, new_run)
            
        # If we detect markdown, explicitly toggle bolding on or off per segment
        # so it doesn't just blindly inherit the first word's formatting.
        if has_markdown_bold:
            new_run.bold = is_bold

def optimize_pro(input_path, output_path, jd_text, prompt_instruction, model_name):
    """
    PRO MODE: Positional replacement.
    
    1. Number each non-empty paragraph [1], [2], [3]...
    2. Send user's prompt verbatim + numbered resume + JD to ChatGPT
    3. ChatGPT returns {"replacements": [{"index": 1, "new": "..."}]}
    4. Replace paragraph at index N with new text. No matching. No thresholds.
    """
    try:
        doc = Document(input_path)
        
        # Build indexed list of all non-empty paragraphs
        indexed_paragraphs = []  # list of (index, paragraph_object)
        for para in iter_all_paragraphs(doc):
            text = para.text.strip()
            if text:
                indexed_paragraphs.append(para)
        
        # Section classification logic (to exclude header and education sections from LLM prompt)
        SECTION_KEYWORDS = {
            "summary": ["summary", "profile", "objective", "professional summary", "career objective"],
            "skills": ["skills", "technical skills", "expertise", "competencies", "technologies", "tools"],
            "experience": ["experience", "employment history", "work history", "professional experience", "work experience"],
            "education": ["education", "academic", "credentials", "degrees", "university", "schooling"]
        }

        def classify_heading(text_val):
            lower = text_val.lower().strip()
            if len(lower) > 40:
                return None
            for section_key, keywords in SECTION_KEYWORDS.items():
                for kw in keywords:
                    if kw in lower:
                        return section_key
            return None

        current_section = "header"
        para_sections = []
        for para in indexed_paragraphs:
            text = para.text.strip()
            detected = classify_heading(text)
            if detected is not None:
                current_section = detected
            para_sections.append(current_section)
        
        # Build numbered resume content for ChatGPT using markdown for bolding
        numbered_lines = []
        excluded_count = 0
        for i, para in enumerate(indexed_paragraphs):
            section = para_sections[i]
            # Exclude header and education paragraphs from LLM to save tokens & preserve styling
            if section in ["header", "education"]:
                excluded_count += 1
                continue
            
            para_md = get_para_markdown(para)
            numbered_lines.append(f"[{i + 1}] {para_md}")
        
        print(f"# Sectional Diff: Excluded {excluded_count} static paragraphs (header/education) from LLM prompt", file=sys.stderr)
        numbered_resume = "\n".join(numbered_lines)
        
        # System prompt: user's prompt + output format
        system_prompt = f"""{prompt_instruction}

**CRITICAL OUTPUT FORMAT (MUST follow exactly)**:
The resume content below is numbered with [1], [2], [3], etc.
For each point you want to replace, return its number and the new text.
Return ONLY a raw JSON object in this exact format:
{{
    "replacements": [
        {{"index": 1, "new": "your rewritten text for point 1"}},
        {{"index": 3, "new": "your rewritten text for point 3"}}
    ]
}}
Only include indexes for points you are changing. Do NOT include the [N] prefix in the "new" text.
You MAY use **bold** markdown (like **Role Title**) in the "new" text. The system will convert your asterisks into actual Microsoft Word Document bolding.
"""
        
        user_prompt = f"""Job Description:
{jd_text}

Resume Content (numbered):
{numbered_resume}
"""
        
        ai_client = OpenAIProvider()
        response_text = ai_client.generate(system_prompt, user_prompt, model_name)
        
        # Clean response
        response_text = response_text.replace("```json", "").replace("```", "").strip()
        
        try:
            data = json.loads(response_text)
        except json.JSONDecodeError:
            start = response_text.find('{')
            end = response_text.rfind('}') + 1
            if start != -1 and end != -1:
                data = json.loads(response_text[start:end])
            else:
                print(json.dumps({"status": "error", "message": "Could not parse AI response"}))
                sys.exit(1)
        
        replacements = data.get("replacements", [])
        changes_count = 0
        skipped_count = 0
        
        for replacement in replacements:
            idx = replacement.get("index")
            new_text = replacement.get("new", "")
            
            if idx is None or not new_text:
                skipped_count += 1
                print(f"# Skipped: missing index or empty new text", file=sys.stderr)
                continue
            
            # Convert 1-based index to 0-based
            pos = idx - 1
            
            if pos < 0 or pos >= len(indexed_paragraphs):
                skipped_count += 1
                print(f"# Skipped: index {idx} out of range (total paragraphs: {len(indexed_paragraphs)})", file=sys.stderr)
                continue
            
            target_para = indexed_paragraphs[pos]
            old_text = target_para.text.strip()
            
            replace_paragraph_text(target_para, new_text)
            changes_count += 1
            print(f"# Replaced [{idx}]: '{old_text[:50]}...' -> '{new_text[:50]}...'", file=sys.stderr)
        
        print(f"# Pro mode: {changes_count} replaced, {skipped_count} skipped out of {len(replacements)} total", file=sys.stderr)
        
        doc.save(output_path)
        print(json.dumps({
            "status": "success",
            "changes": changes_count,
            "mode": "pro"
        }))
    
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)

def optimize_basic(input_path, output_path, jd_text, prompt_instruction, model_name):
    """
    BASIC MODE: Fuzzy-match replacement (existing behavior).
    """
    try:
        doc = Document(input_path)
        
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

        ai_client = OpenAIProvider()
        response_text = ai_client.generate(system_prompt, user_prompt, model_name)
        
        # Clean response
        response_text = response_text.replace("```json", "").replace("```", "").strip()
        
        try:
            data = json.loads(response_text)
        except json.JSONDecodeError:
            start = response_text.find('{')
            end = response_text.rfind('}') + 1
            if start != -1 and end != -1:
                data = json.loads(response_text[start:end])
            else:
                print(json.dumps({"status": "error", "message": "Could not parse AI response"}))
                sys.exit(1)

        replacements = data.get("replacements", [])
        
        changes_count = 0
        from difflib import SequenceMatcher

        def similar(a, b):
            return SequenceMatcher(None, a, b).ratio()

        for replacement in replacements:
            original = replacement["original"]
            new_text = replacement["new"]
            
            norm_original = " ".join(original.split())
            
            best_match_para = None
            best_ratio = 0.0

            for para in iter_all_paragraphs(doc):
                norm_para = " ".join(para.text.split())
                
                if len(norm_para) < 10:
                    continue

                ratio = similar(norm_original, norm_para)
                
                if norm_original in norm_para:
                     ratio = 1.0

                if ratio > best_ratio:
                    best_ratio = ratio
                    best_match_para = para

            if best_match_para and best_ratio > 0.40:
                replace_paragraph_text(best_match_para, new_text)
                changes_count += 1
            else:
                print(f"# Warning: No match for: {original[:60]}... (best ratio: {best_ratio:.2f})", file=sys.stderr)

        doc.save(output_path)
        print(json.dumps({
            "status": "success", 
            "changes": changes_count,
            "mode": "basic"
        }))

    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)

def optimize_resume(input_path, output_path, jd_text, prompt_instruction, provider, model_name, mode="basic"):
    print(f"\n{'='*60}", file=sys.stderr)
    print(f"  AUTORESUME MODE: {'🟣 PRO (Positional Replacement)' if mode == 'pro' else '🔵 BASIC (Fuzzy Match)'}", file=sys.stderr)
    print(f"  Model: {model_name}", file=sys.stderr)
    print(f"{'='*60}\n", file=sys.stderr)
    if mode == "pro":
        optimize_pro(input_path, output_path, jd_text, prompt_instruction, model_name)
    else:
        optimize_basic(input_path, output_path, jd_text, prompt_instruction, model_name)

if __name__ == "__main__":
    # segments: script.py input output jd prompt provider model [mode]
    # API key is read from OPENAI_API_KEY environment variable
    if len(sys.argv) < 7:
        print("Usage: script.py <input> <output> <jd_or_path> <prompt_or_path> <provider> <model> [mode]")
        sys.exit(1)
        
    input_p = sys.argv[1]
    output_p = sys.argv[2]
    jd_arg = sys.argv[3]
    prompt_arg = sys.argv[4]
    provider_arg = sys.argv[5]
    model_arg = sys.argv[6]
    mode_arg = sys.argv[7] if len(sys.argv) > 7 else "basic"
    
    if not os.environ.get("OPENAI_API_KEY"):
        print(json.dumps({"status": "error", "message": "OPENAI_API_KEY environment variable not set"}))
        sys.exit(1)
    
    # Resolve JD
    if os.path.exists(jd_arg):
        with open(jd_arg, 'r', encoding='utf-8') as f:
            jd_t = f.read()
    else:
        jd_t = jd_arg
    
    jd_t = prune_job_description(jd_t)

    # Resolve Prompt
    if os.path.exists(prompt_arg):
        with open(prompt_arg, 'r', encoding='utf-8') as f:
            prompt_t = f.read()
    else:
        prompt_t = prompt_arg
    
    optimize_resume(input_p, output_p, jd_t, prompt_t, provider_arg, model_arg, mode_arg)
