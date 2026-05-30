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

# --- UNIVERSAL CATEGORIES & KEYWORD GAP ANALYSIS ---

UNIVERSAL_CATEGORIES = {
    "ERP_HRIS": ["workday", "sap", "oracle hcm", "peoplesoft", "hcm", "successfactors", "adp", "kronos", "ukg", "payroll"],
    "BI_ANALYTICS": ["power bi", "powerbi", "tableau", "looker", "qlik", "ssrs", "excel", "microstrategy", "cognos", "dax", "sql", "reporting"],
    "DATA_SCIENCE_ML": ["python", "r", "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch", "keras", "machine learning", "nlp", "jupyter", "spark", "hadoop", "rstudio"],
    "BUSINESS_ANALYSIS": ["business analysis", "requirements gathering", "brd", "frd", "user stories", "gap analysis", "agile", "scrum", "jira", "confluence", "sdt", "uat"],
    "SCRUM_AGILE": ["scrum", "agile", "scrum master", "safe", "kanban", "sprint planning", "retrospective", "daily standup", "jira", "csm"],
    "QA_TESTING": ["selenium", "cypress", "playwright", "test cases", "test plans", "qa", "manual testing", "regression testing", "automation", "postman", "soapui", "junit", "testng", "sdet", "cucumber"],
    "CYBER_SECURITY": ["cybersecurity", "siem", "firewall", "splunk", "splank", "soc", "penetration testing", "vulnerability", "iam", "active directory", "okta", "oauth", "saml", "cissp", "ceh"],
    "NETWORK_ENG": ["cisco", "ccna", "ccnp", "routing", "switching", "vpn", "dns", "dhcp", "tcp/ip", "subnetting", "wan", "lan", "load balancer", "firewall"],
    "FULL_STACK": ["javascript", "typescript", "react", "angular", "vue", "node.js", "nodejs", "express", "html", "css", "web development", "bootstrap", "tailwind"],
    "JAVA_STACK": ["java", "spring boot", "springboot", "hibernate", "maven", "gradle", "jpa", "microservices", "tomcat"],
    "IT_RELEASE_CHANGE": ["release management", "change management", "itil", "servicenow", "cicd", "jenkins", "git", "gitlab", "github", "devops", "kubernetes", "docker"]
}

SYNONYMS = {
    "workday studio": ["workday integration studio", "studio", "workday studio developer"],
    "eib": ["enterprise interface builder", "eib", "eibs"],
    "xslt": ["extensible stylesheet transformations", "xslt", "xsl"],
    "xpath": ["xml path language", "xpath"],
    "birt reports": ["birt", "business intelligence and reporting tools", "birt reports", "birt report"],
    "birt": ["birt reports", "birt report", "business intelligence and reporting tools"],
    "dis": ["dis", "workday dis", "data integration service"],
    "cloud connect": ["cloud connector", "cloud connectors", "ccw"],
    "workday integration core certification": ["workday certified", "integration core certified", "integration core certification", "workday integration core"],
    "workday integration core": ["workday certified", "integration core certified", "integration core certification", "workday integration core"],
    "integration security": ["security groups", "isg", "integration security", "security configuration"],
    "data mapping": ["data mapping", "data transformations", "mapping fields"],
    "integration lifecycle": ["integration lifecycle", "sdlc", "deployment phase"],
    "workday extend": ["extend", "wql", "workday extend developer"],
    "power bi": ["powerbi", "power bi developer", "dax"],
    "scrum master": ["scrum facilitator", "agile coach", "scrummaster"]
}

