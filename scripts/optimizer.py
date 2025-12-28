import sys
import json
import os
import google.generativeai as genai
from openai import OpenAI
from docx import Document

class ModelProvider:
    def generate(self, system_prompt, user_prompt, api_key, model_name):
        raise NotImplementedError

class GeminiProvider(ModelProvider):
    def generate(self, system_prompt, user_prompt, api_key, model_name):
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)
        # Combine prompts for Gemini as it differentiates less strictly in some versions, 
        # but here we just send one block or chat.
        full_prompt = f"{system_prompt}\n\n{user_prompt}"
        response = model.generate_content(full_prompt)
        return response.text

class OpenAIProvider(ModelProvider):
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
        
        # specific extraction to keep context
        full_text = []
        for para in doc.paragraphs:
            if para.text.strip():
                full_text.append(para.text.strip())
        
        resume_content = "\n".join(full_text)
        
        system_prompt = f"""
        You are an expert resume optimizer. 
        Goal: {prompt_instruction}
        
        Input Data:
        1. **Job Description (JD)**: The target role requirements.
        2. **Resume Content**: The candidate's current experience.
        
        Your Mission:
        Rewrite the resume content to strictly align with the specific keywords, skills, and tone of the provided JD. 
        You must update **BOTH** the "Professional Summary" and the "Experience" bullet points.
        
        Execution Rules:
        1. **1-to-1 Replacement**: You cannot add new bullet points or delete existing ones. You must simply *rewrite* the existing text to be better.
        2. **Quantity**: Aim to rewrite at least 50% of the bullet points to be more relevant to the JD. If a bullet point is generic, rewrite it to use the JD's specific terminology.
        3. **Precision**: The "original" field in your output must match the provided resume text EXPERTLY. Do not strip punctuation or trailing spaces.
        4. **Adaptability**: Whatever the JD asks for (Cloud, Finance, Healthcare, etc.), tailor the experience to that domain using the candidate's existing background as the base.
        
        Output Format:
        Return ONLY a raw JSON object with this structure:
        {{
            "replacements": [
                {{
                    "original": "exact text from the resume",
                    "new": "optimized version using JD keywords"
                }}
            ]
        }}
        """
        
        user_prompt = f"""
        Job Description:
        {jd_text}
        
        Resume Content:
        {resume_content}
        """

        # Select Provider
        if provider.lower() == 'openai':
            ai_client = OpenAIProvider()
        else:
            ai_client = GeminiProvider()

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
            for para in doc.paragraphs:
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

            # Threshold for replacement (0.85 allows for minor AI hallucinations or smart-quote diffs)
            if best_match_para and best_ratio > 0.85:
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

        doc.save(output_path)
        print(json.dumps({"status": "success", "changes": changes_count}))

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
    key_arg = sys.argv[7]
    
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
    
    optimize_resume(input_p, output_p, jd_t, prompt_t, provider_arg, model_arg, key_arg)
