export type Language = "english" | "spanish";

export type ProspectProfile =
  | "no_digital_presence"
  | "basic_presence"
  | "solid_presence";

export type Service =
  | "linkedin_management"
  | "full_stack"
  | "marketing_strategy"
  | "website_development"
  | "executive_positioning"
  | "one_pager"
  | "brand_manual"
  | "media_amplification";

export interface ProposalFormData {
  prospectName: string;
  websiteUrl: string;
  linkedinUrl: string;
  language: Language;
  prospectProfile: ProspectProfile;
  services: Service[];
  customService: string;
  notes: string;
  suggestedPrice: number | "";
}

export interface GeneratedProposal {
  formData: ProposalFormData;
  content: {
    phase1: string;
    phase2: string;
    additional: string;
    feeStructure: string;
    closingNote: string;
  };
  template: "A" | "B" | "C";
  generatedAt: string;
}
