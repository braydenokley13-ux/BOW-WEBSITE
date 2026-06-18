/* ============================================================
 * Get Involved hub + audience pages content.
 * Ported verbatim from the design prototype
 * (BOW Sports Capital.dc.html, script block lines ~5350–7475).
 * ============================================================ */

/* ---------- Shared types ---------- */

export interface AudienceFaq {
  id: string;
  q: string;
  a: string;
}

export interface MethodologyStep {
  n: string;
  label: string;
  body: string;
  bg: string;
  fg: string;
  muted: string;
  numColor: string;
}

export interface ReasoningMove {
  move: string;
  question: string;
  detail: string;
}

export interface TrackScaffold {
  track: string;
  label: string;
  grade: string;
  color: string;
  headline: string;
  support: string[];
}

export interface LabelValue {
  label: string;
  value: string;
}

export interface Format {
  n: string;
  title: string;
  detail: string;
}

/* ============================================================
 * Shared learning model (used on the Schools page)
 * ============================================================ */

export const learningMethod: MethodologyStep[] = [
  { n: "01", label: "Enter the Problem", body: "A sports decision where the stakes are real and the budget is tight. No vocabulary list first.", bg: "#fff", fg: "var(--bow-ink)", muted: "var(--bow-slate)", numColor: "var(--bow-blue)" },
  { n: "02", label: "Make the Call", body: "Choose from meaningful options. Each one has a real tradeoff the student must weigh.", bg: "var(--bow-paper)", fg: "var(--bow-ink)", muted: "var(--bow-slate)", numColor: "var(--bow-blue)" },
  { n: "03", label: "See What Changes", body: "The consequence arrives. Cap space, wins, fan trust, sponsor revenue — something shifts.", bg: "#fff", fg: "var(--bow-ink)", muted: "var(--bow-slate)", numColor: "var(--bow-orange)" },
  { n: "04", label: "Name the Principle", body: "Now the economic concept appears — scarcity, opportunity cost, incentives — grounded in what just happened.", bg: "var(--bow-paper)", fg: "var(--bow-ink)", muted: "var(--bow-slate)", numColor: "var(--bow-orange)" },
  { n: "05", label: "Apply It Again", body: "A second sports situation uses the same reasoning. The pattern becomes visible across contexts.", bg: "#fff", fg: "var(--bow-ink)", muted: "var(--bow-slate)", numColor: "var(--bow-blue)" },
  { n: "06", label: "Transfer Beyond Sports", body: "The same economic model in a school budget, a city, a household, or a community decision.", bg: "var(--bow-ink)", fg: "#fff", muted: "#b9bcc4", numColor: "#6f8bff" },
  { n: "07", label: "Defend the Conclusion", body: "Explain the reasoning. Use evidence. Argue the tradeoff. Show the relationship.", bg: "var(--bow-ink)", fg: "#fff", muted: "#b9bcc4", numColor: "var(--bow-positive)" },
];

export const reasoningFramework: ReasoningMove[] = [
  { move: "Identify", question: "What economic force, constraint, or outcome is present?", detail: "Name the pressure — scarcity, incentive, price, constraint — before anything else." },
  { move: "Explain", question: "Why did this result happen?", detail: "Connect the cause to the effect using the economic idea at the center of the decision." },
  { move: "Predict", question: "What changes if one condition changes?", detail: "Test the model. Change one variable and trace the ripple through the system." },
  { move: "Model", question: "Show the relationship: numbers, a comparison, arrows, a table.", detail: "Make the reasoning visible. A budget, a before-and-after, a simple diagram." },
  { move: "Connect", question: "What was economically similar across the sports and real-world situations?", detail: "The transfer question. Find the same pattern operating in a different context." },
];

export const trackScaffolding: TrackScaffold[] = [
  {
    track: "101", label: "Track 101", grade: "Grades 5–6", color: "var(--bow-blue)",
    headline: "Guided decisions with visible structure.",
    support: ["Short scenarios with 2–3 meaningful choices", "Whole-number budgets and clear tradeoffs", "Sentence starters and direction arrows", "One changed variable at a time", "Immediate explanation after each decision", "Selection-based responses"],
  },
  {
    track: "201", label: "Track 201", grade: "Grades 7–8", color: "var(--bow-orange)",
    headline: "More complexity. Less scaffolding.",
    support: ["Short written explanations required", "Percentage changes and data tables", "Competing stakeholders with different goals", "Multiple consequences including unintended effects", "Short-term and long-term analysis side by side", "Basic economic diagrams"],
  },
];

/* ============================================================
 * SCHOOLS
 * ============================================================ */

export const schoolAudiences: string[] = [
  "Middle Schools", "High Schools", "Camps", "Enrichment Programs", "Clubs", "Youth Organizations", "After-School Programs",
];

export interface ExampleFlowStep {
  stage: string;
  description: string;
  accent: string;
}

export const schoolsExampleFlow: ExampleFlowStep[] = [
  { stage: "The Sports Decision", description: "You inherit a team with $38M and four roster problems. You can only seriously fix one.", accent: "var(--bow-blue)" },
  { stage: "Economic Concept", description: "Scarcity, opportunity cost, marginal value — discovered through the decision, not before it.", accent: "var(--bow-orange)" },
  { stage: "Reasoning Practice", description: "Students identify the constraint, explain the tradeoff, and predict what changes if the budget doubles.", accent: "var(--bow-blue)" },
  { stage: "Transfer Challenge", description: "The same allocation logic applied to a school budget, a nonprofit, or a household — not a sports team.", accent: "var(--bow-ink)" },
];

export interface SchoolSession {
  n: string;
  title: string;
  concept: string;
  output: string;
  duration: string;
  bg: string;
}

export const schoolsSessions: SchoolSession[] = [
  { n: "01", title: "How a Sports Organization Makes Money", concept: "Revenue", output: "Students map the revenue streams behind a franchise", duration: "45–55 MIN", bg: "#fff" },
  { n: "02", title: "You're the GM", concept: "Scarcity · Opportunity Cost", output: "Students allocate a capped budget across competing needs", duration: "55–65 MIN", bg: "var(--bow-paper)" },
  { n: "03", title: "Ticket Pricing and Fan Access", concept: "Supply & Demand · Price Elasticity", output: "Students design a pricing strategy and defend tradeoffs", duration: "50–60 MIN", bg: "#fff" },
  { n: "04", title: "Risk, Incentives, and Roster Strategy", concept: "Incentives · Risk", output: "Students weigh short- and long-term options under pressure", duration: "50–60 MIN", bg: "var(--bow-paper)" },
  { n: "05", title: "Save the Franchise", concept: "Long-Term Strategy · Revenue", output: "Students choose a turnaround plan and defend it to ownership", duration: "55–70 MIN", bg: "#fff" },
  { n: "06", title: "Final Front Office Challenge", concept: "Transfer · Reasoning", output: "Students apply one economic model to a non-sports setting", duration: "55–65 MIN", bg: "var(--bow-paper)" },
];

export interface FeaturedLesson {
  id: string;
  title: string;
  summary: string;
  concept: string;
  duration: string;
  trackmod: string;
  accent: string;
  href: string;
}

/* Flagship cases ['t101-m2-l1', 't101-m4-l2', 't201-m2-l3'] — values
 * ported from the lesson records (concept = concepts[0]). */
export const schoolsFeaturedLessons: FeaturedLesson[] = [
  { id: "t101-m2-l1", title: "You're the GM", summary: "Allocate a limited budget across competing roster needs.", concept: "Scarcity", duration: "16 min", trackmod: "Track 101 · M2", accent: "var(--bow-blue)", href: "/lessons" },
  { id: "t101-m4-l2", title: "The Price of a Seat", summary: "Design a ticket strategy that lifts revenue without losing fans.", concept: "Supply & Demand", duration: "16 min", trackmod: "Track 101 · M4", accent: "var(--bow-orange)", href: "/lessons" },
  { id: "t201-m2-l3", title: "Save the Franchise", summary: "Choose a turnaround strategy under real financial pressure.", concept: "Risk", duration: "18 min", trackmod: "Track 201 · M2", accent: "var(--bow-positive)", href: "/lessons" },
];

