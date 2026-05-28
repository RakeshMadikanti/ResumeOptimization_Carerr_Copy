import os
import re
import json

def classify_seniority(jd_text: str) -> str:
    """
    Classify the seniority level of a Job Description (JD) using keyword matching
    and years of experience extraction.
    Returns: 'Junior', 'Mid-Level', 'Senior', or 'Executive'
    """
    jd_lower = jd_text.lower()
    
    # 1. Look for years of experience numbers
    years_matches = re.findall(r'(\d+)\+?\s*(?:years?|yrs?)\b', jd_lower)
    max_years = 0
    if years_matches:
        try:
            max_years = max(int(y) for y in years_matches)
        except ValueError:
            pass

    # 2. Key phrase checks
    executive_keywords = [
        "executive", "director", "vice president", "vp", "chief", "head of", 
        "principal architect", "principal engineer", "director level", "enterprise architect"
    ]
    senior_keywords = [
        "senior", "sr.", "lead", "principal", "manager", "architect", "level iii", "level 3"
    ]
    junior_keywords = [
        "junior", "jr.", "entry level", "entry-level", "associate", "intern", 
        "co-op", "level i", "level 1"
    ]

    # Priority 1: Check Executive keywords
    if any(kw in jd_lower for kw in executive_keywords) or max_years >= 10:
        return "Executive"
        
    # Priority 2: Check Junior keywords
    if any(kw in jd_lower for kw in junior_keywords) and max_years <= 2:
        return "Junior"

    # Priority 3: Check Senior keywords
    if any(kw in jd_lower for kw in senior_keywords) or max_years >= 5:
        return "Senior"

    # Default/Fallback: Mid-Level (usually 3-4 years, or default)
    return "Mid-Level"

def get_calibrated_prompts(seniority: str) -> dict:
    """
    Return seniority-calibrated Allowed Verbs/Themes and Forbidden Phrases.
    """
    if seniority == "Executive":
        return {
            "allowed_verbs": [
                "steered", "directed", "architected", "pioneered", "championed", "led enterprise transformation",
                "established center of excellence", "defined global strategy", "governed budget", "managed executive stakeholders",
                "driven organizational growth", "business transformation", "thought leadership"
            ],
            "forbidden_phrases": [
                "supported daily operations", "assisted senior developers", "coordinated meetings", "performed routine maintenance"
            ]
        }
    elif seniority == "Senior":
        return {
            "allowed_verbs": [
                "designed", "architected", "implemented", "mentored", "orchestrated", "engineered", "streamlined", 
                "optimized", "integrated", "spearheaded", "cross-functional ownership", "advanced technical troubleshooting", 
                "scaling solutions"
            ],
            "forbidden_phrases": [
                "assisted", "helped", "supported daily", "steered business strategy at enterprise level", 
                "executive budget governance", "pioneered global corporate strategy"
            ]
        }
    elif seniority == "Junior":
        return {
            "allowed_verbs": [
                "assisted", "supported", "contributed", "developed", "tested", "coordinated", "learned", 
                "documented", "maintained", "foundational support", "routine execution"
            ],
            "forbidden_phrases": [
                "pioneered", "architected", "steered strategy", "led team", "mentored seniors", 
                "enterprise transformation", "executive leadership"
            ]
        }
    else: # Mid-Level
        return {
            "allowed_verbs": [
                "delivered", "implemented", "supported", "optimized", "collaborated", 
                "configured", "analyzed", "maintained", "hands-on execution", "delivery ownership",
                "operational optimization", "cross-functional collaboration", "implementation support",
                "reporting and analytics", "process improvements", "configuration and administration",
                "technical problem solving"
            ],
            "forbidden_phrases": [
                "enterprise transformation", "steered strategy", "principal architect", 
                "center of excellence", "organization-wide ownership", "executive leadership",
                "corporate roadmap development", "global enterprise strategy"
            ]
        }

def get_tool_mappings(candidate_domain: str, jd_domain: str) -> dict:
    """
    Look up tool substitutions from scripts/domain_tools.json.
    Matches tools from the jd_domain to equivalents in the candidate_domain
    by functional purpose tag.
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    tools_path = os.path.join(script_dir, "domain_tools.json")
    
    if not os.path.exists(tools_path):
        return {}
        
    try:
        with open(tools_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        return {}
        
    domains = data.get("domains", {})
    cand_tools = domains.get(candidate_domain, [])
    jd_tools = domains.get(jd_domain, [])
    
    if not cand_tools or not jd_tools:
        return {}
        
    # Build maps of purpose -> candidate tool names
    cand_purpose_map = {}
    for item in cand_tools:
        purpose = item.get("purpose")
        name = item.get("name")
        if purpose and name:
            cand_purpose_map.setdefault(purpose, []).append(name)
            
    # Find matching candidate tools for each JD tool
    mappings = {}
    for item in jd_tools:
        jd_name = item.get("name")
        purpose = item.get("purpose")
        if purpose in cand_purpose_map:
            # Map to the first available equivalent tool in the candidate's domain
            mappings[jd_name] = cand_purpose_map[purpose][0]
            
    return mappings