CERTIFICATION_EQUIVALENTS = {
    "workday integration core": {
        "title": "Workday Integration Core equivalent experience",
        "bullets": [
            "Configured custom Enterprise Interface Builders (EIB) and Workday Studio integration systems to streamline data flow.",
            "Designed complex transformations using XSLT/XPath for data mapping and system integration.",
            "Managed Workday Core Connector configurations and security group permissions for robust operations."
        ]
    },
    "pmp": {
        "title": "PMP-aligned project leadership experience",
        "bullets": [
            "Led cross-functional teams using PMBOK guidelines to deliver enterprise solutions within scope, budget, and timeline.",
            "Managed project schedules, risk registers, and stakeholder alignment to ensure seamless execution.",
            "Governed project resources, budgets, and change control processes for complex business operations."
        ]
    },
    "csm": {
        "title": "Scrum Master equivalent experience",
        "bullets": [
            "Facilitated sprint planning, retrospectives, and daily standups as a Scrum team facilitator.",
            "Removed team blockers and protected team velocity to ensure consistent increment delivery.",
            "Coached team members on Agile values and Scrum framework principles to optimize performance."
        ]
    },
    "cissp": {
        "title": "CISSP-aligned security engineering experience",
        "bullets": [
            "Designed and implemented identity and access management (IAM) frameworks to secure enterprise networks.",
            "Conducted security risk assessments and vulnerability management cycles to protect data integrity.",
            "Managed incident response procedures and security compliance monitoring across the infrastructure."
        ]
    },
    "itil": {
        "title": "ITIL service management equivalent experience",
        "bullets": [
            "Administered service delivery processes including incident, change, and release management under ITIL frameworks.",
            "Coordinated release cycles and deployment validation procedures to maintain service level agreements.",
            "Optimized service desk operations and configuration management databases (CMDB) for business continuity."
        ]
    }
}

def segment_resume_text(resume_text: str) -> dict:
    """Segments the resume text into standard sections for deterministic matching."""
    sections = {
        "summary": "",
        "skills": "",
        "experience": "",
        "education": "",
        "other": ""
    }
    
    SECTION_HEADERS = {
        "summary": ["summary", "profile", "objective", "professional summary", "career objective"],
        "skills": ["skills", "technical skills", "expertise", "competencies", "technologies", "tools", "areas of expertise"],
        "experience": ["experience", "employment history", "work history", "professional experience", "work experience"],
        "education": ["education", "academic", "credentials", "degrees", "university", "schooling"]
    }
    
    lines = resume_text.split("\n")
    current_sec = "other"
    
    for line in lines:
        lower_line = line.lower().strip()
        detected_sec = None
        if len(lower_line) < 40 and lower_line:
            for sec, keywords in SECTION_HEADERS.items():
                for kw in keywords:
                    if kw == lower_line or (kw in lower_line and len(lower_line) < len(kw) + 6):
                        detected_sec = sec
                        break
                if detected_sec:
                    break
        
        if detected_sec:
            current_sec = detected_sec
        else:
            sections[current_sec] += line + "\n"
            
    return sections

