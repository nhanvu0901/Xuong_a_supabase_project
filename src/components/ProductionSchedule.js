import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format, addDays, isSunday, differenceInDays } from 'date-fns';
import { vi } from 'date-fns/locale';

const ProductionSchedule = () => {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notifications, setNotifications] = useState([]);

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
    }, []);

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

    const handleEmployeeScheduleChange = async (payload) => {
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
                    updates.scheduled_fitting_date = calculateNextWorkingDay(new Date(offDate));
                    updates.adjustment_reason = 'Điều chỉnh do lịch nghỉ nhân viên';
                }

                if (schedule.scheduled_pickup_date === offDate) {
                    updates.scheduled_pickup_date = calculateNextWorkingDay(new Date(offDate));
                    updates.adjustment_reason = 'Điều chỉnh do lịch nghỉ nhân viên';
                }

                await supabase
                    .from('production_schedule')
                    .update(updates)
                    .eq('id', schedule.id);
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

        return nextDay;
    };

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
                    updates.adjustment_reason = 'Tự động điều chỉnh do thay đổi ngày thử phôi thực tế';

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

    const calculateWorkingDays = async (startDate, days) => {
        let currentDate = new Date(startDate);
        let workingDaysAdded = 0;

        while (workingDaysAdded < days) {
            currentDate = addDays(currentDate, 1);

            // Check if it's a working day (not Sunday and not a day off)
            if (!isSunday(currentDate)) {
                const { data: daySchedule } = await supabase
                    .from('employee_schedule')
                    .select('is_working')
                    .eq('date', format(currentDate, 'yyyy-MM-dd'))
                    .single();

                if (!daySchedule || daySchedule.is_working !== false) {
                    workingDaysAdded++;
                }
            }
        }

        return currentDate;
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'waiting_material': return 'status-pending';
            case 'sewing': return 'status-in-progress';
            case 'fitting': return 'status-warning';
            case 'finishing': return 'status-in-progress';
            case 'decorating': return 'status-in-progress';
            case 'completed': return 'status-completed';
            default: return 'status-pending';
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'waiting_material': return 'Chờ vải';
            case 'sewing': return 'Đang may';
            case 'fitting': return 'Thử phôi';
            case 'finishing': return 'Hoàn thiện';
            case 'decorating': return 'Trang trí';
            case 'completed': return 'Hoàn thành';
            default: return status;
        }
    };

    const formatDate = (date) => {
        if (!date) return '-';
        return format(new Date(date), 'dd/MM/yyyy', { locale: vi });
    };

    const isDelayed = (scheduledDate, actualDate, status) => {
        if (!scheduledDate || status === 'completed') return false;
        const today = new Date();
        const scheduled = new Date(scheduledDate);
        return today > scheduled && !actualDate;
    };

    const isEarly = (scheduledDate, actualDate) => {
        if (!scheduledDate || !actualDate) return false;
        return new Date(actualDate) < new Date(scheduledDate);
    };

    const removeNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    if (loading) return <div className="loading">Đang tải...</div>;
    if (error) return <div className="error">Lỗi: {error}</div>;

    return (
        <div className="card">
            <div className="card-header">
                Bảng theo dõi tiến độ sản xuất
            </div>
            <div className="card-body">
                {/* Notifications */}
                {notifications.length > 0 && (
                    <div className="notifications-container">
                        {notifications.map(notification => (
                            <div key={notification.id} className={`alert alert-${notification.type}`}>
                                {notification.message}
                                <button
                                    onClick={() => removeNotification(notification.id)}
                                    className="close-btn"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                        <thead>
                        <tr>
                            <th>Khách hàng</th>
                            <th>Sản phẩm</th>
                            <th>Số lượng</th>
                            <th>Loại đơn</th>
                            <th>Ngày nhận đơn</th>
                            <th>Ngày hẹn thử phôi</th>
                            <th>Ngày thử phôi thực tế</th>
                            <th>Ngày hẹn lấy hàng</th>
                            <th>Ngày lấy hàng thực tế</th>
                            <th>Trạng thái</th>
                            <th>Ghi chú</th>
                            <th>Lý do điều chỉnh</th>
                            <th>Thao tác</th>
                        </tr>
                        </thead>
                        <tbody>
                        {schedules.map((schedule) => {
                            const delayed = isDelayed(schedule.scheduled_pickup_date, schedule.actual_pickup_date, schedule.status);
                            const early = isEarly(schedule.scheduled_pickup_date, schedule.actual_pickup_date);
                            const isUrgent = schedule.orders?.priority === 'urgent';

                            return (
                                <tr key={schedule.id} className={delayed ? 'delayed-row' : early ? 'early-row' : ''}>
                                    <td>{schedule.orders?.customers?.name}</td>
                                    <td>{schedule.order_items?.products?.name}</td>
                                    <td>{schedule.order_items?.quantity}</td>
                                    <td>
                                            <span className={`status-badge ${isUrgent ? 'status-urgent' : 'status-normal'}`}>
                                                {isUrgent ? 'GẤP' : 'THƯỜNG'}
                                            </span>
                                    </td>
                                    <td>{formatDate(schedule.orders?.order_date)}</td>
                                    <td>{formatDate(schedule.scheduled_fitting_date)}</td>
                                    <td>
                                        <input
                                            type="date"
                                            value={schedule.actual_fitting_date || ''}
                                            onChange={(e) => updateActualDate(schedule.id, 'actual_fitting_date', e.target.value)}
                                            className="form-input"
                                            style={{ width: '150px' }}
                                        />
                                    </td>
                                    <td>
                                        {/* Only show scheduled pickup date for REGULAR orders */}
                                        {!isUrgent && formatDate(schedule.scheduled_pickup_date)}
                                    </td>
                                    <td>
                                        {/* Show actual delivery date for URGENT orders, actual pickup for REGULAR */}
                                        {isUrgent ? (
                                            <span className="urgent-delivery">
                                                    {formatDate(schedule.orders?.actual_delivery_date)}
                                                </span>
                                        ) : (
                                            <input
                                                type="date"
                                                value={schedule.actual_pickup_date || ''}
                                                onChange={(e) => updateActualDate(schedule.id, 'actual_pickup_date', e.target.value)}
                                                className="form-input"
                                                style={{ width: '150px' }}
                                            />
                                        )}
                                    </td>
                                    <td>
                                            <span className={`status-badge ${getStatusColor(schedule.status)}`}>
                                                {getStatusText(schedule.status)}
                                            </span>
                                    </td>
                                    <td>{schedule.notes || '-'}</td>
                                    <td>
                                        {schedule.adjustment_reason && (
                                            <span className="adjustment-reason">
                                                    {schedule.adjustment_reason}
                                                </span>
                                        )}
                                    </td>
                                    <td>
                                        <select
                                            value={schedule.status}
                                            onChange={(e) => updateStatus(schedule.id, e.target.value)}
                                            className="form-select"
                                        >
                                            <option value="waiting_material">Chờ vải</option>
                                            <option value="sewing">Đang may</option>
                                            <option value="fitting">Thử phôi</option>
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

    async function updateStatus(scheduleId, newStatus) {
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
    }
};

export default ProductionSchedule;