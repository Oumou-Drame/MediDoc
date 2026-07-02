export interface ResultatMedical {
    id: number;
    technician_id: number;
    technician_name: string;
    patient_name: string;
    patient_phone: string;
    patient_email: string | null;
    channel: string;
    status: string;
    created_at: string;
    sent_at: string | null;
    accessed_at: string | null;
    expires_at: string;
}

export interface Pagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

export interface HistoryResponse {
    success: boolean;
    data: {
        results: ResultatMedical[];
        pagination: Pagination;
    };
}
export interface ResultatMedical {
    id: number;
    technician_id: number;
    technician_name: string;
    patient_name: string;
    patient_phone: string;
    patient_email: string | null;
    original_filename: string;
    channel: string;
    status: string;
    access_code: string;
    access_token: string;
    access_count: number;
    attempt_count: number;
    is_locked: number;
    created_at: string;
    sent_at: string | null;
    accessed_at: string | null;
    expires_at: string;
}