// Central mock data. Shapes match the API contract exactly so a real FastAPI
// backend can swap in behind the api-client with zero component changes.

// ============= Types — mirror /api contract =============

export type User = {
  id: string;
  name: string;
  email: string;
  role: "student";
  consent: { gmail: boolean; github: boolean; alumni_data: boolean };
};

export type ProjectRef = { name: string; description: string; tech: string[]; url?: string };
export type Experience = { title: string; org: string; start: string; end: string; description: string };
export type Education = { degree: string; institution: string; year: string; gpa: number };

export type Profile = {
  user_id: string;
  headline: string;
  university: string;
  grad_year: number | null;
  research_interests: string[];
  skills: string[];
  experience: Experience[];
  education: Education[];
  projects: ProjectRef[];
  github_url: string;
  preferences: {
    domains: string[];
    work_mode: "remote" | "onsite" | "hybrid" | "any";
    stipend_min: number;
    duration_months: number;
    locations: string[];
    target_companies: string[];
  };
  profile_strength: number; // 0–100
  gaps: string[];
};

export type CompanySummary = { id: string; name: string; domain: string };

export type PostingStatus = "active" | "stale";

export type Posting = {
  id: string;
  company: CompanySummary;
  title: string;
  description: string;
  requirements: string[];
  location: string;
  work_mode: "remote" | "onsite" | "hybrid" | "any";
  stipend: number;
  source: string;
  source_url: string;
  posted_at: string;
  last_seen_at: string;
  status: PostingStatus;
  ghost_score: number;
  is_ghost: boolean;
};

export type Match = {
  posting: Posting;
  match_score: number;
  match_explanation: string;
  matched_skills: string[];
  missing_skills: string[];
  response_likelihood: number;
  expected_value: number;
  ghost_score: number;
  is_ghost: boolean;
  created_at: string;
};

export type ArtifactType = "resume" | "cover_letter" | "email" | "followup" | "referral_intro" | "research_pitch";

export type Artifact = {
  id: string;
  application_id: string;
  type: ArtifactType;
  content: string;
  ats_score: number;
  missing_keywords: string[];
  grounding_score: number;
  predicted_response: number;
  version: number;
  generated_at: string;
};

export type ApplicationStatus =
  | "saved" | "applied" | "viewed" | "responded"
  | "interview" | "offer" | "rejected" | "ghosted";

export type Channel = "portal" | "email" | "referral";

export type Application = {
  id: string;
  posting_id: string;
  posting: { id: string; title: string; company_name: string };
  channel: Channel;
  status: ApplicationStatus;
  artifacts: Artifact[];
  predicted_response_prob: number;
  applied_at: string;
  last_status_at: string;
  outcome?: "offer" | "rejected" | "ghosted" | "interview";
};

export type Contact = {
  id: string;
  name: string;
  company_id: string;
  company_name: string;
  role: string;
  university: string;
  grad_year: number;
  linkedin: string;
  relationship: "alumni" | "second_degree" | "unknown";
};

export type ReferralStatus = "suggested" | "requested" | "accepted" | "declined" | "no_response";

export type Referral = {
  id: string;
  posting_id: string;
  company_id: string;
  contact: Contact;
  status: ReferralStatus;
  intro_artifact_id: string | null;
  created_at: string;
};

export type DashboardSummary = {
  pipeline: {
    saved: number; applied: number; viewed: number; responded: number;
    interview: number; offer: number; rejected: number; ghosted: number;
  };
  response_rate: number;
  time_saved_hours: number;
  ghosts_avoided: number;
  platform_iq: number;
  iq_trend: { date: string; value: number }[];
};

export type NotificationType = "followup_due" | "status_change" | "new_match" | "response" | "prep_ready";

export type Notification = {
  id: string;
  type: NotificationType;
  content: string;
  read: boolean;
  created_at: string;
};

// ============= Research types =============

