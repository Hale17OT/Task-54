export enum EnrollmentStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  ACTIVE = 'ACTIVE',
  REJECTED = 'REJECTED',
  CANCELED = 'CANCELED',
}

export interface CatalogServiceDto {
  id: string;
  code: string;
  name: string;
  description: string;
  basePrice: number;
  category: string;
  isActive: boolean;
  maxSeats: number | null;
  availableSeats: number | null;
}

export interface EnrollmentServiceLineDto {
  id: string;
  serviceId: string;
  service?: CatalogServiceDto;
  quantity: number;
}

export interface EnrollmentDto {
  id: string;
  patientId: string;
  status: EnrollmentStatus;
  enrollmentDate: string | null;
  notes: string;
  serviceLines: EnrollmentServiceLineDto[];
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
}

export interface CreateEnrollmentRequest {
  notes?: string;
  serviceLines: { serviceId: string; quantity: number }[];
}

export interface UpdateEnrollmentRequest {
  notes?: string;
  serviceLines?: { serviceId: string; quantity: number }[];
}
