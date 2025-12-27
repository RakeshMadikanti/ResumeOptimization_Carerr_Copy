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
        for replacement in replacements:
            original = replacement["original"]
            new_text = replacement["new"]
            
            # Robust search and replace
            # We ignore leading/trailing whitespace for matching, but replace the whole paragraph text
            norm_original = " ".join(original.split())
            
            for para in doc.paragraphs:
                # Normalize paragraph text for comparison
                norm_para = " ".join(para.text.split())
                
                # Check for exact match or substring match
                if norm_original in norm_para and len(norm_original) > 10:
                    # We found the paragraph.
                    # To preserve runs, we ideally would replace runs, but docx structure is complex.
                    # Text assignment to para.text preserves paragraph style (bullets) but resets character formatting (bolding within line).
                    # Given the user wants to keep "format", para.text assignment keeps the BLOCK level formatting (bullets, indent).
                    # It might lose "bold" words inside the sentence. 
                    # For MVP, para.text = new_text is the safest way to change content without corrupting XML.
                    
                    # If it's a perfect match of the whole paragraph
                    if norm_original == norm_para:
                        para.text = new_text
                        changes_count += 1
                    # If it's a substring (e.g. one sentence in a multi-sentence bullet?)
                    # The prompt asks for "sentences or bullet points".
                    else:
                        para.text = para.text.replace(original, new_text)
                        changes_count += 1

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
