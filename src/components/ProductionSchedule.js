import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { format, addDays, isSunday, differenceInDays } from 'date-fns';
import { vi } from 'date-fns/locale';

const ProductionSchedule = () => {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notifications, setNotifications] = useState([]);

    const fetchSchedules = async () => {
        try {
            setLoading(true);

            const { data, error } = await supabase
                .from('production_schedule')
                .select(`
                    *,
                    orders (
                        id,
                        order_date,
                        priority,
                        actual_delivery_date,
                        customers (
                            name
                        )
                    ),
                    order_items (
                        quantity,
                        notes,
                        products (
                            name,
                            type
                        )
                    )
                `)
                .order('scheduled_fitting_date', { ascending: true });

            if (error) throw error;

            setSchedules(data || []);
        } catch (error) {
            console.error('Error fetching schedules:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const adjustSchedulesForDayOff = async (offDate) => {
        try {
            // Fetch schedules that might be affected by this day off
            const { data: affectedSchedules, error } = await supabase
                .from('production_schedule')
                .select('*')
                .or(`scheduled_fitting_date.eq.${offDate},scheduled_pickup_date.eq.${offDate}`);

            if (error) throw error;

            // Adjust each affected schedule by moving to next working day
            for (const schedule of affectedSchedules) {
                let updates = {};

                if (schedule.scheduled_fitting_date === offDate) {
                    updates.scheduled_fitting_date = await calculateNextWorkingDay(new Date(offDate));
                }

                if (schedule.scheduled_pickup_date === offDate) {
                    updates.scheduled_pickup_date = await calculateNextWorkingDay(new Date(offDate));
                }

                if (Object.keys(updates).length > 0) {
                    await supabase
                        .from('production_schedule')
                        .update(updates)
                        .eq('id', schedule.id);
                }
            }

            // Refresh schedules
            fetchSchedules();
        } catch (error) {
            console.error('Error adjusting schedules for day off:', error);
        }
    };

    const calculateNextWorkingDay = async (date) => {
        let nextDay = addDays(date, 1);

        // Check employee schedule to find next working day
        while (true) {
            if (!isSunday(nextDay)) {
                const { data: daySchedule } = await supabase
                    .from('employee_schedule')
                    .select('is_working')
                    .eq('date', format(nextDay, 'yyyy-MM-dd'))
                    .single();

                if (!daySchedule || daySchedule.is_working !== false) {
                    break;
                }
            }
            nextDay = addDays(nextDay, 1);
        }

        return format(nextDay, 'yyyy-MM-dd');
    };

    const handleEmployeeScheduleChange = useCallback(async (payload) => {
        // When employee schedule changes, check if we need to adjust production schedules
        if (payload.new && !payload.new.is_working && !isSunday(new Date(payload.new.date))) {
            // Employee is off on a non-Sunday, adjust affected schedules
            await adjustSchedulesForDayOff(payload.new.date);
            setNotifications(prev => [...prev, {
                id: Date.now(),
                message: `Lịch sản xuất đã được điều chỉnh do nhân viên nghỉ ngày ${format(new Date(payload.new.date), 'dd/MM/yyyy', { locale: vi })}`,
                type: 'warning'
            }]);
        }
    }, []);

    useEffect(() => {
        fetchSchedules();
        // Subscribe to employee schedule changes
        const subscription = supabase
            .channel('employee-schedule-changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'employee_schedule' },
                handleEmployeeScheduleChange
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [handleEmployeeScheduleChange]);

    const updateActualDate = async (scheduleId, field, value) => {
        try {
            const schedule = schedules.find(s => s.id === scheduleId);
            const updates = { [field]: value };

            // Auto-update delivery date for REGULAR orders when actual fitting date changes
            if (field === 'actual_fitting_date' && schedule.orders?.priority === 'normal') {
                const scheduledFittingDate = new Date(schedule.scheduled_fitting_date);
                const actualFittingDate = new Date(value);

                if (actualFittingDate.getTime() !== scheduledFittingDate.getTime()) {
                    // Calculate the difference in days
                    const daysDifference = differenceInDays(actualFittingDate, scheduledFittingDate);

                    // Adjust the scheduled pickup date accordingly
                    const originalPickupDate = new Date(schedule.scheduled_pickup_date);
                    const newPickupDate = addDays(originalPickupDate, daysDifference);

                    // Make sure it's a working day
                    updates.scheduled_pickup_date = await calculateNextWorkingDay(newPickupDate);

                    // Add notification
                    setNotifications(prev => [...prev, {
                        id: Date.now(),
                        message: `Ngày hẹn lấy hàng đã được tự động cập nhật cho đơn của ${schedule.orders?.customers?.name}`,
                        type: 'info'
                    }]);
                }
            }

            const { error } = await supabase
                .from('production_schedule')
                .update(updates)
                .eq('id', scheduleId);

            if (error) throw error;

            // Refresh data
            fetchSchedules();

            // If pickup date is updated and it's earlier than scheduled, adjust other schedules
            if (field === 'actual_pickup_date' && value) {
                const scheduledDate = new Date(schedule.scheduled_pickup_date);
                const actualDate = new Date(value);
                if (actualDate < scheduledDate) {
                    await adjustSchedulesForEarlyPickup(scheduleId, value);
                }
            }
        } catch (error) {
            console.error('Error updating date:', error);
            setError(error.message);
        }
    };

    const adjustSchedulesForEarlyPickup = async (completedScheduleId, actualPickupDate) => {
        // This would implement the logic to speed up other schedules
        // when one is completed early
        console.log('Adjusting schedules for early pickup:', completedScheduleId, actualPickupDate);

        // Add notification
        setNotifications(prev => [...prev, {
            id: Date.now(),
            message: 'Lịch sản xuất có thể được điều chỉnh do hoàn thành sớm',
            type: 'success'
        }]);
    };

    const updateStatus = async (scheduleId, newStatus) => {
        try {
            const { error } = await supabase
                .from('production_schedule')
                .update({ status: newStatus })
                .eq('id', scheduleId);

            if (error) throw error;
            fetchSchedules();
        } catch (error) {
            console.error('Error updating status:', error);
            setError(error.message);
        }
    };

    if (loading) {
        return <div className="loading">Đang tải...</div>;
    }

    if (error) {
        return <div className="error">Lỗi: {error}</div>;
    }

    return (
        <div className="production-schedule-container">
            <div className="header">
                <h2>Lịch Sản Xuất</h2>

                {/* Notifications */}
                {notifications.length > 0 && (
                    <div className="notifications">
                        {notifications.slice(0, 3).map(notification => (
                            <div key={notification.id} className={`notification ${notification.type}`}>
                                {notification.message}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="content">
                <div className="table-container">
                    <table>
                        <thead>
                        <tr>
                            <th>Mã ĐH</th>
                            <th>Khách hàng</th>
                            <th>Sản phẩm</th>
                            <th>Ưu tiên</th>
                            <th>Ngày thử (Dự kiến)</th>
                            <th>Ngày thử (Thực tế)</th>
                            <th>Ngày lấy (Dự kiến)</th>
                            <th>Ngày lấy (Thực tế)</th>
                            <th>Trạng thái</th>
                        </tr>
                        </thead>
                        <tbody>
                        {schedules.map(schedule => {
                            const productName = schedule.order_items?.products?.name ||
                                schedule.order_items?.notes ||
                                'Sản phẩm';
                            return (
                                <tr key={schedule.id}>
                                    <td>#{schedule.order_id?.slice(0, 8)}</td>
                                    <td>{schedule.orders?.customers?.name}</td>
                                    <td>
                                        {productName}
                                        {schedule.order_items?.quantity > 1 && ` x${schedule.order_items.quantity}`}
                                        {schedule.order_items?.products?.type === 'ao_dai' &&
                                            <span className="badge">Áo dài</span>}
                                    </td>
                                    <td>
                                        <span className={`priority-badge ${schedule.orders?.priority === 'urgent' ? 'urgent' : 'normal'}`}>
                                            {schedule.orders?.priority === 'urgent' ? 'Khẩn cấp' : 'Thường'}
                                        </span>
                                    </td>
                                    <td>
                                        {schedule.scheduled_fitting_date &&
                                            format(new Date(schedule.scheduled_fitting_date), 'dd/MM/yyyy')}
                                    </td>
                                    <td>
                                        <input
                                            type="date"
                                            value={schedule.actual_fitting_date || ''}
                                            onChange={(e) => updateActualDate(schedule.id, 'actual_fitting_date', e.target.value)}
                                            className="date-input"
                                        />
                                    </td>
                                    <td>
                                        {schedule.scheduled_pickup_date &&
                                            format(new Date(schedule.scheduled_pickup_date), 'dd/MM/yyyy')}
                                        {schedule.requires_overtime && (
                                            <span className="overtime-badge">
                                                OT: {schedule.overtime_hours}h
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        <input
                                            type="date"
                                            value={schedule.actual_pickup_date || ''}
                                            onChange={(e) => updateActualDate(schedule.id, 'actual_pickup_date', e.target.value)}
                                            className="date-input"
                                        />
                                    </td>
                                    <td>
                                        <select
                                            value={schedule.status}
                                            onChange={(e) => updateStatus(schedule.id, e.target.value)}
                                            className={`status-select status-${schedule.status}`}
                                        >
                                            <option value="pending">Chờ xử lý</option>
                                            <option value="pending_material">Chờ vật liệu</option>
                                            <option value="cutting">Cắt vải</option>
                                            <option value="sewing">May</option>
                                            <option value="finishing">Hoàn thiện</option>
                                            <option value="decorating">Trang trí</option>
                                            <option value="completed">Hoàn thành</option>
                                        </select>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                    {schedules.length === 0 && (
                        <div className="empty-state">
                            Chưa có lịch sản xuất nào
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductionSchedule;