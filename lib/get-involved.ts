/* ============================================================
 * Get Involved — the inquiry funnel's form schema.
 *
 * The audience *copy* that used to live here (schools, camps, families,
 * youth organisations, partners) is now content: it lives in `site_pages`
 * and is edited at /app/website/pages. What remains is the structure of the
 * inquiry form itself — field names, types, and validation shape — which is
 * behaviour rather than words, plus the verified-facts list the partner
 * landing pages render.
 * ============================================================ */

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
