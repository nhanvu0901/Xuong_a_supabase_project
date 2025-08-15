import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameMonth,
    isToday,
    isSunday,
    addMonths,
    subMonths
} from 'date-fns';
import { vi } from 'date-fns/locale';

const EmployeeSchedule = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [schedules, setSchedules] = useState([]);
    const [productionSchedules, setProductionSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const employees = [
        { name: 'Thợ may', type: 'sewer' },
        { name: 'Thợ trang trí', type: 'decorator' }
    ];

    useEffect(() => {
        fetchSchedules();
        fetchProductionSchedules();
    }, [currentDate]);

    const fetchSchedules = async () => {
        try {
            const startDate = startOfMonth(currentDate);
            const endDate = endOfMonth(currentDate);

            const { data, error } = await supabase
                .from('employee_schedule')
                .select('*')
                .gte('date', format(startDate, 'yyyy-MM-dd'))
                .lte('date', format(endDate, 'yyyy-MM-dd'))
                .order('date');

            if (error) throw error;
            setSchedules(data || []);
        } catch (error) {
            console.error('Error fetching employee schedules:', error);
            setError(error.message);
        }
    };

    const fetchProductionSchedules = async () => {
        try {
            const startDate = startOfMonth(currentDate);
            const endDate = endOfMonth(currentDate);

            const { data, error } = await supabase
                .from('production_schedule')
                .select(`
          *,
          orders (
            customers (name)
          ),
          order_items (
            products (name)
          )
        `)
                .or(`scheduled_fitting_date.gte.${format(startDate, 'yyyy-MM-dd')},scheduled_pickup_date.gte.${format(startDate, 'yyyy-MM-dd')}`)
                .or(`scheduled_fitting_date.lte.${format(endDate, 'yyyy-MM-dd')},scheduled_pickup_date.lte.${format(endDate, 'yyyy-MM-dd')}`)
                .order('scheduled_fitting_date');

            if (error) throw error;
            setProductionSchedules(data || []);
        } catch (error) {
            console.error('Error fetching production schedules:', error);
        } finally {
            setLoading(false);
        }
    };

    const getEmployeeSchedule = (date, employeeType) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return schedules.find(s => s.date === dateStr && s.employee_type === employeeType);
    };

    const getProductionEvents = (date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return productionSchedules.filter(ps =>
            ps.scheduled_fitting_date === dateStr || ps.scheduled_pickup_date === dateStr
        );
    };

    const updateEmployeeSchedule = async (date, employeeType, isWorking, isOvertime = false, notes = '') => {
        try {
            const dateStr = format(date, 'yyyy-MM-dd');
            const existingSchedule = getEmployeeSchedule(date, employeeType);

            if (existingSchedule) {
                const { error } = await supabase
                    .from('employee_schedule')
                    .update({
                        is_working: isWorking,
                        is_overtime: isOvertime,
                        notes: notes
                    })
                    .eq('id', existingSchedule.id);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('employee_schedule')
                    .insert({
                        employee_name: employees.find(e => e.type === employeeType)?.name,
                        employee_type: employeeType,
                        date: dateStr,
                        is_working: isWorking,
                        is_overtime: isOvertime,
                        notes: notes
                    });

                if (error) throw error;
            }

            fetchSchedules();
        } catch (error) {
            console.error('Error updating employee schedule:', error);
            setError(error.message);
        }
    };

    const getDaysInMonth = () => {
        const start = startOfMonth(currentDate);
        const end = endOfMonth(currentDate);
        return eachDayOfInterval({ start, end });
    };

    const previousMonth = () => {
        setCurrentDate(subMonths(currentDate, 1));
    };

    const nextMonth = () => {
        setCurrentDate(addMonths(currentDate, 1));
    };

    const getWorkingStatus = (date, employeeType) => {
        const schedule = getEmployeeSchedule(date, employeeType);
        if (schedule) {
            return {
                isWorking: schedule.is_working,
                isOvertime: schedule.is_overtime,
                notes: schedule.notes
            };
        }

        // Default: working on weekdays (except Sunday), not working on Sunday
        return {
            isWorking: !isSunday(date),
            isOvertime: false,
            notes: ''
        };
    };

    const formatDate = (date) => {
        return format(date, 'dd/MM/yyyy', { locale: vi });
    };

    const formatDateShort = (date) => {
        return format(date, 'dd', { locale: vi });
    };

    const formatMonthYear = (date) => {
        return format(date, 'MMMM yyyy', { locale: vi });
    };

    if (loading) return <div className="loading">Đang tải...</div>;
    if (error) return <div className="error">Lỗi: {error}</div>;

    const days = getDaysInMonth();

    return (
        <div>
            {/* Calendar Header */}
            <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button onClick={previousMonth} className="btn btn-primary">‹ Tháng trước</button>
                    <h2>{formatMonthYear(currentDate)}</h2>
                    <button onClick={nextMonth} className="btn btn-primary">Tháng sau ›</button>
                </div>
            </div>

            {/* Employee Schedule Cards */}
            {employees.map(employee => (
                <div key={employee.type} className="card">
                    <div className="card-header">
                        Lịch làm việc - {employee.name}
                    </div>
                    <div className="card-body">
                        <div className="calendar-grid">
                            {/* Calendar days header */}
                            {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(day => (
                                <div key={day} className="calendar-header">
                                    {day}
                                </div>
                            ))}

                            {/* Calendar days */}
                            {days.map(date => {
                                const workingStatus = getWorkingStatus(date, employee.type);
                                const events = getProductionEvents(date);
                                const dayClasses = [
                                    'calendar-day',
                                    !isSameMonth(date, currentDate) && 'other-month',
                                    isToday(date) && 'today'
                                ].filter(Boolean).join(' ');

                                return (
                                    <div key={date.toISOString()} className={dayClasses}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                            <span>{formatDateShort(date)}</span>
                                            <div>
                                                <input
                                                    type="checkbox"
                                                    checked={workingStatus.isWorking}
                                                    onChange={(e) => updateEmployeeSchedule(
                                                        date,
                                                        employee.type,
                                                        e.target.checked,
                                                        workingStatus.isOvertime,
                                                        workingStatus.notes
                                                    )}
                                                    title="Có đi làm"
                                                />
                                                {workingStatus.isWorking && (
                                                    <input
                                                        type="checkbox"
                                                        checked={workingStatus.isOvertime}
                                                        onChange={(e) => updateEmployeeSchedule(
                                                            date,
                                                            employee.type,
                                                            workingStatus.isWorking,
                                                            e.target.checked,
                                                            workingStatus.notes
                                                        )}
                                                        title="Làm thêm giờ"
                                                        style={{ marginLeft: '5px' }}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        {/* Working status indicators */}
                                        <div style={{ marginBottom: '5px' }}>
                                            {!workingStatus.isWorking && (
                                                <span className="status-badge status-danger" style={{ fontSize: '10px' }}>
                          Nghỉ
                        </span>
                                            )}
                                            {workingStatus.isOvertime && (
                                                <span className="status-badge status-warning" style={{ fontSize: '10px' }}>
                          OT
                        </span>
                                            )}
                                        </div>

                                        {/* Production events */}
                                        <div className="calendar-events">
                                            {events.map(event => {
                                                const isFitting = event.scheduled_fitting_date === format(date, 'yyyy-MM-dd');
                                                const isPickup = event.scheduled_pickup_date === format(date, 'yyyy-MM-dd');

                                                // Only show events relevant to this employee type
                                                const isRelevantForEmployee =
                                                    (employee.type === 'sewer' && (isFitting || (isPickup && event.order_items?.products?.type === 'pants'))) ||
                                                    (employee.type === 'decorator' && isPickup && event.order_items?.products?.type === 'shirt');

                                                if (!isRelevantForEmployee) return null;

                                                return (
                                                    <div
                                                        key={event.id}
                                                        className={`calendar-event ${isFitting ? 'fitting' : 'pickup'}`}
                                                        title={`${event.orders?.customers?.name} - ${event.order_items?.products?.name}`}
                                                    >
                                                        {isFitting ? 'Thử' : 'Giao'}: {event.orders?.customers?.name}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Notes input */}
                                        {workingStatus.notes && (
                                            <div style={{ marginTop: '5px' }}>
                                                <small style={{ color: '#666', fontSize: '10px' }}>
                                                    {workingStatus.notes}
                                                </small>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ))}

            {/* Production Schedule Summary */}
            <div className="card">
                <div className="card-header">
                    Lịch sản xuất tháng {formatMonthYear(currentDate)}
                </div>
                <div className="card-body">
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table">
                            <thead>
                            <tr>
                                <th>Ngày</th>
                                <th>Loại sự kiện</th>
                                <th>Khách hàng</th>
                                <th>Sản phẩm</th>
                                <th>Trạng thái</th>
                                <th>Ghi chú</th>
                            </tr>
                            </thead>
                            <tbody>
                            {productionSchedules
                                .filter(ps => ps.scheduled_fitting_date || ps.scheduled_pickup_date)
                                .flatMap(ps => {
                                    const events = [];
                                    if (ps.scheduled_fitting_date) {
                                        events.push({
                                            ...ps,
                                            event_date: ps.scheduled_fitting_date,
                                            event_type: 'fitting'
                                        });
                                    }
                                    if (ps.scheduled_pickup_date) {
                                        events.push({
                                            ...ps,
                                            event_date: ps.scheduled_pickup_date,
                                            event_type: 'pickup'
                                        });
                                    }
                                    return events;
                                })
                                .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
                                .map(event => (
                                    <tr key={`${event.id}-${event.event_type}`}>
                                        <td>{formatDate(new Date(event.event_date))}</td>
                                        <td>
                        <span className={`status-badge ${event.event_type === 'fitting' ? 'status-warning' : 'status-success'}`}>
                          {event.event_type === 'fitting' ? 'Thử phôi' : 'Giao hàng'}
                        </span>
                                        </td>
                                        <td>{event.orders?.customers?.name}</td>
                                        <td>{event.order_items?.products?.name}</td>
                                        <td>
                        <span className={`status-badge ${event.requires_overtime ? 'status-overtime' : 'status-normal'}`}>
                          {event.requires_overtime ? 'Cần OT' : 'Bình thường'}
                        </span>
                                        </td>
                                        <td>{event.notes}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {productionSchedules.length === 0 && (
                            <div className="empty-state">
                                Không có lịch sản xuất nào trong tháng này
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="card">
                <div className="card-header">
                    Chú thích
                </div>
                <div className="card-body">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div className="calendar-event fitting" style={{ width: '20px', height: '15px' }}></div>
                            <span>Thử phôi</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div className="calendar-event pickup" style={{ width: '20px', height: '15px' }}></div>
                            <span>Giao hàng</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span className="status-badge status-warning">OT</span>
                            <span>Làm thêm giờ</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span className="status-badge status-danger">Nghỉ</span>
                            <span>Nghỉ làm</span>
                        </div>
                    </div>
                    <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
                        <p><strong>Cách sử dụng:</strong></p>
                        <ul style={{ marginLeft: '20px' }}>
                            <li>Tick vào ô đầu tiên để đánh dấu nhân viên có đi làm</li>
                            <li>Tick vào ô thứ hai để đánh dấu làm thêm giờ</li>
                            <li>Các sự kiện sản xuất sẽ hiển thị tự động dựa trên lịch trình</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmployeeSchedule;