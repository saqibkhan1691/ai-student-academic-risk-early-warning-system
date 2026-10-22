/**
 * Centralized API service for communicating with the AI Student Academic Risk Early Warning System Backend.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

export interface HealthResponse {
  status: string;
  version: string;
  dataset_status: string;
  model_status: string;
  disclaimer: string;
}

export interface AcademicSummary {
  cumulative_cgpa: number;
  semester_attendance_percentage: number;
  total_subjects_enrolled: number;
  total_subjects_passed: number;
  pending_assignments_total: number;
  data_status: string;
}

export interface StudentDetail {
  student_id: string;
  student_name: string;
  department_code: string;
  department_name: string;
  section: string;
  program: string;
  batch_year: number;
  current_semester: number;
  academic_summary: AcademicSummary | null;
}

export interface RiskSummary {
  predicted_risk_probability: number;
  predicted_risk_level: 'Low' | 'Moderate' | 'High';
  predicted_below_40: number;
  target_definition: string;
}

export interface StudentSubject {
  subject_key: string;
  subject_id: string;
  subject_name: string;
  component: string;
  credits: number;
  attendance_percentage: number;
  classes_attended: number;
  total_classes: number;
  risk_summary: RiskSummary | null;
}

export interface ShapFeature {
  rank: number;
  feature_name: string;
  display_label: string;
  original_value: string;
  transformed_value: number | null;
  shap_value: number;
  impact_direction: string;
  is_aggregate_residual: boolean;
}

export interface ExplanationResponse {
  student_id: string;
  subject_key: string;
  subject_name: string;
  semester: number;
  base_probability: number;
  predicted_risk_probability: number;
  reconstructed_probability: number;
  reconstruction_error: number;
  is_additivity_closed: boolean;
  features: ShapFeature[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public detail?: string
  ) {
    super(detail || `API error ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...(options?.headers || {}),
      },
    });

    if (!res.ok) {
      let detail: string | undefined;
      try {
        const body = await res.json();
        detail = body.detail || body.message;
      } catch {
        detail = await res.text().catch(() => undefined);
      }
      throw new ApiError(res.status, res.statusText, detail);
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(0, 'Network Error', (err as Error).message || 'Unable to connect to the backend server.');
  }
}

/**
 * Check backend service health and model status.
 */
export async function getHealth(): Promise<HealthResponse> {
  return fetchJson<HealthResponse>('/health');
}

/**
 * Retrieve student profile and latest academic summary.
 */
export async function getStudentProfile(studentId: string): Promise<StudentDetail> {
  return fetchJson<StudentDetail>(`/students/${encodeURIComponent(studentId)}`);
}

/**
 * Retrieve enrolled subjects and ML risk predictions for a student.
 */
export async function getStudentSubjects(studentId: string, semester?: number): Promise<StudentSubject[]> {
  const query = semester ? `?semester=${encodeURIComponent(semester)}` : '';
  return fetchJson<StudentSubject[]>(`/students/${encodeURIComponent(studentId)}/subjects${query}`);
}

/**
 * Retrieve SHAP explanation for a specific student and enrolled course.
 */
export async function getSubjectExplanation(
  studentId: string,
  subjectKey: string,
  semester?: number
): Promise<ExplanationResponse> {
  const query = semester ? `?semester=${encodeURIComponent(semester)}` : '';
  return fetchJson<ExplanationResponse>(
    `/students/${encodeURIComponent(studentId)}/subjects/${encodeURIComponent(subjectKey)}/explanation${query}`
  );
}
