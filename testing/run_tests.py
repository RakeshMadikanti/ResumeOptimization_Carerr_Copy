import os
import sys
import json
import subprocess
from pathlib import Path

# Job Descriptions for the 10 domains
JOB_DESCRIPTIONS = {
    "BA": (
        "Position: Senior Business Analyst\n"
        "About the Role:\n"
        "We are seeking a highly motivated Senior Business Analyst to bridge the gap between business needs and our technical execution teams. You will drive stakeholder engagements, analyze workflows, and define solutions for complex business processes.\n"
        "Responsibilities:\n"
        "- Conduct requirements elicitation sessions with business leaders, product managers, and subject matter experts.\n"
        "- Translate business requirements into clear, concise, and implementable user stories, epics, Business Requirements Documents (BRD), and Functional Requirements Documents (FRD).\n"
        "- Analyze current-state systems and design future-state workflows, performing gap analysis to identify process improvements.\n"
        "- Oversee User Acceptance Testing (UAT) planning, writing test cases, and coordinating validation cycles with business users.\n"
        "- Facilitate agile ceremonies, manage project backlogs, and prioritize features within Jira and Confluence.\n"
        "Requirements:\n"
        "- 5+ years of experience in business analysis within an Agile/Scrum product development environment.\n"
        "- Strong proficiency in writing user stories, mapping process diagrams, and managing backlogs.\n"
        "- Hands-on expertise using Jira, Confluence, and MS Visio.\n"
        "- Excellent communication, presentation, and stakeholder coordination skills."
    ),
    "Cloud": (
        "Position: Cloud DevOps Engineer\n"
        "About the Role:\n"
        "Our Infrastructure team is looking for a Cloud DevOps Engineer to maintain, scale, and optimize our cloud environment. You will automate delivery pipelines, improve system reliability, and maintain security compliance.\n"
        "Responsibilities:\n"
        "- Architect, build, and support highly available infrastructure on AWS cloud.\n"
        "- Design and implement automated CI/CD pipelines to build, test, and deploy applications using Jenkins, GitHub Actions, or GitLab CI.\n"
        "- Manage containerized applications using Kubernetes (EKS) and Docker across development and production environments.\n"
        "- Define infrastructure as code (IaC) templates using Terraform to ensure reproducible deployments.\n"
        "- Monitor system performance, configure alerts, and troubleshoot infrastructure issues.\n"
        "Requirements:\n"
        "- 4+ years of experience in DevOps, Cloud Engineering, or Systems Engineering.\n"
        "- Strong hands-on experience provisioning and managing AWS resources (EC2, S3, VPC, RDS, IAM).\n"
        "- Proficient in container orchestration with Kubernetes and writing Dockerfiles.\n"
        "- Experience with infrastructure automation using Terraform and scripting (Python, Bash)."
    ),
"DataScientist_Analysts": (
"Position: Senior Data Scientist / Business Intelligence Analyst\n"
"About the Role:\n"
"We are seeking a Senior Data Scientist / Business Intelligence Analyst to help drive strategic business decisions through advanced analytics, reporting, and data-driven insights. You will collaborate with business stakeholders, product teams, and leadership to identify opportunities, measure performance, and improve business outcomes.\n"
"Responsibilities:\n"
"- Analyze customer, operational, and product datasets to identify trends, risks, and growth opportunities.\n"
"- Partner with business stakeholders to define KPIs, reporting requirements, and measurement frameworks.\n"
"- Develop analytical models and reporting solutions that support strategic decision-making.\n"
"- Present insights and recommendations to cross-functional teams and senior leadership.\n"
"- Support experimentation, forecasting, and performance measurement initiatives across business functions.\n"
"Requirements:\n"
"- 5+ years of experience in analytics, business intelligence, or data science.\n"
"- Strong experience translating business questions into actionable insights.\n"
"- Experience building dashboards, reporting frameworks, and executive-level reporting.\n"
"- Proficiency with SQL and modern analytics tools.\n"
"- Experience working with large datasets and communicating findings to non-technical stakeholders."
),

"FullStack": (
"Position: Senior Full Stack Software Engineer\n"
"About the Role:\n"
"We are looking for a Senior Full Stack Software Engineer to design, build, and enhance enterprise applications supporting critical business operations. You will work closely with product managers, architects, and engineering teams to deliver scalable solutions.\n"
"Responsibilities:\n"
"- Design and develop scalable web applications supporting enterprise business processes.\n"
"- Build and maintain backend services and APIs supporting high-volume transactional workloads.\n"
"- Collaborate with product managers, designers, and engineers to deliver customer-facing functionality.\n"
"- Participate in architecture discussions and contribute to technology modernization initiatives.\n"
"- Improve application performance, reliability, security, and maintainability across production environments.\n"
"Requirements:\n"
"- 6+ years of experience in software engineering and application development.\n"
"- Experience building distributed applications and RESTful services.\n"
"- Strong knowledge of modern backend development frameworks and design patterns.\n"
"- Experience working with relational databases and scalable system architectures.\n"
"- Experience participating in Agile software delivery environments."
),
    "IT_ChangeManagement": (
        "Position: IT Change & Release Manager\n"
        "About the Role:\n"
        "We are seeking an IT Change and Release Manager to govern our production environment changes and manage release deployments. You will ensure service stability and compliance across all system deployments.\n"
        "Responsibilities:\n"
        "- Facilitate the Change Advisory Board (CAB) reviews, evaluating change requests for risk, impact, and scheduling conflicts.\n"
        "- Oversee the release lifecycle, coordinating release schedules, deployments, and validation cycles across development, QA, and production.\n"
        "- Manage and track change records and release pipelines within ServiceNow, ensuring strict compliance with ITIL service management frameworks.\n"
        "- Partner with dev teams to align CI/CD automated release deployments with change management policies.\n"
        "- Lead post-implementation reviews (PIR) and incident response coordination for deployment failures.\n"
        "Requirements:\n"
        "- 5+ years of experience managing IT change, release coordination, or IT service operations.\n"
        "- Deep understanding of ITIL frameworks (ITIL v3 or v4 certification preferred).\n"
        "- Hands-on experience administering change tickets, release pipelines, and CMDB assets in ServiceNow.\n"
        "- Strong leadership, coordination, and incident management skills."
    ),
    "Network": (
        "Position: Enterprise Network Security Engineer\n"
        "About the Role:\n"
        "We are seeking a Network Security Engineer to protect our global corporate network infrastructure. You will manage network connectivity, secure network borders, and monitor traffic anomalies.\n"
        "Responsibilities:\n"
        "- Configure, monitor, and troubleshoot Cisco enterprise routing and switching platforms.\n"
        "- Manage secure remote access, site-to-site VPN tunnels, and firewall administration.\n"
        "- Administer core network services including DNS, DHCP, and IP address management (IPAM).\n"
        "- Configure and optimize enterprise firewall rule sets to protect network endpoints.\n"
        "- Monitor security events and investigate traffic anomalies using Splunk dashboards and alerts.\n"
        "Requirements:\n"
        "- 5+ years of experience in network engineering and network security operations.\n"
        "- Professional certification such as CCNP or CISSP is highly preferred.\n"
        "- Strong troubleshooting experience with Cisco IOS, routing protocols (BGP, OSPF), and VPN setup.\n"
        "- Hands-on experience configuring firewalls and analyzing security logs in Splunk."
    ),
    "PowerBI": (
        "Position: Lead Power BI Developer\n"
        "About the Role:\n"
        "We are looking for a Lead Power BI Developer to lead the development of our business intelligence reporting ecosystem. You will design data models and build enterprise dashboards to assist operational decision-making.\n"
        "Responsibilities:\n"
        "- Develop and maintain scalable dashboards, reports, and interactive visualizations in Power BI.\n"
        "- Write complex DAX (Data Analysis Expressions) measures, calculated columns, and queries to support data logic.\n"
        "- Design data models, star schemas, and ETL pipelines in Power Query to connect multiple data sources.\n"
        "- Query SQL databases to validate source-to-target data mappings and ensure data integrity.\n"
        "- Train business stakeholders on report usage and administer Power BI workspaces and security.\n"
        "Requirements:\n"
        "- 4+ years of dedicated development experience using Power BI and DAX.\n"
        "- Proficient in writing optimized SQL queries and performing data modeling.\n"
        "- Experience with data visualization design principles and connecting to diverse data sources."
    ),
    "QA": (
        "Position: Senior QA Automation Engineer\n"
        "About the Role:\n"
        "We are seeking a Senior QA Automation Engineer to lead our quality assurance efforts. You will design automation test suites, manage test cycles, and ensure product quality across web and API services.\n"
        "Responsibilities:\n"
        "- Design, build, and maintain automation testing frameworks using Selenium, Cypress, or Playwright.\n"
        "- Perform manual testing, regression testing, and exploratory testing on new features.\n"
        "- Design, document, and execute comprehensive test plans and test cases.\n"
        "- Test and validate REST APIs using Postman and automate API testing flows.\n"
        "- Integrate automated tests into the CI/CD deployment pipeline.\n"
        "Requirements:\n"
        "- 5+ years of experience in software quality assurance and test automation.\n"
        "- Proficient in writing test automation scripts in Java, Python, or JavaScript.\n"
        "- Strong experience with test automation libraries (Cypress, Selenium) and Postman.\n"
        "- Solid understanding of test planning, regression suites, and bug reporting."
    ),
"SAP": (
"Position: Senior SAP FICO Consultant\n"
"About the Role:\n"
"We are seeking a Senior SAP FICO Consultant to support enterprise finance transformation initiatives and ERP process optimization efforts. You will work closely with finance leaders, business users, and technical teams to improve financial operations and reporting capabilities.\n"
"Responsibilities:\n"
"- Support financial accounting operations and ERP process improvements across enterprise environments.\n"
"- Partner with finance stakeholders to gather requirements and align SAP capabilities with business needs.\n"
"- Support month-end close activities, reconciliation workflows, and financial reporting processes.\n"
"- Participate in configuration, testing, deployment, and production support activities.\n"
"- Analyze business processes and recommend improvements across finance and accounting operations.\n"
"Requirements:\n"
"- 5+ years of SAP ERP experience supporting finance-related business functions.\n"
"- Experience supporting financial accounting and reporting processes.\n"
"- Strong understanding of enterprise finance operations and ERP workflows.\n"
"- Experience working with business users, finance teams, and technical stakeholders.\n"
"- Experience supporting configuration, testing, and production support activities."
),

"Workday": (
"Position: Workday Integration Consultant\n"
"About the Role:\n"
"We are seeking a Workday Integration Consultant to support enterprise HR technology initiatives and integration delivery across multiple business systems. You will collaborate with HR, payroll, finance, and external vendors to ensure reliable data exchange and business process continuity.\n"
"Responsibilities:\n"
"- Design, develop, and support integrations between Workday and enterprise applications.\n"
"- Partner with HR, payroll, finance, and third-party vendors to deliver integration solutions supporting business operations.\n"
"- Develop data transformation logic, mapping specifications, and interface documentation for inbound and outbound integrations.\n"
"- Troubleshoot integration issues, perform root cause analysis, and support production deployment activities.\n"
"- Support reporting, testing, data validation, and migration activities across Workday environments.\n"
"Requirements:\n"
"- 4+ years of experience supporting enterprise HRIS or Workday integration environments.\n"
"- Strong understanding of integration concepts, data transformation, and interface design.\n"
"- Experience working with XML, web services, APIs, file-based integrations, and data mapping processes.\n"
"- Experience supporting testing, deployment, and production support activities.\n"
"- Strong communication and stakeholder collaboration skills."
)
}

