export type JobSlug =
  // — Tech & Produit —
  | 'dev-fullstack'
  | 'data-analyst'
  | 'data-scientist'
  | 'devops-cloud'
  | 'ux-designer'
  | 'product-owner'
  // — Business & Commerce —
  | 'sales-b2b'
  | 'business-developer'
  | 'consultant'
  | 'chef-de-projet'
  // — Finance & Juridique —
  | 'comptable'
  | 'controleur-gestion'
  | 'juriste'
  // — RH & Management —
  | 'hr-recruiter'
  | 'charge-rh'
  | 'office-manager'
  // — Marketing & Communication —
  | 'marketing-digital'
  | 'content-creator'
  | 'graphiste'
  | 'responsable-com';

export interface JobProfile {
  slug: JobSlug;
  title: string;
  tagline: string;
  summary: string;
  missions: string[];
  skills: string[];
  formations: string[];
  salaryRangeHint: string;
  workContext: string;
}