export type ResearchOpportunity = {
  id: string;
  professor_name: string;
  institution: string;
  lab_name: string;
  research_area: string;
  fit_score: number; // 0..1
  matched_skills: string[];
  fit_explanation: string;
  professor_email: string;
  recent_paper?: { title: string; year: number };
  region: string;
};

export type ResearchOutreachStatus =
  | "suggested" | "drafted" | "contacted" | "replied" | "accepted" | "declined" | "no_response";

export type ResearchPitch = {
  id: string;
  opportunity_id: string;
  subject: string;
  body: string;
  generated_at: string;
};

export type ResearchOutreach = {
  id: string;
  opportunity_id: string;
  opportunity: { professor_name: string; institution: string; lab_name: string };
  status: ResearchOutreachStatus;
  pitch_id: string | null;
  contacted_at: string | null;
  replied_at: string | null;
  last_status_at: string;
};

// ============= Data =============

export const user: User = {
  id: "u_1",
  name: "Maya Chen",
  email: "maya@berkeley.edu",
  role: "student",
  consent: { gmail: true, github: true, alumni_data: true },
};

export const profile: Profile = {
  user_id: "u_1",
  headline: "EECS @ Berkeley · CRDT editors, inference tooling",
  university: "UC Berkeley",
  grad_year: 2027,
  research_interests: ["Distributed systems", "Programming languages", "ML systems"],
  skills: ["TypeScript", "React", "Python", "PyTorch", "Postgres", "Tailwind", "Rust", "Figma"],
  experience: [
    {
      title: "Open-source contributor",
      org: "Replicate",
      start: "2024-09",
      end: "present",
      description: "Shipped 14 PRs to inference tooling; cut p95 latency on a hot serving path by 38%.",
    },
  ],
  education: [
    { degree: "B.S. EECS", institution: "UC Berkeley", year: "2023–2027", gpa: 3.84 },
  ],
  projects: [
    { name: "lattice.dev", description: "Realtime collaborative whiteboard, 2k weekly users.", tech: ["TypeScript", "WebRTC", "Postgres"], url: "https://github.com/maya/lattice" },
    { name: "ghostfinder", description: "Detects dead job postings using listing-decay signals.", tech: ["Python", "FastAPI"], url: "https://github.com/maya/ghostfinder" },
    { name: "rustpad-mini", description: "Tiny CRDT editor written in Rust + WASM.", tech: ["Rust", "WASM"], url: "https://github.com/maya/rustpad-mini" },
  ],
  github_url: "https://github.com/maya",
  preferences: {
    domains: ["AI infra", "Developer tools", "Fintech"],
    work_mode: "hybrid",
    stipend_min: 6500,
    duration_months: 3,
    locations: ["San Francisco", "New York", "Remote"],
    target_companies: ["Stripe", "Linear", "Anthropic", "Vercel", "Ramp"],
  },
  profile_strength: 78,
  gaps: ["Add one shipped ML project", "Quantify impact on lattice.dev", "Connect LinkedIn for warmer intros"],
};

const c = (id: string, name: string, domain: string): CompanySummary => ({ id, name, domain });

const C = {
  linear: c("c_linear", "Linear", "linear.app"),
  stripe: c("c_stripe", "Stripe", "stripe.com"),
  vercel: c("c_vercel", "Vercel", "vercel.com"),
  anthropic: c("c_anthropic", "Anthropic", "anthropic.com"),
  ramp: c("c_ramp", "Ramp", "ramp.com"),
  notion: c("c_notion", "Notion", "notion.so"),
  figma: c("c_figma", "Figma", "figma.com"),
  arc: c("c_arc", "The Browser Co.", "arc.net"),
};

const today = "2026-06-15";

