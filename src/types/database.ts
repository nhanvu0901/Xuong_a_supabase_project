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
    service_type: 'make_new' | 'fix_update'; // NEW
    order_date: string;
    sample_testing_appointment_date: string;
    delivery_appointment_date: string;
    actual_sample_testing_date: string | null;
    actual_delivery_date: string | null;
    staff_in_charge: 'tailor' | 'decorator' | 'both';
    updates_log: UpdateLog[];
    created_at: string;
    updated_at: string;
    current_stage?: TaskStage; // NEW
    scheduled_date?: string; // NEW
    scheduled_time_slot?: TimeSlot; // NEW
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