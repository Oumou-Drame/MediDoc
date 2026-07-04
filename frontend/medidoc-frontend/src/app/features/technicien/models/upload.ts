export interface CanalOption {
    value: string;
    label: string;
    description: string;
}

export interface UploadResponse {
    id: number;
    patient_name: string;
    patient_phone: string;
    patient_email: string;
    channel: string;
    status: string;
    whatsapp_sent: boolean;
    sms_sent: boolean;
    email_sent: boolean;
    expires_at: string;
    access_url: string;
}