export const schoolsOutcomes: string[] = [
  "Identify an economic constraint in a real sports-business situation",
  "Distinguish revenue from profit and explain why both matter",
  "Explain opportunity cost using evidence from a case",
  "Predict how changing one variable affects an outcome",
  "Compare short-term and long-term strategies and weigh tradeoffs",
  "Defend a resource-allocation decision with economic reasoning",
  "Connect one economic model across two different settings",
  "Use evidence to support — and revise — a conclusion",
];

export const schoolsLogistics: LabelValue[] = [
  { label: "Grade Band", value: "Grades 5–10" },
  { label: "Session Length", value: "45–75 min" },
  { label: "Group Size", value: "8–40 students" },
  { label: "Technology", value: "1 device / 2–3 students" },
  { label: "Facilitation", value: "BOW or teacher-led" },
  { label: "Format", value: "Workshop → full track" },
];

/* Shared formats list (matches the home page `formats`). */
export const formats: Format[] = [
  { n: "01", title: "One-Time Workshop", detail: "60–90 MIN" },
  { n: "02", title: "Multi-Session Course", detail: "4–8 WEEKS" },
  { n: "03", title: "Full-Track Program", detail: "1 SEMESTER" },
  { n: "04", title: "Camp Experience", detail: "1–5 DAYS" },
  { n: "05", title: "Custom Sports-Business Event", detail: "FLEXIBLE" },
];

export const schoolsFaqs: AudienceFaq[] = [
  { id: "s1", q: "Is prior economics knowledge required?", a: "No. BOW introduces every concept through the decision itself. Students encounter scarcity, opportunity cost, and incentives by making choices — not by reading definitions first." },
  { id: "s2", q: "Can BOW fit into one class period?", a: "Yes. Single-session workshops run 45–75 minutes and are designed to stand alone. Multi-session programs build across several class periods or advisory blocks." },
  { id: "s3", q: "Can a teacher lead the program?", a: "Yes. BOW provides curriculum, facilitation guides, discussion prompts, and case materials. A teacher-led program is fully supported. BOW can also facilitate directly." },
  { id: "s4", q: "Does a student need to follow sports closely?", a: "No. BOW is built around the business and economics side of sports — contracts, budgets, pricing, strategy. Students who care about money, decisions, and leadership engage as readily as sports fans." },
  { id: "s5", q: "What technology is required?", a: "One device shared between 2–3 students. A projector or screen helps for group facilitation. The program can also run with printed case materials." },
  { id: "s6", q: "Can the program support different grade levels?", a: "Yes. Track 101 is designed for grades 5–6, Track 201 for grades 7–8. Both tracks can be adapted for older students with adjusted facilitation." },
  { id: "s7", q: "How is student reasoning evaluated?", a: "BOW evaluates reasoning quality — the ability to identify constraints, explain tradeoffs, and connect economic logic — not sports knowledge. There is no penalty for a strategically poor sports choice. We're building the formal evaluation framework and will share it as it develops." },
  { id: "s8", q: "Does BOW align to state standards?", a: "BOW focuses on observable economic reasoning skills informed by introductory microeconomics and macroeconomics. A formal standards crosswalk is in development following educator review. We are happy to discuss alignment with your program goals directly." },
];

/* ============================================================
 * CAMPS
 * ============================================================ */

export interface CamperAction {
  n: string;
  label: string;
}

export const camperActions: CamperAction[] = [
  { n: "01", label: "Receive a front-office role" },
  { n: "02", label: "Review a short case with real constraints" },
  { n: "03", label: "Debate the options with your team" },
  { n: "04", label: "Allocate resources and make a decision" },
  { n: "05", label: "See the consequence — cap space, wins, or fan reaction" },
  { n: "06", label: "Discover the economics behind the result" },
  { n: "07", label: "Apply the same idea to a new situation" },
  { n: "08", label: "Defend the decision to the group" },
];

export interface SessionStructureRow {
  time: string;
  activity: string;
}