export const postings: Posting[] = [
  { id: "p_1", company: C.linear, title: "Software Engineer Intern, Editor", description: "Work on the collaborative editor at the heart of Linear.", requirements: ["TypeScript", "React", "CRDTs"], location: "San Francisco", work_mode: "hybrid", stipend: 9500, source: "linear/careers", source_url: "https://linear.app/careers", posted_at: "2026-06-02", last_seen_at: today, status: "active", ghost_score: 0.08, is_ghost: false },
  { id: "p_2", company: C.anthropic, title: "Research Engineer Intern, Inference", description: "Optimize serving pipelines for frontier models.", requirements: ["Python", "CUDA", "Distributed systems"], location: "San Francisco", work_mode: "onsite", stipend: 11000, source: "anthropic/careers", source_url: "https://www.anthropic.com/careers", posted_at: "2026-06-08", last_seen_at: today, status: "active", ghost_score: 0.05, is_ghost: false },
  { id: "p_3", company: C.stripe, title: "Software Engineer Intern, Issuing", description: "Build merchant tools on the issuing platform.", requirements: ["Ruby", "Postgres"], location: "New York", work_mode: "hybrid", stipend: 9800, source: "stripe/jobs", source_url: "https://stripe.com/jobs", posted_at: "2026-05-29", last_seen_at: today, status: "active", ghost_score: 0.18, is_ghost: false },
  { id: "p_4", company: C.vercel, title: "Frontend Intern, Dashboard", description: "Ship the developer dashboard end to end.", requirements: ["React", "Next.js"], location: "Remote", work_mode: "remote", stipend: 8500, source: "vercel/careers", source_url: "https://vercel.com/careers", posted_at: "2026-04-11", last_seen_at: "2026-05-02", status: "stale", ghost_score: 0.78, is_ghost: true },
  { id: "p_5", company: C.ramp, title: "Software Engineer Intern, Platform", description: "Internal platform team work.", requirements: ["TypeScript", "Postgres"], location: "New York", work_mode: "hybrid", stipend: 10500, source: "ramp/careers", source_url: "https://ramp.com/careers", posted_at: "2026-06-10", last_seen_at: today, status: "active", ghost_score: 0.11, is_ghost: false },
  { id: "p_6", company: C.notion, title: "Software Engineer Intern, AI", description: "Build features on the AI surface inside Notion.", requirements: ["TypeScript", "LLMs"], location: "San Francisco", work_mode: "hybrid", stipend: 9200, source: "notion/careers", source_url: "https://www.notion.so/careers", posted_at: "2026-06-05", last_seen_at: today, status: "active", ghost_score: 0.13, is_ghost: false },
  { id: "p_7", company: C.figma, title: "Design Engineer Intern", description: "Bridge design + code on the Figma surface.", requirements: ["React", "Design systems"], location: "San Francisco", work_mode: "hybrid", stipend: 9000, source: "figma/careers", source_url: "https://www.figma.com/careers", posted_at: "2026-03-20", last_seen_at: "2026-05-01", status: "stale", ghost_score: 0.66, is_ghost: true },
  { id: "p_8", company: C.arc, title: "Browser Intern, Web Platform", description: "Work on the surface of a new kind of browser.", requirements: ["TypeScript", "Web platform"], location: "Remote", work_mode: "remote", stipend: 8800, source: "thebrowser/careers", source_url: "https://thebrowser.company/careers", posted_at: "2026-06-12", last_seen_at: today, status: "active", ghost_score: 0.09, is_ghost: false },
];

const findPosting = (id: string) => postings.find(p => p.id === id)!;

