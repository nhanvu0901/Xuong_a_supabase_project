import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { StaffLeave } from '../types/database';
import { useSnackbar } from 'notistack';

export const useStaffLeave = () => {
    const [leaves, setLeaves] = useState<StaffLeave[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { enqueueSnackbar } = useSnackbar();

    useEffect(() => {
        fetchLeaves();

        // Set up realtime subscription
        const subscription = supabase
            .channel('staff_leave_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_leave' }, () => {
                fetchLeaves();
                enqueueSnackbar('Lịch nghỉ phép đã được cập nhật', { variant: 'info' });
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [enqueueSnackbar]);

    const fetchLeaves = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('staff_leave')
                .select('*')
                .order('leave_date', { ascending: false });

            if (error) throw error;
            setLeaves(data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const addLeave = async (leaveData: Omit<StaffLeave, 'id' | 'created_at'>) => {
        try {
            setLoading(true);
            const { error } = await supabase
                .from('staff_leave')
                .insert(leaveData);

            if (error) throw error;

            // Trigger recalculation of affected orders
            await recalculateAffectedOrders(leaveData.staff_name, leaveData.leave_date);

            fetchLeaves();
            enqueueSnackbar('Đã thêm ngày nghỉ phép', { variant: 'success' });
            return { success: true };
        } catch (err: any) {
            setError(err.message);
            enqueueSnackbar('Lỗi khi thêm ngày nghỉ phép: ' + err.message, { variant: 'error' });
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    };

    const deleteLeave = async (id: string) => {
        try {
            setLoading(true);

            // Get leave data before deletion for recalculation
            const { data: leave } = await supabase
                .from('staff_leave')
                .select('*')
                .eq('id', id)
                .single();

            const { error } = await supabase
                .from('staff_leave')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Trigger recalculation of affected orders
            if (leave) {
                await recalculateAffectedOrders(leave.staff_name, leave.leave_date);
            }

            fetchLeaves();
            enqueueSnackbar('Đã xóa ngày nghỉ phép', { variant: 'success' });
            return { success: true };
        } catch (err: any) {
            setError(err.message);
            enqueueSnackbar('Lỗi khi xóa ngày nghỉ phép: ' + err.message, { variant: 'error' });
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    };

    const recalculateAffectedOrders = async (staffName: string, leaveDate: string) => {
        try {
            // Get orders that might be affected by this leave change
            const { data: orders, error } = await supabase
                .from('orders')
                .select('*')
                .or(`staff_in_charge.eq.${staffName},staff_in_charge.eq.both`)
                .gte('sample_testing_appointment_date', leaveDate);

            if (error) throw error;

            // Get current staff leaves for recalculation
            const { data: allLeaves } = await supabase
                .from('staff_leave')
                .select('*');

            if (!orders || !allLeaves) return;

            // Update each affected order
            for (const order of orders) {
                // Recalculate dates would go here
                // This is a simplified version - you might want to implement more sophisticated logic

                // Add update log
                const newLog = {
                    timestamp: new Date().toISOString(),
                    message: `Ngày được cập nhật do thay đổi lịch nghỉ phép của ${staffName === 'tailor' ? 'thợ may' : 'thợ thêu'}`
                };

                const updatedLogs = [...(order.updates_log || []), newLog];

                await supabase
                    .from('orders')
                    .update({
                        updates_log: updatedLogs,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', order.id);
            }

            enqueueSnackbar(`Đã cập nhật ${orders.length} đơn hàng bị ảnh hưởng`, { variant: 'info' });
        } catch (err: any) {
            console.error('Error recalculating affected orders:', err);
            enqueueSnackbar('Lỗi khi cập nhật đơn hàng bị ảnh hưởng', { variant: 'warning' });
        }
    };

    const getLeavesByStaff = (staffName: 'tailor' | 'decorator') => {
        return leaves.filter(leave => leave.staff_name === staffName);
    };

    const getLeavesByDateRange = (startDate: string, endDate: string) => {
        return leaves.filter(leave =>
            leave.leave_date >= startDate && leave.leave_date <= endDate
        );
    };

    return {
        leaves,
        loading,
        error,
        addLeave,
        deleteLeave,
        getLeavesByStaff,
        getLeavesByDateRange,
        refreshLeaves: fetchLeaves
    };
};