export const campsSessionStructure: SessionStructureRow[] = [
  { time: "0–5 min", activity: "Cold open and role assignment" },
  { time: "5–15 min", activity: "Sports setup and evidence review" },
  { time: "15–35 min", activity: "Team decision or simulation" },
  { time: "35–45 min", activity: "Consequence reveal" },
  { time: "45–55 min", activity: "Economic concept and transfer challenge" },
  { time: "55–60 min", activity: "Defend the decision" },
];

export interface CampFormat {
  n: string;
  title: string;
  desc: string;
  status: string;
}

export const campFormatsList: CampFormat[] = [
  { n: "01", title: "You're the GM", desc: "Roster budget allocation under hard constraints", status: "Available" },
  { n: "02", title: "Save the Franchise", desc: "Franchise turnaround — pick the plan and defend it", status: "Available" },
  { n: "03", title: "The Price of a Seat", desc: "Ticket pricing strategy and fan access tradeoffs", status: "Available" },
  { n: "04", title: "Front Office Draft Room", desc: "Pick valuation and draft-night decision-making", status: "Curriculum ready" },
  { n: "05", title: "Multi-Day Franchise Challenge", desc: "Multi-session arc — build, decide, present, defend", status: "On request" },
];

export interface DeliveryModel {
  title: string;
  desc: string;
}

export const campDeliveryModels: DeliveryModel[] = [
  { title: "One-Time Workshop", desc: "One complete sports-business case in 45–75 minutes. Team-based, facilitator-led, no prior setup required." },
  { title: "Multi-Session Program", desc: "Several connected decisions across a week or camp session. Each builds on the last." },
  { title: "Front Office Challenge", desc: "Teams make multiple decisions and present a final franchise strategy. Can span one day or several sessions." },
];

export const campsLogistics: LabelValue[] = [
  { label: "Ages", value: "10–16" },
  { label: "Team Size", value: "3–6 campers" },
  { label: "Group Size", value: "12–60 campers" },
  { label: "Space", value: "Any indoor space" },
  { label: "Tech", value: "Optional — runs print-based too" },
  { label: "Duration", value: "45–75 min per session" },
];

export const campsFaqs: AudienceFaq[] = [
  { id: "c1", q: "Does every camper need a device?", a: "No. Sessions are designed for one device per team of 3–6 campers. The program can also run entirely with printed case materials." },
  { id: "c2", q: "Can the session run indoors?", a: "Yes. Every BOW camp session is designed for a standard indoor space — a cabin, gym, classroom, or meeting room." },
  { id: "c3", q: "Do campers need to understand economics first?", a: "No. Every economic concept is introduced through the decision itself. Campers don't need any background — curiosity and willingness to argue a position are enough." },
  { id: "c4", q: "Can the same session work for different ages?", a: "Yes. BOW cases are designed to adjust in depth. The same You're the GM session can run for a 10-year-old group or a 16-year-old group with different facilitation emphasis." },
  { id: "c5", q: "Is the session still valuable for campers who don't follow a specific sport?", a: "Yes. The cases are built around the business and economics side of sports — not trivia or fan knowledge. Students who care about money, strategy, and decisions engage fully regardless of sports background." },
  { id: "c6", q: "Can our staff facilitate the sessions?", a: "Yes. BOW provides facilitation guides and case materials for staff-led sessions. We can also provide a trained BOW facilitator." },
];

/* ============================================================
 * FAMILIES & STUDENTS
 * ============================================================ */

export const familiesRewards: string[] = [
  "Curiosity about how decisions get made",
  "Willingness to use evidence",
  "Interest in revising an answer",
  "Ability to explain a tradeoff",
  "Confidence in arguing a position",
  "Willingness to experiment",
];

export interface JourneyStep {
  n: string;
  label: string;
  body: string;
}