# Base Resumes selected for each domain
BASE_RESUMES = {
    "BA": "Aishwarya_Base Resume.docx",
    "Cloud": "Sai Ram_ Base Resume.docx",
    "DataScientist_Analysts": "Madhu_Base_Data_Analyst_Base_Resume.docx",
    "FullStack": "Akhil_Java Base Resume.docx",
    "IT_ChangeManagement": "Sri Harsha_Base Resume .docx",
    "Network": "Bhasker Networkengineer_ Base Resume.docx",
    "PowerBI": "Vamshi_Badinehal Base Resume.docx",
    "QA": "Teja_QA_Base Resume.docx",
    "SAP": "Anzum Aman_SAP Base Resume.docx",
    "Workday": "Prashanth M - Workday-Base Resume.docx"
}

def load_env():
    """Load OPENAI_API_KEY from .env file if present."""
    base_dir = Path(__file__).resolve().parent.parent
    env_file = base_dir / ".env"
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip()

def run_tests():
    load_env()
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("ERROR: OPENAI_API_KEY not found in .env or system environment.")
        sys.exit(1)

    # Setup directories
    test_dir = Path(__file__).resolve().parent
    base_resumes_dir = test_dir / "Clouvr Enrolled Base Resumes"
    
    jd_dir = test_dir / "job_descriptions"
    output_dir = test_dir / "outputs"
    reports_dir = test_dir / "reports"
    
    for d in [jd_dir, output_dir, reports_dir]:
        d.mkdir(parents=True, exist_ok=True)
        
    results = []

    print("=" * 70)
    print("STARTING BATCH OPTIMIZATION RUN ACROSS 10 DOMAINS")
    print("=" * 70)
    
    python_cmd = sys.executable if sys.executable else "python"
    optimizer_path = test_dir.parent / "scripts" / "optimizer.py"

    for idx, (domain, jd) in enumerate(JOB_DESCRIPTIONS.items(), 1):
        resume_name = BASE_RESUMES[domain]
        resume_path = base_resumes_dir / domain / resume_name
        
        if not resume_path.exists():
            print(f"[{idx}/10] Skipping {domain}: Resume file not found at {resume_path}")
            continue
            
        print(f"[{idx}/10] Processing {domain} (Resume: {resume_name})...")
        
        # Save Job Description to file
        jd_path = jd_dir / f"{domain}_jd.txt"
        with open(jd_path, "w", encoding="utf-8") as f:
            f.write(jd)
            
        output_path = output_dir / f"{domain}_optimized.docx"
        prompt_instruction = "highlight experience relevant to the job requirements."
        
        # Run optimizer
        cmd = [
            python_cmd,
            str(optimizer_path),
            str(resume_path),
            str(output_path),
            str(jd_path),
            prompt_instruction,
            "openai",
            "gpt-5.2",
            "pro"
        ]
        
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=180, check=False)
            
            if res.returncode != 0:
                print(f"  -> FAILED: optimizer.py exit code {res.returncode}")
                print(f"  -> Stderr: {res.stderr}")
                results.append({
                    "domain": domain,
                    "resume": resume_name,
                    "status": "FAIL",
                    "error": res.stderr or "Non-zero exit code"
                })
                continue
                
            # Parse output
            try:
                out_data = json.loads(res.stdout)
            except json.JSONDecodeError:
                # Try finding JSON block in stdout
                start = res.stdout.find('{')
                end = res.stdout.rfind('}') + 1
                if start != -1 and end != -1:
                    out_data = json.loads(res.stdout[start:end])
                else:
                    raise Exception("No JSON object found in stdout: " + res.stdout)
                    
            if out_data.get("status") == "success":
                changes = out_data.get("changes", 0)
                report = out_data.get("report", "")
                
                # Save intelligence report
                report_path = reports_dir / f"{domain}_report.txt"
                with open(report_path, "w", encoding="utf-8") as f:
                    f.write(report)
                    
                # Extract scores from report
                ats_score = "N/A"
                kw_match = "N/A"
                credibility = "N/A"
                defensibility = "N/A"
                
                for line in report.split("\n"):
                    if "ATS Matching Score:" in line:
                        ats_score = line.split("Score:")[-1].split("/")[0].strip()
                    elif "Keyword Match Score:" in line:
                        kw_match = line.split("Score:")[-1].split("/")[0].strip()
                    elif "Recruiter Credibility Score:" in line:
                        credibility = line.split("Score:")[-1].split("/")[0].strip()
                    elif "Interview Defensibility:" in line:
                        defensibility = line.split("Defensibility:")[-1].split("/")[0].strip()
                
                print(f"  -> SUCCESS! Changes: {changes}, ATS Score: {ats_score}")
                results.append({
                    "domain": domain,
                    "resume": resume_name,
                    "status": "SUCCESS",
                    "changes": changes,
                    "ats_score": ats_score,
                    "keyword_match": kw_match,
                    "recruiter_credibility": credibility,
                    "interview_defensibility": defensibility,
                    "report_file": f"testing/reports/{domain}_report.txt",
                    "output_file": f"testing/outputs/{domain}_optimized.docx"
                })
            else:
                msg = out_data.get("message", "Unknown error")
                print(f"  -> FAILED: {msg}")
                results.append({
                    "domain": domain,
                    "resume": resume_name,
                    "status": "FAIL",
                    "error": msg
                })
        except Exception as e:
            print(f"  -> ERROR: {str(e)}")
            results.append({
                "domain": domain,
                "resume": resume_name,
                "status": "FAIL",
                "error": str(e)
            })

    # Write consolidated markdown report
    write_summary_report(test_dir / "test_results.md", results)
    print("=" * 70)
    print(f"BATCH RUN COMPLETE! Consolidated report written to: {test_dir / 'test_results.md'}")
    print("=" * 70)

