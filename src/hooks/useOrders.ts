import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Order, CreateOrderData, UpdateOrderData, StaffLeave, TaskStage } from '../types/database';
import {
    calculateSampleTestingDate,
    calculateDeliveryDate,
    calculateOvertimeRequired,
    getQueuePosition,
    getTaskDuration
} from '../utils/dateUtils';

export const useOrders = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [staffLeaves, setStaffLeaves] = useState<StaffLeave[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchOrders();
        fetchStaffLeaves();

        // Set up realtime subscription
        const ordersSubscription = supabase
            .channel('orders_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handleOrderChange)
            .subscribe();

        const leavesSubscription = supabase
            .channel('leaves_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_leave' }, handleLeaveChange)
            .subscribe();

        return () => {
            ordersSubscription.unsubscribe();
            leavesSubscription.unsubscribe();
        };
    }, []);

    const fetchOrders = async () => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Process orders to add current stage information
            const processedOrders = (data || []).map(order => ({
                ...order,
                current_stage: determineCurrentStage(order)
            }));

            setOrders(processedOrders);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchStaffLeaves = async () => {
        try {
            const { data, error } = await supabase
                .from('staff_leave')
                .select('*')
                .order('leave_date', { ascending: true });

            if (error) throw error;
            setStaffLeaves(data || []);
        } catch (err) {
            setError(err.message);
        }
    };

    const determineCurrentStage = (order: Order): TaskStage | undefined => {
        if (order.service_type === 'fix_update') {
            return {
                id: 'fix_' + order.id,
                name: 'fix_update',
                duration_hours: 2,
                completed: order.actual_delivery_date !== null,
                started_at: order.order_date,
                completed_at: order.actual_delivery_date
            };
        }

        // For make_new orders, determine stage based on dates and progress
        // This is simplified - in production, you'd track actual stage completion
        const today = new Date().toISOString().split('T')[0];

        if (!order.actual_sample_testing_date) {
            return {
                id: 'sew1_' + order.id,
                name: 'first_sewing',
                duration_hours: 6,
                completed: false
            };
        }

        const daysSinceTesting = Math.floor(
            (new Date(today).getTime() - new Date(order.actual_sample_testing_date).getTime())
            / (1000 * 60 * 60 * 24)
        );

        if (daysSinceTesting === 0) {
            return {
                id: 'fit_' + order.id,
                name: 'first_fitting',
                duration_hours: 0.5,
                completed: false
            };
        } else if (daysSinceTesting === 1) {
            return {
                id: 'alter_' + order.id,
                name: 'alteration',
                duration_hours: 2,
                completed: false
            };
        } else if (daysSinceTesting === 2) {
            return {
                id: 'sew2_' + order.id,
                name: 'final_sewing',
                duration_hours: 2,
                completed: false
            };
        } else if (daysSinceTesting >= 3 && order.staff_in_charge !== 'tailor') {
            return {
                id: 'deco_' + order.id,
                name: 'decoration',
                duration_hours: 8,
                completed: order.actual_delivery_date !== null
            };
        }

        return undefined;
    };

    const createOrder = async (orderData: CreateOrderData) => {
        try {
            const needsDecoration = orderData.staff_in_charge === 'decorator' ||
                orderData.staff_in_charge === 'both';

            // Calculate dates
            const sampleTestingDate = calculateSampleTestingDate(
                orderData.order_date,
                orderData.material_status,
                orderData.priority,
                orderData.service_type,
                staffLeaves,
                orders
            );

            const deliveryDate = orderData.priority === 'urgent' && orderData.actual_delivery_date
                ? orderData.actual_delivery_date
                : calculateDeliveryDate(
                    sampleTestingDate,
                    orderData.service_type,
                    needsDecoration,
                    0,
                    staffLeaves,
                    orders,
                    orderData.priority
                );

            const overtimeRequired = orderData.priority === 'urgent' &&
                calculateOvertimeRequired(orderData.actual_delivery_date || deliveryDate, deliveryDate);

            // Get queue position
            const queuePosition = getQueuePosition(orders, orderData.priority);

            const newOrder = {
                ...orderData,
                sample_testing_appointment_date: sampleTestingDate,
                delivery_appointment_date: deliveryDate,
                updates_log: [{
                    timestamp: new Date().toISOString(),
                    message: `Đơn hàng được tạo - Vị trí hàng đợi: ${queuePosition}`
                }]
            };

            const { data, error } = await supabase
                .from('orders')
                .insert([newOrder])
                .select()
                .single();

            if (error) throw error;

            // Also create progress tracking entry
            await supabase.from('progress_tracking').insert([{
                order_id: data.id,
                order_date: orderData.order_date,
                sample_testing_appointment_date: sampleTestingDate,
                delivery_appointment_date: deliveryDate,
                actual_sample_testing_date: null,
                actual_delivery_date: orderData.actual_delivery_date,
                additional_days_after_testing: 0,
                status: 'pending',
                overtime_required: overtimeRequired
            }]);

            await fetchOrders();
            return { success: true, data };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    const updateOrder = async (id: string, updates: UpdateOrderData) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            await fetchOrders();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    const handleOrderChange = (payload: any) => {
        fetchOrders();
    };

    const handleLeaveChange = (payload: any) => {
        fetchStaffLeaves();
        // Recalculate dates for affected orders
        recalculateDates();
    };

    const recalculateDates = async () => {
        // This would recalculate dates for all pending orders
        // when staff leaves change
        console.log('Recalculating dates due to leave changes...');
        fetchOrders();
    };

    return {
        orders,
        loading,
        error,
        createOrder,
        updateOrder,
        refresh: fetchOrders
    };
};