export const familiesStudentJourney: JourneyStep[] = [
  { n: "01", label: "You receive a role", body: "General Manager. President. Revenue Officer. A real front-office seat." },
  { n: "02", label: "You enter a real decision", body: "A roster problem. A pricing choice. A franchise in trouble. Something with stakes." },
  { n: "03", label: "You study the evidence", body: "Cap space, ticket demand, fan sentiment. More than expected. Less than wanted." },
  { n: "04", label: "You make a choice", body: "From options that each have real costs. There is no obviously correct answer." },
  { n: "05", label: "You see the result", body: "Wins go up. Revenue drops. The owner calls. The consequence is immediate and honest." },
  { n: "06", label: "You discover the economics", body: "Scarcity. Opportunity cost. Incentives. The concept arrives when it matters most." },
  { n: "07", label: "You apply the same idea somewhere new", body: "The same model — in a school budget, a city, a household. Sports was the entry point." },
  { n: "08", label: "You explain your reasoning", body: "Defend the decision. Use the evidence. Show what changed and why it mattered." },
];

export const familiesFaqs: AudienceFaq[] = [
  { id: "f1", q: "What ages is BOW for?", a: "BOW is designed for students in grades 5 through 10, approximately ages 10–16. Track 101 targets grades 5–6. Track 201 targets grades 7–8. Both can be adapted for older or more advanced students." },
  { id: "f2", q: "Does my child need to follow sports?", a: "No. BOW is built around the business and economics side of sports — contracts, budgets, pricing, strategy. Students who are curious about money, decisions, and leadership engage fully, regardless of sports fandom." },
  { id: "f3", q: "Is this a game or a class?", a: "It's neither and both. BOW is structured economic education delivered through the experience of making a real front-office decision. Students learn by doing — not by watching." },
  { id: "f4", q: "What economics will students learn?", a: "Track 101 covers scarcity, opportunity cost, marginal value, incentives, constraints, and revenue tradeoffs. Track 201 adds cap mechanics, surplus value, expected value, and negotiation. Every concept is introduced through a decision, not a definition." },
  { id: "f5", q: "How long is each session?", a: "Most lessons take 12–18 minutes plus a simulation running another 8–15 minutes. Full sessions including discussion typically fit within 45–60 minutes." },
  { id: "f6", q: "Can students participate online?", a: "BOW's lessons and simulations are digital-first and work on any device. In-person programs are also available through schools, camps, and enrichment programs." },
  { id: "f7", q: "How will future programs be announced?", a: "Fill out the inquiry form on this page and we'll reach out when programs open in your area or online." },
  { id: "f8", q: "Is a poor sports decision penalized?", a: "No. BOW values the reasoning behind the call, not the sports outcome. A strategically thoughtful decision that produces a bad sports result is treated differently from a decision made without evidence. We're building a formal reasoning evaluation framework." },
];

/* ============================================================
 * YOUTH ORGANIZATIONS
 * ============================================================ */

export const youthImplModels: DeliveryModel[] = [
  { title: "Hosted BOW Workshop", desc: "BOW or a trained facilitator leads the session. The organization provides the space and participants. Minimal staff preparation required." },
  { title: "Organization-Led Program", desc: "The organization runs BOW sessions with its own facilitator using BOW-provided curriculum and case materials. Full facilitation guide included." },
  { title: "Multi-Session Collaboration", desc: "BOW and the organization design a connected program for a recurring group — a club, a team, a weekly enrichment block. Possible delivery model; contact us to discuss." },
];

export interface TransferTopic {
  label: string;
  body: string;
}

export const youthTransferTopics: TransferTopic[] = [
  { label: "Community Budgets", body: "How does a city decide where to spend limited funds?" },
  { label: "Program Funding", body: "When an organization has more needs than money, how does it choose?" },
  { label: "Event Pricing", body: "How do you price access to something when demand varies?" },
  { label: "Limited Staff Time", body: "How do you allocate the rarest resource — people — across competing priorities?" },
  { label: "Youth Access", body: "When resources are scarce, who gets priority and why?" },
  { label: "Competing Priorities", body: "What does an organization do when two good goals require the same budget?" },
];

export const youthPracticalDetails: LabelValue[] = [
  { label: "Grade Bands", value: "Grades 5–10; adaptable" },
  { label: "Group Size", value: "8–60 participants" },
  { label: "Session Length", value: "45–75 min per session" },
  { label: "Technology", value: "1 device / 3–5 participants; print-based option" },
  { label: "Facilitation", value: "BOW-led or organization staff with guide" },
  { label: "Format", value: "One-time, multi-session, or recurring program" },
];