export const matches: Match[] = [
  { posting: findPosting("p_1"), match_score: 0.94, match_explanation: "Your rustpad-mini CRDT work maps almost exactly to the editor team's open problems. Cohort signal: 3 of 5 Berkeley alums got a reply within 7 days.", matched_skills: ["TypeScript", "React", "Rust"], missing_skills: ["Yjs"], response_likelihood: 0.42, expected_value: 0.39, ghost_score: 0.08, is_ghost: false, created_at: today },
  { posting: findPosting("p_2"), match_score: 0.87, match_explanation: "Replicate inference PRs are directly relevant to the serving team. Cohort signal: 2 of 4 batchmates with PyTorch work converted to a screen.", matched_skills: ["Python", "PyTorch"], missing_skills: ["CUDA"], response_likelihood: 0.31, expected_value: 0.34, ghost_score: 0.05, is_ghost: false, created_at: today },
  { posting: findPosting("p_3"), match_score: 0.71, match_explanation: "Strong on backend fundamentals; Ruby is a stretch. Cohort signal: cold applies to Issuing rarely move — referral recommended.", matched_skills: ["Postgres", "TypeScript"], missing_skills: ["Ruby"], response_likelihood: 0.22, expected_value: 0.21, ghost_score: 0.18, is_ghost: false, created_at: today },
  { posting: findPosting("p_4"), match_score: 0.69, match_explanation: "Strong fit, but the listing shows classic ghost signals (open 8 weeks, no recruiter activity). Low reply rate: 0 of 5 batchmates heard back.", matched_skills: ["React", "TypeScript"], missing_skills: ["Next.js"], response_likelihood: 0.04, expected_value: 0.03, ghost_score: 0.78, is_ghost: true, created_at: today },
  { posting: findPosting("p_5"), match_score: 0.82, match_explanation: "Lattice's realtime stack lines up with the platform team's roadmap. Cohort signal: 4 of 6 platform-team applicants got at least a recruiter screen.", matched_skills: ["TypeScript", "Postgres"], missing_skills: ["Temporal"], response_likelihood: 0.36, expected_value: 0.32, ghost_score: 0.11, is_ghost: false, created_at: today },
  { posting: findPosting("p_6"), match_score: 0.78, match_explanation: "Your AI inference work and product taste from lattice.dev. Cohort signal: 2 of 5 batchmates got a phone screen.", matched_skills: ["TypeScript", "PyTorch"], missing_skills: ["RAG patterns"], response_likelihood: 0.28, expected_value: 0.24, ghost_score: 0.13, is_ghost: false, created_at: today },
  { posting: findPosting("p_7"), match_score: 0.74, match_explanation: "Listing has been re-posted twice; recruiter has not moved a candidate in 6 weeks. Low reply rate: 1 of 7 batchmates heard back.", matched_skills: ["React", "Figma"], missing_skills: [], response_likelihood: 0.06, expected_value: 0.05, ghost_score: 0.66, is_ghost: true, created_at: today },
  { posting: findPosting("p_8"), match_score: 0.80, match_explanation: "Editorial product taste + TS depth. Cohort signal: small team but high reply rate — 3 of 4 batchmates got a response.", matched_skills: ["TypeScript"], missing_skills: ["Swift"], response_likelihood: 0.33, expected_value: 0.27, ghost_score: 0.09, is_ghost: false, created_at: today },
];

const artifact = (id: string, app_id: string, type: Artifact["type"], content: string): Artifact => ({
  id, application_id: app_id, type, content,
  ats_score: 87, missing_keywords: ["Yjs", "OT operations"],
  grounding_score: 0.92, predicted_response: 0.42, version: 1, generated_at: today,
});