def extract_jd_keywords(jd_text: str) -> dict:
    """Dynamically extracts technical terms and maps them to universal domains."""
    jd_lower = jd_text.lower()
    extracted = {
        "hard_required": [],
        "soft_required": [],
        "preferred": []
    }
    
    # 1. Compile all potential search terms from universal categories
    base_search = []
    for cat_list in UNIVERSAL_CATEGORIES.values():
        base_search.extend(cat_list)
    # Add other common terms
    base_search.extend([
        "workday studio", "eib", "xslt", "xpath", "birt", "cloud connect",
        "calculated fields", "report writer", "hcm", "studio", "integration core",
        "power bi", "tableau", "jira", "scrum", "agile", "sql", "aws", "azure", "gcp",
        "selenium", "cypress", "playwright", "sdet", "qa", "manual testing", "test cases",
        "spring boot", "microservices", "kubernetes", "docker", "jenkins", "git",
        "cissp", "siem", "firewall", "cybersecurity", "networking", "cisco",
        "business analyst", "requirements", "uat", "brd", "frd", "change management",
        "release management", "servicenow", "itil", "project management", "pmp", "csm"
    ])
    base_search = list(set([k.lower() for k in base_search]))
    
    found_keywords = []
    for kw in base_search:
        if re.search(r'\b' + re.escape(kw) + r'\b', jd_lower):
            found_keywords.append(kw)
            
    # 2. Capitalized word scan for technical tools/libraries not in base list
    clean_jd = re.sub(r'^[A-Z][a-z]+', '', jd_text) # strip paragraph openers
    clean_jd = re.sub(r'\.\s+[A-Z][a-z]+', '. ', clean_jd) # strip sentence starters
    cap_words = re.findall(r'\b([A-Z][a-zA-Z0-9+#.-]+)\b', clean_jd)
    common_stops = {"the", "a", "an", "we", "our", "you", "your", "they", "this", "that", "these", "those", "and", "but", "or", "for", "with", "about", "to", "in", "on", "at", "by", "from", "as", "if", "when", "how", "why", "who", "what", "which", "he", "she", "it", "i", "me", "my", "us", "we", "they", "them", "their", "are", "is", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "shall", "should", "can", "could", "may", "might", "must", "target", "role", "position", "company", "candidate", "responsibilities", "requirements", "skills", "experience", "education", "degree", "team", "work", "job", "description", "details"}
    for word in cap_words:
        w_lower = word.lower()
        if w_lower not in common_stops and len(word) > 2:
            found_keywords.append(w_lower)
            
    found_keywords = list(set(found_keywords))
    
    # 3. Contextual classification (Hard Required vs Preferred vs Soft Required)
    for kw in found_keywords:
        kw_pattern = re.compile(r'([^.!?\n]*' + re.escape(kw) + r'[^.!?\n]*)', re.IGNORECASE)
        sentences = kw_pattern.findall(jd_text)
        is_hard = False
        is_pref = False
        
        for sentence in sentences:
            s_lower = sentence.lower()
            if any(term in s_lower for term in ["must", "required", "require", "essential", "minimum", "years of", "hands-on", "strong experience", "shall"]):
                is_hard = True
                break
            if any(term in s_lower for term in ["preferred", "plus", "nice to have", "desired", "desirable", "beneficial"]):
                is_pref = True
                break
                
        # Format for display
        kw_display = kw.title()
        if kw in ["xml", "xslt", "xpath", "soap", "rest", "hcm", "hris", "erp", "sdet", "qa", "itil", "siem", "iam", "vpn", "dns", "dhcp", "lan", "wan", "pmp", "csm", "safe", "uat", "brd", "frd"]:
            kw_display = kw.upper()
        elif kw in ["power bi", "powerbi"]:
            kw_display = "Power BI"
        elif kw == "spring boot":
            kw_display = "Spring Boot"
            
        if is_hard:
            extracted["hard_required"].append(kw_display)
        elif is_pref:
            extracted["preferred"].append(kw_display)
        else:
            extracted["soft_required"].append(kw_display)
            
    for cat in extracted:
        extracted[cat] = sorted(list(set(extracted[cat])))
        
    return extracted

def classify_keyword_presence(keyword: str, resume_text: str) -> str:
    """Classifies if keyword exists in resume as present or missing."""
    res_lower = resume_text.lower()
    kw_lower = keyword.lower()
    
    if re.search(r'\b' + re.escape(kw_lower) + r'\b', res_lower):
        return "present"
        
    syns = SYNONYMS.get(kw_lower, [])
    for syn in syns:
        if re.search(r'\b' + re.escape(syn.lower()) + r'\b', res_lower):
            return "present"
            
    # Check partials if needed, otherwise fallback to substring for minor variations
    if len(kw_lower) > 3 and kw_lower in res_lower:
        return "present"
        
    return "missing"

