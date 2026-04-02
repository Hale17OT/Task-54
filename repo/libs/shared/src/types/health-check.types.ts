export enum HealthCheckStatus {
  DRAFT = 'DRAFT',
  AWAITING_REVIEW = 'AWAITING_REVIEW',
  SIGNED = 'SIGNED',
  AMENDED = 'AMENDED',
}

export enum AbnormalFlag {
  H = 'H',
  L = 'L',
  HH = 'HH',
  LL = 'LL',
  C = 'C',
}

export interface ReportTemplateDto {
  id: string;
  name: string;
  description: string;
  sections: TemplateSection[];
  isActive: boolean;
}

export interface TemplateSection {
  name: string;
  testItems: TemplateTestItem[];
}

export interface TemplateTestItem {
  testName: string;
  testCode: string;
  unit: string;
  referenceLow: number | null;
  referenceHigh: number | null;
}

export interface HealthCheckDto {
  id: string;
  patientId: string;
  templateId: string;
  orderId: string | null;
  status: HealthCheckStatus;
  currentVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  complianceBreach: boolean;
}

export interface HealthCheckVersionDto {
  id: string;
  healthCheckId: string;
  versionNumber: number;
  status: HealthCheckStatus;
  resultItems: ResultItemDto[];
  changeSummary: string | null;
  createdBy: string;
  createdAt: string;
  signature: ReportSignatureDto | null;
}

export interface ResultItemDto {
  id: string;
  testName: string;
  testCode: string;
  value: string;
  unit: string;
  referenceLow: number | null;
  referenceHigh: number | null;
  isAbnormal: boolean;
  flag: AbnormalFlag | null;
  priorValue: string | null;
  priorDate: string | null;
}

export interface ReportSignatureDto {
  id: string;
  signerId: string;
  signerName: string;
  signedAt: string;
}

export interface CreateHealthCheckRequest {
  patientId: string;
  templateId: string;
  orderId?: string;
  resultItems: CreateResultItemRequest[];
}

export interface CreateResultItemRequest {
  testName: string;
  testCode: string;
  value: string;
  unit: string;
  referenceLow?: number;
  referenceHigh?: number;
}

export interface UpdateHealthCheckRequest {
  resultItems: CreateResultItemRequest[];
  changeSummary?: string;
}

export interface SignHealthCheckRequest {
  username: string;
  password: string;
  versionNumber: number;
}
