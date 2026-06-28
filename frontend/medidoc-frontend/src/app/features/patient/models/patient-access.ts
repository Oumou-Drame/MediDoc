export interface PatientInfo {
    id: number;
    patient_name: string;
    status: string;
    expires_at: string;
    created_at: string;
    is_expired: boolean;
    is_locked: number;
    attempt_count: number;
    max_attempts: number;
}

export interface VerifyResponse {
    id: number;
    patient_name: string;
    download_url: string;
    expires_at: string;
    attempt_count: number;
    max_attempts: number;
    remaining_attempts: number;
}