import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format, addDays, isWeekend, isSunday } from 'date-fns';
import { vi } from 'date-fns/locale';

const ProductionSchedule = () => {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchSchedules();
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

    const updateActualDate = async (scheduleId, field, value) => {
        try {
            const { error } = await supabase
                .from('production_schedule')
                .update({ [field]: value })
                .eq('id', scheduleId);

            if (error) throw error;

            // Refresh data
            fetchSchedules();

            // If pickup date is updated and it's earlier than scheduled, adjust other schedules
            if (field === 'actual_pickup_date') {
                await adjustSchedulesForEarlyPickup(scheduleId, value);
            }
        } catch (error) {
            console.error('Error updating date:', error);
            setError(error.message);
        }
    };

    const adjustSchedulesForEarlyPickup = async (completedScheduleId, actualPickupDate) => {
        // This function would implement the logic to speed up other schedules
        // when one is completed early, as mentioned in requirements
        console.log('Adjusting schedules for early pickup:', completedScheduleId, actualPickupDate);
    };

    const calculateWorkingDays = (startDate, days) => {
        let currentDate = new Date(startDate);
        let workingDaysAdded = 0;

        while (workingDaysAdded < days) {
            currentDate = addDays(currentDate, 1);

            // Skip Sundays (assuming Sunday is day off)
            if (!isSunday(currentDate)) {
                workingDaysAdded++;
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

    if (loading) return <div className="loading">Đang tải...</div>;
    if (error) return <div className="error">Lỗi: {error}</div>;

    return (
        <div className="card">
            <div className="card-header">
                Bảng theo dõi tiến độ sản xuất
            </div>
            <div className="card-body">
                <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                        <thead>
                        <tr>
                            <th>Khách hàng</th>
                            <th>Sản phẩm</th>
                            <th>Số lượng</th>
                            <th>Ngày nhận đơn</th>
                            <th>Ngày hẹn thử phôi</th>
                            <th>Ngày thử phôi thực tế</th>
                            <th>Ngày hẹn lấy hàng</th>
                            <th>Ngày lấy hàng thực tế</th>
                            <th>Trạng thái</th>
                            <th>Ghi chú</th>
                            <th>Thao tác</th>
                        </tr>
                        </thead>
                        <tbody>
                        {schedules.map((schedule) => {
                            const delayed = isDelayed(schedule.scheduled_pickup_date, schedule.actual_pickup_date, schedule.status);
                            const early = isEarly(schedule.scheduled_pickup_date, schedule.actual_pickup_date);

                            return (
                                <tr key={schedule.id} className={delayed ? 'delayed-row' : early ? 'early-row' : ''}>
                                    <td>{schedule.orders?.customers?.name}</td>
                                    <td>{schedule.order_items?.products?.name}</td>
                                    <td>{schedule.order_items?.quantity}</td>
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
                                    <td>{formatDate(schedule.scheduled_pickup_date)}</td>
                                    <td>
                                        <input
                                            type="date"
                                            value={schedule.actual_pickup_date || ''}
                                            onChange={(e) => updateActualDate(schedule.id, 'actual_pickup_date', e.target.value)}
                                            className="form-input"
                                            style={{ width: '150px' }}
                                        />
                                    </td>
                                    <td>
                      <span className={`status-badge ${getStatusColor(schedule.status)}`}>
                        {getStatusText(schedule.status)}
                      </span>
                                        {schedule.requires_overtime && (
                                            <span className="status-badge status-overtime" style={{ marginLeft: '5px' }}>
                          OT
                        </span>
                                        )}
                                        {delayed && (
                                            <span className="status-badge status-delayed" style={{ marginLeft: '5px' }}>
                          Trễ
                        </span>
                                        )}
                                        {early && (
                                            <span className="status-badge status-early" style={{ marginLeft: '5px' }}>
                          Sớm
                        </span>
                                        )}
                                    </td>
                                    <td>
                                        <input
                                            type="text"
                                            value={schedule.notes || ''}
                                            onChange={(e) => updateActualDate(schedule.id, 'notes', e.target.value)}
                                            className="form-input"
                                            placeholder="Ghi chú..."
                                            style={{ width: '150px' }}
                                        />
                                    </td>
                                    <td>
                                        <select
                                            value={schedule.status}
                                            onChange={(e) => updateActualDate(schedule.id, 'status', e.target.value)}
                                            className="form-select"
                                            style={{ width: '120px' }}
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
};

export default ProductionSchedule;