DEFAULT_PROFILE = {
    "full_name": "",
    "headline": "Final-year BSc student (UBCO) with hands-on Microsoft 365, Intune and Azure IT support experience",
    "education": [
        "Bachelor of Science, General Studies - University of British Columbia Okanagan (final year)",
        "Computer Systems Technician diploma - Sheridan College",
    ],
    "experience": [
        {
            "title": "IT Support Specialist",
            "company": "Signal Technologies Canada / Signal Automotive",
            "dates": "June 2022 - May 2023",
            "highlights": [
                "Administered Microsoft 365, Intune, Entra ID, Defender and SharePoint",
                "Managed ~100 Windows and Mac devices for 60+ hybrid employees",
                "Apple Business Manager and MDM enrolment; Conditional Access and compliance policies",
                "Azure virtual machines, storage and cloud services",
                "User account administration, access management and Confluence documentation",
            ],
        }
    ],
    "certifications": [
        "Microsoft 365 Certified: Endpoint Administrator Associate (MD-102)",
        "Google IT Support / System Administration training",
        "Microsoft Azure training and certifications",
        "Cisco Introduction to Cybersecurity",
    ],
    "skills": [
        "Microsoft 365", "Microsoft Intune", "Microsoft Entra ID", "Azure", "Windows", "macOS",
        "MDM", "Conditional Access", "Microsoft Defender", "SharePoint", "Documentation",
        "Ticketing / Help Desk", "Hardware Support", "Cybersecurity",
    ],
    "target_roles": [
        "IT Support Specialist", "IT Support Analyst", "Systems Administrator", "Junior Systems Administrator",
        "IT Infrastructure Analyst", "Desktop Support Analyst", "Service Desk Analyst (Level 2)",
        "Microsoft 365 Administrator", "Endpoint Administrator", "Intune Administrator", "Cloud Support Associate",
        "Azure Administrator (Junior)", "IT Operations Analyst", "Technical Support Engineer",
        "Infrastructure Support Specialist",
    ],
    "target_locations": [
        "Vancouver", "Burnaby", "Surrey", "Richmond", "Coquitlam", "New Westminster", "Kelowna",
        "West Kelowna", "Victoria", "Kamloops", "Other BC", "Remote (Canada)",
    ],
}

DEFAULT_SETTINGS = {
    "targets": {
        "jobs_discovered": 10,
        "contacts_identified": 5,
        "requests_sent": 5,
        "applications": 3,
        "follow_ups": 3,
        "skill_minutes": 45,
    },
    "models": {
        "research": "claude-opus-5-5",
        "writing": "claude-sonnet-5-5",
        "extraction": "gpt-6-luna",
    },
    "email_reminders": True,
}

# Real employers that hire IT staff in BC / remotely in Canada. Details are filled in by research, never assumed.
SEED_COMPANIES = [
    ("BC Public Service", "Provincial government"), ("Government of Canada", "Federal government"),
    ("City of Vancouver", "Municipal government"), ("City of Kelowna", "Municipal government"),
    ("City of Surrey", "Municipal government"), ("City of Burnaby", "Municipal government"),
    ("City of Victoria", "Municipal government"), ("City of Kamloops", "Municipal government"),
    ("University of British Columbia", "Higher education"), ("Simon Fraser University", "Higher education"),
    ("University of Victoria", "Higher education"), ("BCIT", "Higher education"),
    ("Okanagan College", "Higher education"), ("Thompson Rivers University", "Higher education"),
    ("Interior Health", "Healthcare"), ("Fraser Health", "Healthcare"),
    ("Vancouver Coastal Health", "Healthcare"), ("Provincial Health Services Authority", "Healthcare"),
    ("Island Health", "Healthcare"), ("ICBC", "Insurance"), ("BC Hydro", "Utilities"),
    ("FortisBC", "Utilities"), ("TELUS", "Telecommunications"), ("Rogers", "Telecommunications"),
    ("Vancity", "Financial services"), ("Interior Savings", "Financial services"),
    ("Coast Capital", "Financial services"), ("Teck Resources", "Mining"),
    ("lululemon", "Retail"), ("Hootsuite", "Technology"), ("D2L", "Technology"),
    ("Samsara", "Technology"), ("Wealthsimple", "Financial technology"), ("1Password", "Technology"),
    ("Trulioo", "Technology"), ("Benevity", "Technology"), ("Dialpad", "Technology"),
]

# Verified public job-board feeds (ATS) for employers above or remote-Canada employers.
ATS_FEEDS = [
    ("greenhouse", "hootsuite", "Hootsuite"), ("greenhouse", "d2l", "D2L"), ("greenhouse", "later", "Later"),
    ("greenhouse", "dialpad", "Dialpad"), ("greenhouse", "ritual", "Ritual"), ("greenhouse", "samsara", "Samsara"),
    ("ashby", "wealthsimple", "Wealthsimple"), ("ashby", "1password", "1Password"), ("ashby", "trulioo", "Trulioo"),
    ("ashby", "klue", "Klue"), ("ashby", "benevity", "Benevity"), ("ashby", "hopper", "Hopper"),
]
