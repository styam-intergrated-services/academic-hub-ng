/**
 * Front-end only admissions data.
 * No backend wiring — everything here is local mock/reference content.
 */

export type ProgrammeOption = {
  id: string;
  name: string;
  award: "NCE" | "Degree" | "Diploma" | "PGDE";
  school: string;
  duration: string;
};

export const ADMISSION_PROGRAMMES: ProgrammeOption[] = [
  { id: "nce-isl", name: "NCE Islamic Studies", award: "NCE", school: "School of Arts & Social Sciences", duration: "3 years" },
  { id: "nce-hau", name: "NCE Hausa", award: "NCE", school: "School of Languages", duration: "3 years" },
  { id: "nce-eng", name: "NCE English Language", award: "NCE", school: "School of Languages", duration: "3 years" },
  { id: "nce-mth", name: "NCE Mathematics", award: "NCE", school: "School of Sciences", duration: "3 years" },
  { id: "nce-bio", name: "NCE Biology", award: "NCE", school: "School of Sciences", duration: "3 years" },
  { id: "nce-soc", name: "NCE Social Studies", award: "NCE", school: "School of Arts & Social Sciences", duration: "3 years" },
  { id: "deg-isl", name: "B.A. (Ed) Islamic Studies — FUDMA affiliated", award: "Degree", school: "Affiliated Degree Programmes", duration: "4 years" },
  { id: "deg-hau", name: "B.A. (Ed) Hausa — FUDMA affiliated", award: "Degree", school: "Affiliated Degree Programmes", duration: "4 years" },
  { id: "dip-mac", name: "Diploma in Mass Communication", award: "Diploma", school: "School of Vocational & Professional Studies", duration: "2 years" },
  { id: "dip-acc", name: "Diploma in Accountancy", award: "Diploma", school: "School of Vocational & Professional Studies", duration: "2 years" },
  { id: "pgde-gen", name: "Postgraduate Diploma in Education (PGDE)", award: "PGDE", school: "School of Education", duration: "1 year" },
];

export const ENTRY_MODES = ["UTME", "Direct Entry", "Transfer", "Pre-NCE"] as const;
export const STATES = [
  "Kano", "Kaduna", "Katsina", "Jigawa", "Bauchi", "Borno", "Yobe", "Sokoto", "Kebbi", "Zamfara",
  "Gombe", "Adamawa", "Taraba", "Plateau", "Nasarawa", "Niger", "Kogi", "Kwara", "FCT Abuja", "Other",
];

export type ApplicationDraft = {
  surname: string;
  firstName: string;
  otherNames: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  stateOfOrigin: string;
  address: string;
  programmeId: string;
  entryMode: string;
  session: string;
  qualification: string;
  examType: string;
  examYear: string;
  subjects: string;
  declaration: boolean;
};

export const EMPTY_DRAFT: ApplicationDraft = {
  surname: "",
  firstName: "",
  otherNames: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  stateOfOrigin: "",
  address: "",
  programmeId: "",
  entryMode: "",
  session: "2025/2026",
  qualification: "",
  examType: "WAEC/SSCE",
  examYear: "",
  subjects: "",
  declaration: false,
};

export const DRAFT_KEY = "akcoe.admissions.draft";
export const SUBMITTED_KEY = "akcoe.admissions.submitted";

export type SubmittedApplication = ApplicationDraft & {
  reference: string;
  submittedAt: string;
};

export function makeReference() {
  const year = new Date().getFullYear();
  const n = Math.floor(100000 + Math.random() * 899999);
  return `AKCOE/APP/${year}/${n}`;
}

export const TIMELINE = [
  { key: "submitted", label: "Application submitted", desc: "Your form has been received by the Admissions Office." },
  { key: "screening", label: "Document screening", desc: "Credentials and O'Level results are verified." },
  { key: "interview", label: "Departmental review", desc: "The department confirms subject combination and capacity." },
  { key: "offer", label: "Offer of provisional admission", desc: "An admission letter is generated for download." },
  { key: "matriculation", label: "Matriculation", desc: "Acceptance fee paid and a matriculation number issued." },
];

export const REQUIREMENTS = [
  { title: "NCE (UTME)", items: ["Five O'Level credits including English", "At least two teaching subjects", "Valid UTME score with AKCOE as choice"] },
  { title: "NCE (Pre-NCE)", items: ["Minimum of three O'Level credits", "Completion of the Pre-NCE programme", "Departmental screening"] },
  { title: "Degree (FUDMA affiliated)", items: ["NCE with merit or five O'Level credits", "Direct Entry / UTME as applicable", "FUDMA affiliation requirements"] },
  { title: "PGDE", items: ["A first degree or HND from a recognised institution", "NYSC discharge or exemption", "Transcript from awarding institution"] },
];