export const applications: Application[] = [
  { id: "a_1", posting_id: "p_2", posting: { id: "p_2", title: "Research Engineer Intern, Inference", company_name: "Anthropic" }, channel: "referral", status: "interview", artifacts: [artifact("art_1", "a_1", "resume", "resume contents"), artifact("art_2", "a_1", "cover_letter", "cover contents")], predicted_response_prob: 0.42, applied_at: "2026-06-04", last_status_at: "2026-06-12" },
  { id: "a_2", posting_id: "p_1", posting: { id: "p_1", title: "Software Engineer Intern, Editor", company_name: "Linear" }, channel: "referral", status: "responded", artifacts: [artifact("art_3", "a_2", "email", "intro contents")], predicted_response_prob: 0.51, applied_at: "2026-06-06", last_status_at: "2026-06-10" },
  { id: "a_3", posting_id: "p_5", posting: { id: "p_5", title: "Software Engineer Intern, Platform", company_name: "Ramp" }, channel: "portal", status: "applied", artifacts: [artifact("art_4", "a_3", "resume", "resume contents")], predicted_response_prob: 0.32, applied_at: "2026-06-09", last_status_at: "2026-06-09" },
  { id: "a_4", posting_id: "p_8", posting: { id: "p_8", title: "Browser Intern, Web Platform", company_name: "The Browser Co." }, channel: "email", status: "viewed", artifacts: [], predicted_response_prob: 0.28, applied_at: "2026-06-10", last_status_at: "2026-06-13" },
  { id: "a_5", posting_id: "p_6", posting: { id: "p_6", title: "Software Engineer Intern, AI", company_name: "Notion" }, channel: "portal", status: "saved", artifacts: [], predicted_response_prob: 0.24, applied_at: "", last_status_at: "2026-06-11" },
  { id: "a_6", posting_id: "p_3", posting: { id: "p_3", title: "Software Engineer Intern, Issuing", company_name: "Stripe" }, channel: "portal", status: "ghosted", artifacts: [artifact("art_5", "a_6", "resume", "resume contents")], predicted_response_prob: 0.14, applied_at: "2026-05-01", last_status_at: "2026-05-29", outcome: "ghosted" },
  { id: "a_7", posting_id: "p_4", posting: { id: "p_4", title: "Frontend Intern, Dashboard", company_name: "Vercel" }, channel: "portal", status: "offer", artifacts: [artifact("art_6", "a_7", "resume", "resume contents")], predicted_response_prob: 0.41, applied_at: "2026-04-21", last_status_at: "2026-06-08", outcome: "offer" },
  { id: "a_8", posting_id: "p_7", posting: { id: "p_7", title: "Design Engineer Intern", company_name: "Figma" }, channel: "portal", status: "rejected", artifacts: [artifact("art_7", "a_8", "resume", "resume contents")], predicted_response_prob: 0.18, applied_at: "2026-04-30", last_status_at: "2026-05-22", outcome: "rejected" },
];

export const contacts: Contact[] = [
  { id: "ct_1", name: "Priya Raman", company_id: "c_linear", company_name: "Linear", role: "Software Engineer, Editor", university: "UC Berkeley", grad_year: 2022, linkedin: "https://linkedin.com/in/priya-raman", relationship: "alumni" },
  { id: "ct_2", name: "Daniel Okafor", company_id: "c_linear", company_name: "Linear", role: "Eng Manager", university: "Georgia Tech", grad_year: 2017, linkedin: "https://linkedin.com/in/daniel-okafor", relationship: "second_degree" },
  { id: "ct_3", name: "Aiko Tanaka", company_id: "c_linear", company_name: "Linear", role: "Designer", university: "UC Berkeley", grad_year: 2021, linkedin: "https://linkedin.com/in/aiko-tanaka", relationship: "alumni" },
];

export const referrals: Referral[] = [
  { id: "r_1", posting_id: "p_1", company_id: "c_linear", contact: contacts[0], status: "suggested", intro_artifact_id: null, created_at: today },
  { id: "r_2", posting_id: "p_1", company_id: "c_linear", contact: contacts[1], status: "requested", intro_artifact_id: "art_intro_1", created_at: today },
  { id: "r_3", posting_id: "p_1", company_id: "c_linear", contact: contacts[2], status: "suggested", intro_artifact_id: null, created_at: today },
];

export const dashboardSummary: DashboardSummary = {
  pipeline: { saved: 6, applied: 14, viewed: 9, responded: 4, interview: 2, offer: 1, rejected: 2, ghosted: 3 },
  response_rate: 0.34,
  time_saved_hours: 41,
  ghosts_avoided: 23,
  platform_iq: 78,
  iq_trend: [
    { date: "W1", value: 41 }, { date: "W2", value: 46 }, { date: "W3", value: 52 },
    { date: "W4", value: 58 }, { date: "W5", value: 63 }, { date: "W6", value: 68 },
    { date: "W7", value: 73 }, { date: "W8", value: 78 },
  ],
};

export const notifications: Notification[] = [
  { id: "n_1", type: "new_match", content: "New 94% match — Linear, Editor team", read: false, created_at: "2026-06-15T13:00:00Z" },
  { id: "n_2", type: "status_change", content: "We filtered 4 likely-ghost roles for you today", read: false, created_at: "2026-06-15T09:00:00Z" },
  { id: "n_3", type: "response", content: "Priya Raman accepted your intro request", read: true, created_at: "2026-06-14T17:00:00Z" },
];

// ============= Research data =============

export const researchOpportunities: ResearchOpportunity[] = [
  {
    id: "ro_1",
    professor_name: "Dr. Lena Brandt",
    institution: "UC Berkeley",
    lab_name: "RISE Lab",
    research_area: "Distributed ML systems · inference",
    fit_score: 0.91,
    matched_skills: ["Python", "PyTorch", "Distributed systems"],
    fit_explanation: "Your Replicate inference PRs and rustpad-mini concurrency work map directly to RISE's serving + scheduling line.",
    professor_email: "lbrandt@berkeley.edu",
    recent_paper: { title: "Elastic serving for long-context inference", year: 2025 },
    region: "North America",
  },
  {
    id: "ro_2",
    professor_name: "Dr. Hiro Yamada",
    institution: "Stanford",
    lab_name: "PL & Verification Group",
    research_area: "Programming languages · CRDT semantics",
    fit_score: 0.84,
    matched_skills: ["Rust", "TypeScript", "CRDTs"],
    fit_explanation: "rustpad-mini's CRDT design and your write-up on conflict semantics intersect Hiro's recent CRDT correctness work.",
    professor_email: "hyamada@cs.stanford.edu",
    recent_paper: { title: "A mechanized proof of CRDT convergence", year: 2024 },
    region: "North America",
  },
  {
    id: "ro_3",
    professor_name: "Dr. Amara Singh",
    institution: "MIT CSAIL",
    lab_name: "Distributed Systems Group",
    research_area: "Consensus · edge databases",
    fit_score: 0.76,
    matched_skills: ["Postgres", "Rust"],
    fit_explanation: "Your lattice.dev backend is a small consensus story Amara's edge-db line builds on.",
    professor_email: "amara@csail.mit.edu",
    recent_paper: { title: "Causal consistency at the edge", year: 2025 },
    region: "North America",
  },
  {
    id: "ro_4",
    professor_name: "Dr. Ines Moreau",
    institution: "ETH Zürich",
    lab_name: "Systems Group",
    research_area: "Compiler-driven inference acceleration",
    fit_score: 0.72,
    matched_skills: ["PyTorch", "Rust"],
    fit_explanation: "Your inference-tooling PRs touch the same scheduler edges Ines's group is rewriting.",
    professor_email: "moreau@inf.ethz.ch",
    recent_paper: { title: "Fusion-aware kernel scheduling", year: 2024 },
    region: "Europe",
  },
];

export const researchOutreach: ResearchOutreach[] = [
  { id: "rx_1", opportunity_id: "ro_1", opportunity: { professor_name: "Dr. Lena Brandt", institution: "UC Berkeley", lab_name: "RISE Lab" }, status: "contacted", pitch_id: "rp_1", contacted_at: "2026-06-11", replied_at: null, last_status_at: "2026-06-11" },
  { id: "rx_2", opportunity_id: "ro_2", opportunity: { professor_name: "Dr. Hiro Yamada", institution: "Stanford", lab_name: "PL & Verification Group" }, status: "drafted", pitch_id: "rp_2", contacted_at: null, replied_at: null, last_status_at: "2026-06-13" },
  { id: "rx_3", opportunity_id: "ro_3", opportunity: { professor_name: "Dr. Amara Singh", institution: "MIT CSAIL", lab_name: "Distributed Systems Group" }, status: "suggested", pitch_id: null, contacted_at: null, replied_at: null, last_status_at: today },
];
