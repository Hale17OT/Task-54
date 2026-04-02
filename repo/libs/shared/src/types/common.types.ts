export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiErrorResponse {
  statusCode: number;
  errorCode: string;
  message: string;
  details?: Record<string, string[]>;
  timestamp: string;
}

export interface ApiSuccessResponse<T> {
  data: T;
  message?: string;
}
