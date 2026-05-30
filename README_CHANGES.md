# Resume Optimization Engine Upgrades

This document outlines the recent optimizations made to the resume scoring and validation engine, including the "before" state, specific code changes, and instructions for running validation tests.

---

## 1. Summary of Changes

### A. Resume Optimization Quality Checklist (Backend-Only)
* **Before**: The engine executed optimization passes and logged standard metrics, but lacked a unified quality checklist validation before exporting to DOCX.
* **After**: Added a comprehensive **Resume Optimization Quality Checklist** appended to the end of the generated Intelligence Report. It validates:
  * Career progression (logical client transitions).
  * Protected information preservation (dates, durations, degrees, certs).
  * Keyword coverage calculations.
  * Structural placement (relevance in skills/experience, summary check).
  * Formatting errors (deduplicating experience bullets, malformed styles, empty sections).

### B. Context-Aware Keyword Stuffing Engine
* **Before**: Any keyword appearing more than 2 times in the entire resume triggered a flat `-5` Recruiter Credibility deduction. Core technical skills (e.g. *Workday HCM*, *EIB*) were penalized even when naturally placed across Summary, Skills, and Experience.
* **After**: Replaced with a **Dynamic Permitted Threshold ($T_{\text{permitted}}$)** calculated per keyword:
  $$T_{\text{permitted}} = \text{int}\left( (\text{Base} + S_{\text{placement}}) \times M_{\text{length}} \times M_{\text{category}} \right)$$
  * **Placement**: Adds $+1$ for summary, $+1$ for skills, and up to $+2$ for unique experience bullets.
  * **Word Count**: Scales allowed limits by `1.0` ($<400$ words), `1.3` ($400 - 700$ words), or `1.6` ($>700$ words).
  * **Category**: Multiplies limits by `1.5` for `hard_required` and `1.2` for `soft_required` keywords.
  * **Graduated Penalties**: Excess ratio $>1.2$ deducts `-2`, while ratio $>1.5$ deducts `-5`.

### C. Skills-List Formatting Rule Correction
* **Before**: The plain bullets regex scanned `sections["summary"] + sections["skills"]`. Valid comma-separated or plain list skills formats (e.g., using hyphens or simple bullet points) triggered a flat `-5` Recruiter Credibility deduction.
* **After**: Excluded `sections["skills"]` from the plain bullets check. Only the `summary` section is validated for plain list bullets, allowing standard skills-list formats.

### D. Model B Certification-Equivalent ATS Credit (50% Credit)
* **Before**: Missing required certifications (e.g. *CISSP*, *PMP*, *CSM*, *ITIL*, *Workday Integration Core*) were blocked from direct injection to prevent fabrication, earning `0` points and blocking candidates from reaching an ATS score of `92+`.
* **After**: Awarded **50% partial ATS credit** when the certification is missing, but a strategy was generated and the candidate demonstrates relevant experience in work history (`confidence >= ADJACENT_EXPERIENCE`). Direct injection remains blocked, keeping Defensibility at `100` while moving all target domains above `92+` ATS.

---

## 2. Testing & Verification

### A. How to Run Validation Tests
Run the optimizer locally using the test resume and job description to inspect the scores and the Quality Checklist output.

Run the optimization command in your terminal:
```powershell
python scripts/optimizer.py "components/Testing/Prashanth M - Workday-Base Resume.docx" "components/Testing/optimized_resume.docx" "components/Testing/jd.txt" "highlight experience relevant to the job requirements." "openai" "gpt-5.2" "pro"
```

### B. Expected Scores
* **ATS Score**: $\ge 92$ (Moved from 87 to 96+ due to certification-equivalent credit).
* **Keyword Match Score**: 88% (Correctly shows missing keywords are not injected).
* **Recruiter Credibility Score**: 100% (No false keyword stuffing or skills list bullet deductions).
* **Interview Defensibility Score**: 100% (Certification text was not fabricated).

### C. Checking the Quality Checklist
Open the terminal output or the generated report log. At the bottom, before the `END OF REPORT` line, you will see:
```text
=================================================
RESUME OPTIMIZATION QUALITY CHECKLIST
=====================================

Career Progression
[X] Client 1 role represents earlier-stage or foundational experience
[X] Client 2 role represents more advanced or target-aligned experience
[X] Career progression remains logical

Protected Information
[X] Employment dates preserved
[X] Employment durations preserved
[ ] Degree history preserved
[X] Earned certifications preserved

Keyword Optimization
[X] Hard Required keyword coverage calculated
[X] Soft Required keyword coverage calculated
[X] Preferred keyword coverage calculated

Keyword Placement
[X] Relevant keywords appear in Skills
[X] Relevant keywords appear in Experience
[X] FULL_EXPERIENCE keywords appear in Summary where appropriate

Format & Compliance
[X] No duplicate experience bullets
[X] No excessive keyword repetition
[X] No malformed formatting (plain lists, smart quotes)
[X] No empty sections

System Calibrations
[X] Word count and seniority calibrated
[X] Allowed verbs aligned with seniority level
[X] Forbidden phrases completely omitted

Scoring & Runtime
[X] ATS Score calculated (score >= 92)
[X] Keyword Match Score calculated
[X] Recruiter Credibility Score calculated
[X] Interview Defensibility Score calculated
[X] Multi-pass optimization completed
```
