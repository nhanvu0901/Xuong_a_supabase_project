export interface Database {
    public: {
        Tables: {
            orders: {
                Row: Order;
                Insert: Omit<Order, 'id' | 'created_at' | 'updated_at' | 'sample_testing_appointment_date' | 'delivery_appointment_date' | 'updates_log'>;
                Update: Partial<Omit<Order, 'id' | 'created_at' | 'updated_at'>>;
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
    order_date: string;
    sample_testing_appointment_date: string;
    delivery_appointment_date: string;
    actual_sample_testing_date: string | null;
    actual_delivery_date: string | null;
    staff_in_charge: 'tailor' | 'decorator' | 'both';
    updates_log: UpdateLog[];
    created_at: string;
    updated_at: string;
}

export interface ProgressTracking {
    id: string;
    order_id: string;
    order_date: string;
    sample_testing_appointment_date: string;
    actual_sample_testing_date: string | null;
    delivery_appointment_date: string;
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

export interface UpdateLog {
    timestamp: string;
    message: string;
}

// Type for creating new orders (without calculated fields)
export type CreateOrderData = Omit<Order, 'id' | 'created_at' | 'updated_at' | 'sample_testing_appointment_date' | 'delivery_appointment_date' | 'updates_log'>;

// Type for updating orders
export type UpdateOrderData = Partial<Omit<Order, 'id' | 'created_at' | 'updated_at'>>;

export type Priority = 'regular' | 'urgent';
export type StaffType = 'tailor' | 'decorator' | 'both';
export type OrderStatus = 'pending' | 'in_progress' | 'completed' | 'delayed';