export const youthFaqs: AudienceFaq[] = [
  { id: "y1", q: "Can the program be adapted to our group?", a: "Yes. BOW cases are designed to be facilitated at different depths and age bands. We work with organizations to identify the right entry point for their participants." },
  { id: "y2", q: "Can we run more than one session?", a: "Yes. Multi-session programs are possible and create more complete learning arcs. Contact us to discuss what a recurring program might look like for your group." },
  { id: "y3", q: "Do participants need devices?", a: "One device shared between 3–5 participants is enough. Sessions can also run with printed case materials if technology access is limited." },
  { id: "y4", q: "Can our staff facilitate?", a: "Yes. BOW provides facilitation guides and case materials for staff-led delivery. We can also provide a trained facilitator directly." },
  { id: "y5", q: "Can BOW connect the lesson to our organization's work?", a: "The learning methodology is explicitly designed to transfer beyond sports. The transfer challenge at the end of each lesson can be shaped around your organization's context — budgets, programs, community decisions." },
  { id: "y6", q: "What age groups are supported?", a: "BOW programs are designed for participants aged 10–16. Track 101 works well for younger groups; Track 201 for older or more advanced participants. Custom facilitation can adjust for other age bands." },
];

/* ============================================================
 * PARTNERS
 * ============================================================ */

export interface PartnerCategory {
  title: string;
  body: string;
}

export const partnerCategories: PartnerCategory[] = [
  { title: "Program Distribution", body: "Schools, camps, youth networks, libraries, and enrichment providers who can bring BOW to more students." },
  { title: "Curriculum & Academic Review", body: "Economists, educators, curriculum specialists, and researchers who can strengthen and validate the learning model." },
  { title: "Sports Industry Access", body: "Teams, leagues, sports business professionals, and front-office experts who can deepen the authenticity of cases." },
  { title: "Media & Storytelling", body: "Podcast, journalism, video, and educational content partners who can extend the BOW voice." },
  { title: "Technology & Simulation", body: "Organizations that can support interactive learning infrastructure, simulation development, or platform expansion." },
  { title: "Access & Sponsorship", body: "Partners that can help provide programming to students who would not otherwise have access." },
];

export interface VerifiedFact {
  value: string;
  label: string;
  note: string;
}

export const partnerVerifiedFacts: VerifiedFact[] = [
  { value: "30", label: "Students in current programs", note: "Verified student count" },
  { value: "2", label: "Active curriculum tracks", note: "Track 101 and Track 201" },
  { value: "24", label: "Structured lesson records", note: "In the current curriculum model — not all are fully produced digital simulations" },
  { value: "4", label: "Press mentions", note: "Newspaper features and mentions" },
  { value: "1", label: "Track in development", note: "Track 301 — executive level" },
];

export interface PartnerFit {
  who: string;
  contribute: string;
  build: string;
}

export const partnerFitItems: PartnerFit[] = [
  { who: "Distribution Partner", contribute: "Access to students, schools, or programs", build: "Reaching more students with existing curriculum" },
  { who: "Academic Reviewer", contribute: "Subject-matter expertise and credibility", build: "Validated standards alignment and stronger learning model" },
  { who: "Industry Partner", contribute: "Sports-business authenticity and access", build: "More credible cases and real-world connection" },
  { who: "Technology Partner", contribute: "Simulation infrastructure or platform capability", build: "Better interactive learning experiences at scale" },
];

/* ============================================================
 * GET INVOLVED — inquiry funnel paths & fields
 * ============================================================ */

export type FieldType = "text" | "email" | "select" | "textarea";

export interface InquiryField {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder: string;
  options?: string[];
}

export interface InquiryPath {
  id: string;
  label: string;
  headline: string;
  description: string;
  nextStep: string;
  successMessage: string;
  audiencePage: string | null;
  fields: InquiryField[];
}

