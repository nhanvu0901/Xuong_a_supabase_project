// Base interfaces
export interface UpdateLog {
    timestamp: string;
    message: string;
}

export interface TaskStage {
    id: string;
    name: 'first_sewing' | 'first_fitting' | 'alteration' | 'final_sewing' | 'decoration' | 'fix_update';
    duration_hours: number;
    completed: boolean;
    started_at?: string;
    completed_at?: string;
}

export interface TimeSlot {
    date: string;
    start_time: string;
    end_time: string;
    duration_hours: number;
    order_id?: string;
    task: string;
    staff: 'tailor' | 'decorator' | 'both';
}

export interface DailySchedule {
    date: string;
    slots: TimeSlot[];
    total_hours: number;
    available_hours: number;
    is_overtime: boolean;
}

export interface Order {
    id: string;
    customer_name: string;
    customer_dob: string | null;
    customer_phone: string;
    referrer: string | null;
    product_quantity: number;
    product_name: string;
    product_price: number;
    material_status: boolean;
    priority: 'regular' | 'urgent';
    service_type: 'make_new' | 'fix_update';
    order_date: string;
    sample_testing_appointment_date: string;
    delivery_appointment_date: string | null;
    actual_sample_testing_date: string | null;
    actual_delivery_date: string | null;
    staff_in_charge: 'tailor' | 'decorator' | 'both';
    updates_log: UpdateLog[];
    created_at: string;
    updated_at: string;
    current_stage?: TaskStage;
    scheduled_date?: string;
    scheduled_time_slot?: TimeSlot;
}

export interface CreateOrderData {
    customer_name: string;
    customer_dob: string | null;
    customer_phone: string;
    referrer: string | null;
    product_quantity: number;
    product_name: string;
    product_price: number;
    material_status: boolean;
    priority: 'regular' | 'urgent';
    service_type: 'make_new' | 'fix_update';
    order_date: string;
    staff_in_charge: 'tailor' | 'decorator' | 'both';
    actual_sample_testing_date: string | null;
    actual_delivery_date: string | null;
}

export interface UpdateOrderData {
    customer_name?: string;
    customer_dob?: string | null;
    customer_phone?: string;
    referrer?: string | null;
    product_quantity?: number;
    product_name?: string;
    product_price?: number;
    material_status?: boolean;
    priority?: 'regular' | 'urgent';
    service_type?: 'make_new' | 'fix_update';
    order_date?: string;
    sample_testing_appointment_date?: string;
    delivery_appointment_date?: string | null;
    actual_sample_testing_date?: string | null;
    actual_delivery_date?: string | null;
    staff_in_charge?: 'tailor' | 'decorator' | 'both';
    updates_log?: UpdateLog[];
}

export interface ProgressTracking {
    id: string;
    order_id: string;
    order_date: string;
    sample_testing_appointment_date: string;
    actual_sample_testing_date: string | null;
    delivery_appointment_date: string | null;
    actual_delivery_date: string | null;
    additional_days_after_testing: number;
    status: 'pending' | 'in_progress' | 'completed' | 'delayed';
    overtime_required: boolean;
    created_at: string;
    updated_at: string;
}

export interface StaffLeave {
    id: string;
    staff_name: 'tailor' | 'decorator';
    leave_date: string;
    is_sunday: boolean;
    created_at: string;
}

export type StaffType = 'tailor' | 'decorator' | 'both';

// Database schema for Supabase
export interface Database {
    public: {
        Tables: {
            orders: {
                Row: Order;
                Insert: CreateOrderData;
                Update: UpdateOrderData;
            };
            progress_tracking: {
                Row: ProgressTracking;
                Insert: Omit<ProgressTracking, 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Omit<ProgressTracking, 'id' | 'created_at' | 'updated_at'>>;
            };
            staff_leave: {
                Row: StaffLeave;
                Insert: Omit<StaffLeave, 'id' | 'created_at'>;
                Update: Partial<Omit<StaffLeave, 'id' | 'created_at'>>;
            };
        };
    };
}