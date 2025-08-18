import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Order, ProgressTracking, StaffLeave, CreateOrderData } from '../types/database';
import {
    calculateSampleTestingDate,
    calculateDeliveryDate,
    calculateOvertimeRequired
} from '../utils/dateUtils';

export const useOrders = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchOrders();

        // Set up realtime subscription
        const subscription = supabase
            .channel('orders_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchOrders();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const createOrder = async (orderData: CreateOrderData) => {
        try {
            setLoading(true);

            // Get staff leaves for calculations
            const { data: staffLeaves } = await supabase
                .from('staff_leave')
                .select('*');

            // Calculate dates
            const sampleTestingDate = calculateSampleTestingDate(
                orderData.order_date,
                orderData.material_status,
                orderData.priority,
                staffLeaves || []
            );

            const deliveryDate = orderData.priority === 'urgent' && orderData.actual_delivery_date
                ? orderData.actual_delivery_date
                : calculateDeliveryDate(sampleTestingDate, 0, staffLeaves || []);

            // Create order with calculated dates
            const finalOrderData = {
                ...orderData,
                sample_testing_appointment_date: sampleTestingDate,
                delivery_appointment_date: deliveryDate,
                updates_log: []
            };

            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert(finalOrderData)
                .select()
                .single();

            if (orderError) throw orderError;

            // Create progress tracking entry
            const overtimeRequired = orderData.priority === 'urgent' && orderData.actual_delivery_date
                ? calculateOvertimeRequired(orderData.actual_delivery_date, deliveryDate)
                : false;

            const progressData: Omit<ProgressTracking, 'id' | 'created_at' | 'updated_at'> = {
                order_id: order.id,
                order_date: orderData.order_date,
                sample_testing_appointment_date: sampleTestingDate,
                delivery_appointment_date: deliveryDate,
                actual_sample_testing_date: null,
                actual_delivery_date: orderData.priority === 'urgent' ? orderData.actual_delivery_date : null,
                additional_days_after_testing: 0,
                status: 'pending',
                overtime_required: overtimeRequired
            };

            const { error: progressError } = await supabase
                .from('progress_tracking')
                .insert(progressData);

            if (progressError) throw progressError;

            fetchOrders();
            return { success: true, order };
        } catch (err: any) {
            setError(err.message);
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    };

    const updateOrder = async (id: string, updates: Partial<Order>) => {
        try {
            setLoading(true);
            const { error } = await supabase
                .from('orders')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
            fetchOrders();
            return { success: true };
        } catch (err: any) {
            setError(err.message);
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    };

    const deleteOrder = async (id: string) => {
        try {
            setLoading(true);
            const { error } = await supabase
                .from('orders')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchOrders();
            return { success: true };
        } catch (err: any) {
            setError(err.message);
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    };

    const addUpdateLog = async (orderId: string, message: string) => {
        try {
            // Get current order
            const { data: order } = await supabase
                .from('orders')
                .select('updates_log')
                .eq('id', orderId)
                .single();

            if (!order) return;

            const newLog = {
                timestamp: new Date().toISOString(),
                message
            };

            const updatedLogs = [...(order.updates_log || []), newLog];

            await supabase
                .from('orders')
                .update({
                    updates_log: updatedLogs,
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId);

            fetchOrders();
        } catch (err: any) {
            console.error('Error adding update log:', err);
        }
    };

    return {
        orders,
        loading,
        error,
        createOrder,
        updateOrder,
        deleteOrder,
        addUpdateLog,
        refreshOrders: fetchOrders
    };
};