def write_summary_report(output_file, results):
    """Write final consolidated test run report."""
    lines = [
        "# Resume Transformation Engine Batch Test Results",
        "",
        "This report summarizes the ATS resume transformation engine's performance across 10 distinct professional domains. For each domain, one base resume was optimized against a realistic domain-specific job description in `pro` mode.",
        "",
        "## Performance Metrics Summary",
        "",
        "| Domain | Base Resume | Status | ATS Score | Keyword Match | Recruiter Credibility | Interview Defensibility | Changes | Report Link |",
        "| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |"
    ]
    
    for r in results:
        if r["status"] == "SUCCESS":
            lines.append(
                f"| **{r['domain']}** | {r['resume']} | 🟢 SUCCESS | {r['ats_score']}/100 | {r['keyword_match']}% | {r['recruiter_credibility']}/100 | {r['interview_defensibility']}/100 | {r['changes']} | [View Report]({r['report_file']}) |"
            )
        else:
            lines.append(
                f"| **{r['domain']}** | {r['resume']} | 🔴 FAIL | N/A | N/A | N/A | N/A | N/A | *Error: {r.get('error', 'unknown')}* |"
            )
            
    lines.extend([
        "",
        "## Next Steps",
        "To review detailed logs and quality checklists for any successful transformation, open the respective file in the `testing/reports/` directory.",
        ""
    ])
    
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

if __name__ == "__main__":
    run_tests()
