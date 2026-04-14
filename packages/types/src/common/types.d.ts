export interface BaseEntity {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface PaginationParams {
    page?: number;
    limit?: number;
    offset?: number;
}
export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
export interface SearchParams {
    query?: string;
    filters?: Record<string, any>;
    sort?: {
        field: string;
        direction: 'asc' | 'desc';
    };
    pagination?: PaginationParams;
}
export interface User {
    id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface Context {
    user: User;
    requestId?: string;
    timestamp: Date;
}
//# sourceMappingURL=types.d.ts.map