def get_keyword_confidence(keyword: str, resume_text: str) -> str:
    """Deterministically classifies confidence: FULL_EXPERIENCE, ADJACENT_EXPERIENCE, EXPOSURE_ONLY, NO_EXPERIENCE."""
    kw_lower = keyword.lower()
    is_certification = "certif" in kw_lower or "certified" in kw_lower or kw_lower in ["pmp", "cissp", "itil", "csm"]
    
    # Certifications must NEVER be fabricated
    if is_certification:
        presence = classify_keyword_presence(keyword, resume_text)
        if presence == "present":
            return "FULL_EXPERIENCE"
        else:
            return "NO_EXPERIENCE"
            
    sections = segment_resume_text(resume_text)
    
    # Check exact keyword or synonym presence
    kw_present = False
    in_exp = False
    in_skills = False
    in_summary = False
    
    for sec_name, content in sections.items():
        if classify_keyword_presence(keyword, content) == "present":
            kw_present = True
            if sec_name == "experience":
                in_exp = True
            elif sec_name == "skills":
                in_skills = True
            elif sec_name == "summary":
                in_summary = True
                
    if kw_present:
        if in_exp:
            return "FULL_EXPERIENCE"
        elif in_skills:
            return "ADJACENT_EXPERIENCE"
        else:
            return "EXPOSURE_ONLY"
            
    # Check for adjacent tools in the same category
    category_key = None
    for cat_name, cat_list in UNIVERSAL_CATEGORIES.items():
        if any(term in kw_lower for term in cat_list) or kw_lower in cat_list:
            category_key = cat_name
            break
            
    if category_key:
        # Check if candidate has ANY tool from this category in experience or skills
        cat_tools = UNIVERSAL_CATEGORIES[category_key]
        has_cat_in_exp = False
        has_cat_in_skills = False
        
        for tool in cat_tools:
            if tool == kw_lower:
                continue
            # Search in experience
            if classify_keyword_presence(tool, sections["experience"]) == "present":
                has_cat_in_exp = True
            # Search in skills
            if classify_keyword_presence(tool, sections["skills"]) == "present":
                has_cat_in_skills = True
                
        if has_cat_in_exp:
            return "ADJACENT_EXPERIENCE"
        elif has_cat_in_skills:
            return "EXPOSURE_ONLY"
            
    return "NO_EXPERIENCE"

def check_keyword_verb_compliance(keyword: str, text: str, confidence: str) -> bool:
    """Verifies if the keyword is accompanied by appropriate verbs in rewritten bullets."""
    if confidence == "NO_EXPERIENCE":
        return True # Handled by injection blocker
        
    VERBS = {
        "FULL_EXPERIENCE": ["led", "designed", "implemented", "configured", "developed", "administered", "managed", "optimized", "owned"],
        "ADJACENT_EXPERIENCE": ["partnered", "collaborated", "supported", "coordinated", "contributed", "worked alongside"],
        "EXPOSURE_ONLY": ["monitored", "evaluated", "participated", "observed", "reviewed", "assisted", "validated"]
    }
    
    sentences = re.split(r'[.!?\n]', text.lower())
    for sentence in sentences:
        if keyword.lower() in sentence:
            # Check if any verb from higher tiers is used inappropriately
            if confidence == "EXPOSURE_ONLY":
                higher_verbs = VERBS["FULL_EXPERIENCE"] + VERBS["ADJACENT_EXPERIENCE"]
                for v in higher_verbs:
                    if re.search(r'\b' + re.escape(v) + r'\b', sentence):
                        return False
            elif confidence == "ADJACENT_EXPERIENCE":
                higher_verbs = VERBS["FULL_EXPERIENCE"]
                for v in higher_verbs:
                    if re.search(r'\b' + re.escape(v) + r'\b', sentence):
                        return False
    return True

