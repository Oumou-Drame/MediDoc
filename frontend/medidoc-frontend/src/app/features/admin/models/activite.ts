export interface JournalEntry {
    id: number;
    action: string;
    details: string;
    created_at: string;
    user_id: number;
    auteur: string;
}

export interface Auteur {
    id: number;
    full_name: string;
}

export interface ActivitePagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

export interface ActiviteResponse {
    success: boolean;
    data: {
        logs: JournalEntry[];
        pagination: ActivitePagination;
    };
}
