import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
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
            const processedOrders = (data || []).map((order: Order) => ({
                ...order,
                current_stage: determineCurrentStage(order)
            }));

            setOrders(processedOrders);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
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
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
        }
    };

    const determineCurrentStage = (order: Order): TaskStage => {
        // Simple logic to determine current stage
        if (order.actual_delivery_date) {
            return {
                id: 'completed',
                name: 'decoration',
                duration_hours: 0,
                completed: true,
                started_at: order.order_date,
                completed_at: order.actual_delivery_date
            };
        }

        if (order.actual_sample_testing_date) {
            return {
                id: 'in_progress',
                name: 'final_sewing',
                duration_hours: 2,
                completed: false,
                started_at: order.actual_sample_testing_date,
                completed_at: order.actual_delivery_date || undefined
            };
        }

        return {
            id: 'pending',
            name: 'first_sewing',
            duration_hours: 6,
            completed: false,
            started_at: order.order_date,
            completed_at: undefined
        };
    };

    const createOrder = async (orderData: CreateOrderData) => {
        try {
            // Determine if decoration is needed based on staff_in_charge
            const needsDecoration = orderData.staff_in_charge === 'decorator' ||
                orderData.staff_in_charge === 'both';

            // Calculate dates based on current capacity and leaves
            const sampleTestingDate = calculateSampleTestingDate(
                orderData.order_date,
                orderData.material_status,
                orderData.priority,
                orderData.service_type,
                staffLeaves,
                orders
            );

            const deliveryDate = orderData.priority === 'regular'
                ? calculateDeliveryDate(
                    sampleTestingDate,
                    orderData.service_type,
                    needsDecoration,
                    0, // additionalDays
                    staffLeaves,
                    orders,
                    orderData.priority
                )
                : orderData.actual_delivery_date;

            // Calculate overtime for urgent orders
            let overtimeRequired = false;
            if (orderData.priority === 'urgent' && deliveryDate) {
                const calculatedDate = calculateDeliveryDate(
                    sampleTestingDate,
                    orderData.service_type,
                    needsDecoration,
                    0,
                    staffLeaves,
                    orders,
                    'regular' // Calculate as regular to compare
                );
                overtimeRequired = calculateOvertimeRequired(
                    deliveryDate,
                    calculatedDate || sampleTestingDate
                );
            }

            const newOrder = {
                ...orderData,
                sample_testing_appointment_date: sampleTestingDate,
                delivery_appointment_date: deliveryDate,
                updates_log: []
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
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            console.error('Error in createOrder:', err);
            return { success: false, error: errorMessage };
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
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            return { success: false, error: errorMessage };
        }
    };

    const handleOrderChange = () => {
        fetchOrders();
    };

    const handleLeaveChange = () => {
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