export const inquiryPaths: InquiryPath[] = [
  {
    id: "school", label: "Bring BOW to a School",
    headline: "Tell us about your school.",
    description: "We'll follow up with program options, timing, and how to build the right fit for your students.",
    nextStep: "We'll review your inquiry and reach out within a few business days with program options.",
    successMessage: "Your school inquiry is on the board. We'll be in touch.",
    audiencePage: "schools",
    fields: [
      { name: "contactName", label: "Your name", type: "text", required: true, placeholder: "Name" },
      { name: "email", label: "Work email", type: "email", required: true, placeholder: "you@school.edu" },
      { name: "schoolName", label: "School name", type: "text", required: true, placeholder: "School or district name" },
      { name: "role", label: "Your role", type: "select", required: true, placeholder: "", options: ["Teacher", "Administrator", "Program Director", "Counselor", "Other"] },
      { name: "location", label: "City and state", type: "text", required: false, placeholder: "City, State" },
      { name: "gradeLevel", label: "Approximate grade level", type: "select", required: false, placeholder: "", options: ["Grades 5–6", "Grades 7–8", "Grades 9–10", "Mixed grade band"] },
      { name: "groupSize", label: "Approximate number of students", type: "select", required: false, placeholder: "", options: ["Under 15", "15–30", "30–60", "60+", "Not sure yet"] },
      { name: "format", label: "Preferred format", type: "select", required: false, placeholder: "", options: ["One-time workshop", "Multi-session program", "Full-track course", "Not sure yet"] },
      { name: "timing", label: "Approximate timing", type: "select", required: false, placeholder: "", options: ["This semester", "Next semester", "This school year", "Exploring for next year"] },
      { name: "notes", label: "Anything else (optional)", type: "textarea", required: false, placeholder: "Tell us what you're looking for" },
    ],
  },
  {
    id: "camp", label: "Bring BOW to a Camp",
    headline: "Tell us about your camp.",
    description: "We'll follow up with session options designed for your schedule and camper age range.",
    nextStep: "We'll review your inquiry and reach out with camp-specific program options.",
    successMessage: "Your camp inquiry is in. The front office will be in touch.",
    audiencePage: "camps",
    fields: [
      { name: "contactName", label: "Your name", type: "text", required: true, placeholder: "Name" },
      { name: "email", label: "Work email", type: "email", required: true, placeholder: "you@camp.com" },
      { name: "campName", label: "Camp name", type: "text", required: true, placeholder: "Camp or program name" },
      { name: "role", label: "Your role", type: "select", required: true, placeholder: "", options: ["Camp Director", "Program Coordinator", "Counselor", "Other"] },
      { name: "location", label: "Location", type: "text", required: false, placeholder: "City, State" },
      { name: "ageRange", label: "Camper age range", type: "select", required: false, placeholder: "", options: ["Ages 10–12", "Ages 12–14", "Ages 14–16", "Mixed ages"] },
      { name: "groupSize", label: "Approximate group size", type: "select", required: false, placeholder: "", options: ["Under 15", "15–30", "30–60", "60+"] },
      { name: "format", label: "Preferred session format", type: "select", required: false, placeholder: "", options: ["Single 60–90 min session", "Multi-day program", "Front Office Challenge", "Not sure yet"] },
      { name: "timing", label: "Approximate timing", type: "text", required: false, placeholder: "e.g. Summer 2026, specific dates" },
      { name: "notes", label: "Anything else (optional)", type: "textarea", required: false, placeholder: "Tell us what you're looking for" },
    ],
  },
  {
    id: "youth", label: "Bring BOW to a Youth Organization",
    headline: "Tell us about your organization.",
    description: "We'll follow up with program options suited to your group format and schedule.",
    nextStep: "We'll review your inquiry and reach out about program options.",
    successMessage: "Your inquiry is in. The front office will follow up.",
    audiencePage: "youthorganizations",
    fields: [
      { name: "contactName", label: "Your name", type: "text", required: true, placeholder: "Name" },
      { name: "email", label: "Email", type: "email", required: true, placeholder: "you@org.org" },
      { name: "orgName", label: "Organization name", type: "text", required: true, placeholder: "Organization name" },
      { name: "orgType", label: "Organization type", type: "select", required: false, placeholder: "", options: ["Community organization", "Library", "Nonprofit", "Recreation program", "Religious organization", "Enrichment provider", "Student leadership group", "Other"] },
      { name: "location", label: "Location", type: "text", required: false, placeholder: "City, State" },
      { name: "ageRange", label: "Participant age range", type: "select", required: false, placeholder: "", options: ["Ages 10–12", "Ages 12–14", "Ages 14–16", "Mixed ages"] },
      { name: "groupSize", label: "Approximate group size", type: "select", required: false, placeholder: "", options: ["Under 15", "15–30", "30+", "Varies"] },
      { name: "format", label: "Program interest", type: "select", required: false, placeholder: "", options: ["One-time workshop", "Multi-session program", "Recurring group program", "Not sure yet"] },
      { name: "notes", label: "Anything else (optional)", type: "textarea", required: false, placeholder: "Tell us about your group" },
    ],
  },
  {
    id: "family", label: "Join as a Student or Family",
    headline: "Tell us about yourself.",
    description: "We'll let you know about upcoming programs and opportunities for students.",
    nextStep: "We'll add you to the list and reach out when programs open in your area or online.",
    successMessage: "You're on the list. We'll reach out when the next program opens.",
    audiencePage: "families",
    fields: [
      { name: "contactName", label: "Your name (parent, guardian, or student)", type: "text", required: true, placeholder: "Name" },
      { name: "email", label: "Email", type: "email", required: true, placeholder: "you@email.com" },
      { name: "gradeLevel", label: "Student grade band", type: "select", required: false, placeholder: "", options: ["Grades 5–6", "Grades 7–8", "Grades 9–10", "Other"] },
      { name: "location", label: "General location (optional)", type: "text", required: false, placeholder: "City, State" },
      { name: "interest", label: "Program interest", type: "select", required: false, placeholder: "", options: ["Track 101", "Track 201", "Any available program", "Not sure yet"] },
      { name: "notes", label: "Anything you want to share (optional)", type: "textarea", required: false, placeholder: "Optional message" },
    ],
  },
  {
    id: "partner", label: "Explore a Partnership",
    headline: "Tell us about your organization.",
    description: "We'll review your message and follow up about how we might work together.",
    nextStep: "We'll review your inquiry and reach out about next steps.",
    successMessage: "Your partnership inquiry is in. We'll follow up.",
    audiencePage: "partners",
    fields: [
      { name: "contactName", label: "Your name", type: "text", required: true, placeholder: "Name" },
      { name: "email", label: "Work email", type: "email", required: true, placeholder: "you@org.com" },
      { name: "organization", label: "Organization", type: "text", required: true, placeholder: "Organization name" },
      { name: "role", label: "Your role", type: "text", required: false, placeholder: "Your title" },
      { name: "partnerType", label: "Partnership category", type: "select", required: false, placeholder: "", options: ["Program distribution", "Curriculum and academic review", "Sports industry access", "Media and storytelling", "Technology and simulation", "Access and sponsorship", "Other"] },
      { name: "description", label: "Brief description", type: "textarea", required: true, placeholder: "What could we build together?" },
      { name: "nextStep", label: "Desired next step", type: "select", required: false, placeholder: "", options: ["Introductory call", "Written proposal", "Other"] },
    ],
  },
  {
    id: "press", label: "Press or Media Inquiry",
    headline: "Tell us about your inquiry.",
    description: "We'll review and respond as quickly as we can.",
    nextStep: "We'll respond to your inquiry.",
    successMessage: "Your press inquiry is in. We'll follow up as soon as possible.",
    audiencePage: null,
    fields: [
      { name: "contactName", label: "Your name", type: "text", required: true, placeholder: "Name" },
      { name: "email", label: "Email", type: "email", required: true, placeholder: "you@publication.com" },
      { name: "publication", label: "Publication or organization", type: "text", required: true, placeholder: "Publication or outlet" },
      { name: "inquiryType", label: "Inquiry type", type: "select", required: false, placeholder: "", options: ["Story / feature", "Data request", "Quote / comment", "Interview request", "Other"] },
      { name: "deadline", label: "Deadline (optional)", type: "text", required: false, placeholder: "e.g. June 30" },
      { name: "message", label: "Message", type: "textarea", required: true, placeholder: "Tell us about your inquiry" },
    ],
  },
];