def calculate_ats_score(jd_text: str, resume_text: str, generated_strategies: list = None) -> dict:
    """
    Computes ATS alignment metrics based on placement, presence, confidence, and weights.
    Returns: {ats_score, keyword_match_score, recruiter_credibility, interview_defensibility}
    """
    jd_kws = extract_jd_keywords(jd_text)
    sections = segment_resume_text(resume_text)
    
    all_kws = []
    for cat in ["hard_required", "soft_required", "preferred"]:
        for kw in jd_kws[cat]:
            all_kws.append((kw, cat))
            
    if not all_kws:
        return {
            "score": 100,
            "keyword_match": 100,
            "recruiter_credibility": 100,
            "interview_defensibility": 100
        }
        
    total_max_points = 0
    total_earned_points = 0
    matched_count = 0
    total_count = len(all_kws)
    
    credibility_deductions = 0
    defensibility_deductions = 0
    
    keyword_freq = {}
    
    for kw, category in all_kws:
        # Category weight
        cat_weight = 10 if category == "hard_required" else (6 if category == "soft_required" else 3)
        total_max_points += cat_weight
        
        presence = classify_keyword_presence(kw, resume_text)
        confidence = get_keyword_confidence(kw, resume_text)
        
        # Track frequency to detect keyword stuffing
        kw_lower = kw.lower()
        freq = len(re.findall(r'\b' + re.escape(kw_lower) + r'\b', resume_text.lower()))
        keyword_freq[kw] = freq
        
        # 1. Base allowance
        base_allowance = 2
        
        # 2. Section placement allowance
        placement_allowance = 0
        in_summary = classify_keyword_presence(kw, sections["summary"]) == "present"
        in_skills = classify_keyword_presence(kw, sections["skills"]) == "present"
        
        if in_summary:
            placement_allowance += 1
        if in_skills:
            placement_allowance += 1
            
        # Count experience paragraph occurrences
        exp_paragraphs = [p for p in sections["experience"].split("\n") if p.strip()]
        exp_occurrences = sum(1 for p in exp_paragraphs if classify_keyword_presence(kw, p) == "present")
        placement_allowance += min(2, exp_occurrences)
        
        # 3. Resume length scaling
        word_count = len(resume_text.split())
        if word_count < 400:
            m_length = 1.0
        elif word_count <= 700:
            m_length = 1.3
        else:
            m_length = 1.6
            
        # 4. Category scaling
        if category == "hard_required":
            m_category = 1.5
        elif category == "soft_required":
            m_category = 1.2
        else:
            m_category = 1.0
            
        # Dynamic permitted threshold
        t_permitted = int((base_allowance + placement_allowance) * m_length * m_category)
        
        # 5. Graduated penalties
        if freq > t_permitted:
            excess_ratio = freq / t_permitted
            if excess_ratio > 1.5:
                credibility_deductions += 5
            elif excess_ratio > 1.2:
                credibility_deductions += 2
            
        if presence == "present":
            matched_count += 1
            # Presence base contribution (40%)
            kw_points = 0.40 * cat_weight
            
            # Placement contribution (30% exp, 20% summary, 10% skills)
            placement_bonus = 0
            if classify_keyword_presence(kw, sections["experience"]) == "present":
                placement_bonus += 0.30
            if classify_keyword_presence(kw, sections["summary"]) == "present":
                placement_bonus += 0.20
            if classify_keyword_presence(kw, sections["skills"]) == "present":
                placement_bonus += 0.10
            kw_points += (placement_bonus * cat_weight)
            
            # Confidence contribution (30% full, 15% adjacent, 5% exposure)
            conf_bonus = 0
            if confidence == "FULL_EXPERIENCE":
                conf_bonus += 0.30
            elif confidence == "ADJACENT_EXPERIENCE":
                conf_bonus += 0.15
            elif confidence == "EXPOSURE_ONLY":
                conf_bonus += 0.05
            kw_points += (conf_bonus * cat_weight)
            
            # Cap keyword points to category weight
            total_earned_points += min(kw_points, cat_weight)
            
            # Verify verb compliance
            is_compliant = check_keyword_verb_compliance(kw, resume_text, confidence)
            if not is_compliant:
                defensibility_deductions += 10
                credibility_deductions += 5
        else:
            # Check if it was injected illegally
            is_certification = "certif" in kw_lower or "certified" in kw_lower or kw_lower in ["pmp", "cissp", "itil", "csm"]
            if is_certification and freq > 0:
                defensibility_deductions += 40 # fabricated certification
            elif confidence == "NO_EXPERIENCE" and freq > 0:
                defensibility_deductions += 30 # fabricated experience
                
            # Model B: Certification equivalent credit
            if is_certification:
                strategy_generated = False
                if generated_strategies:
                    for strat in generated_strategies:
                        if strat in kw_lower or kw_lower in strat:
                            strategy_generated = True
                            break
                else:
                    for cert_key in CERTIFICATION_EQUIVALENTS.keys():
                        if cert_key in kw_lower or kw_lower in cert_key:
                            strategy_generated = True
                            break
                            
                if strategy_generated and confidence in ["FULL_EXPERIENCE", "ADJACENT_EXPERIENCE"]:
                    total_earned_points += (0.50 * cat_weight)
                
    # Normalizations
    ats_score = int((total_earned_points / total_max_points) * 100)
    keyword_match_score = int((matched_count / total_count) * 100)
    
    recruiter_credibility = max(60, 100 - credibility_deductions)
    interview_defensibility = max(50, 100 - defensibility_deductions)
    
    # Adjust for spelling sanitizations if any plain bullets in summary
    plain_bullets = len(re.findall(r'^[ \t]*[•*-⁃]', sections["summary"], re.MULTILINE))
    if plain_bullets > 0:
        recruiter_credibility = max(60, recruiter_credibility - 5)
        
    return {
        "score": min(100, ats_score),
        "keyword_match": min(100, keyword_match_score),
        "recruiter_credibility": min(100, recruiter_credibility),
        "interview_defensibility": min(100, interview_defensibility)
    }

def sanitize_output_text(text: str) -> str:
    """Rule F1-F2 text sanitization pass."""
    if not text:
        return text
        
    # Replace em-dashes and en-dashes in date ranges with 'to' or plain hyphen
    text = re.sub(r'(\b\d{4})\s*[\u2013\u2014\u2212-]\s*(\b\d{4}|\bPresent\b)', r'\1 to \2', text, flags=re.IGNORECASE)
    text = text.replace('\u2013', '-').replace('\u2014', ' - ')
    text = text.replace('\u2026', '...')
    text = text.replace('\u201c', '"').replace('\u201d', '"')
    text = text.replace('\u2018', "'").replace('\u2019', "'")
    
    for ud in ['\u2012', '\u2015', '\u2043']:
        text = text.replace(ud, '-')
        
    text = text.replace(' - - ', ' - ')
    return text

def build_full_gap_report(jd_text: str, resume_text: str, candidate_domain: str) -> dict:
    """deterministic Python gap analysis report."""
    jd_kws = extract_jd_keywords(jd_text)
    scores = calculate_ats_score(jd_text, resume_text)
    
    report = {
        "score_before": scores["score"],
        "keyword_match_before": scores["keyword_match"],
        "recruiter_credibility_before": scores["recruiter_credibility"],
        "interview_defensibility_before": scores["interview_defensibility"],
        "hard_required": [],
        "soft_required": [],
        "preferred": []
    }
    
    for cat in ["hard_required", "soft_required", "preferred"]:
        for kw in jd_kws[cat]:
            status = classify_keyword_presence(kw, resume_text)
            confidence = get_keyword_confidence(kw, resume_text)
            
            is_certification = "certif" in kw.lower() or "certified" in kw.lower() or kw.lower() in ["pmp", "cissp", "itil", "csm"]
            
            injectable = True
            reason = "Keyword mapping is aligned based on candidate skills database."
            
            if is_certification and status == "missing":
                injectable = False
                reason = "Certification is missing from base resume. Direct injection is blocked to prevent fabrication."
            elif confidence == "NO_EXPERIENCE":
                injectable = False
                reason = "No supporting experience or domain alignment found in resume."
                
            report[cat].append({
                "keyword": kw,
                "status": status,
                "confidence": confidence,
                "injectable": injectable,
                "reason": reason
            })
            
    return report
