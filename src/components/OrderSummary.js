import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const OrderSummary = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notifications, setNotifications] = useState([]);

    const handleScheduleUpdate = useCallback((payload) => {
        // Add notification when schedule is updated
        setNotifications(prev => [...prev, {
            id: Date.now(),
            order_id: payload.new.order_id,
            message: 'Lịch sản xuất đã được cập nhật',
            timestamp: new Date(),
            type: 'schedule_update'
        }]);

        // Refresh orders to show updated dates
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);

            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    customers (
                        name,
                        birth_date,
                        phone,
                        organization,
                        referrer
                    ),
                    order_items (
                        id,
                        quantity,
                        unit_price,
                        notes,
                        products (
                            name,
                            type
                        )
                    ),
                    production_schedule (
                        scheduled_fitting_date,
                        scheduled_pickup_date,
                        actual_fitting_date,
                        actual_pickup_date,
                        status,
                        requires_overtime,
                        overtime_hours
                    )
                `)
                .order('order_date', { ascending: false });

            if (error) throw error;

            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();

        // Subscribe to production schedule changes for notifications
        const subscription = supabase
            .channel('production-updates')
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'production_schedule' },
                handleScheduleUpdate
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [handleScheduleUpdate]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'status-pending';
            case 'in_progress': return 'status-in-progress';
            case 'completed': return 'status-completed';
            default: return 'status-pending';
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'urgent': return 'status-urgent';
            case 'normal': return 'status-normal';
            default: return 'status-normal';
        }
    };

    if (loading) {
        return <div className="loading">Đang tải...</div>;
    }

    if (error) {
        return <div className="error">Lỗi: {error}</div>;
    }

    return (
        <div className="order-summary-container">
            <div className="header">
                <h2>Tổng Quan Đơn Hàng</h2>

                {/* Notifications */}
                {notifications.length > 0 && (
                    <div className="notifications-container">
                        {notifications.slice(0, 3).map(notification => (
                            <div key={notification.id} className="notification">
                                <span className="notification-message">{notification.message}</span>
                                <span className="notification-time">
                                    {format(new Date(notification.timestamp), 'HH:mm')}
                                </span>
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
                            <th>Ngày đặt</th>
                            <th>Ưu tiên</th>
                            <th>Ngày thử phôi</th>
                            <th>Ngày lấy hàng</th>
                            <th>Giá trị</th>
                            <th>Làm thêm</th>
                            <th>Trạng thái</th>
                            <th>Ghi chú</th>
                        </tr>
                        </thead>
                        <tbody>
                        {orders.map(order => {
                            const schedule = order.production_schedule?.[0];
                            const orderNotifications = notifications.filter(n => n.order_id === order.id);

                            return (
                                <tr key={order.id}>
                                    <td>#{order.id.slice(0, 8)}</td>
                                    <td>
                                        <div className="customer-info">
                                            <strong>{order.customers?.name}</strong>
                                            {order.customers?.phone && (
                                                <span className="phone">{order.customers.phone}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        {order.order_items?.map((item, idx) => (
                                            <div key={idx} className="product-item">
                                                {item.products?.name || item.notes || 'Sản phẩm'} x{item.quantity}
                                            </div>
                                        ))}
                                    </td>
                                    <td>{format(new Date(order.order_date), 'dd/MM/yyyy')}</td>
                                    <td>
                                        <span className={`status-badge ${getPriorityColor(order.priority)}`}>
                                            {order.priority === 'urgent' ? 'Khẩn cấp' : 'Thường'}
                                        </span>
                                    </td>
                                    <td>
                                        {schedule?.scheduled_fitting_date &&
                                            format(new Date(schedule.scheduled_fitting_date), 'dd/MM/yyyy')}
                                        {schedule?.actual_fitting_date && (
                                            <div className="actual-date">
                                                Thực tế: {format(new Date(schedule.actual_fitting_date), 'dd/MM')}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        {schedule?.scheduled_pickup_date &&
                                            format(new Date(schedule.scheduled_pickup_date), 'dd/MM/yyyy')}
                                        {schedule?.actual_pickup_date && (
                                            <div className="actual-date">
                                                Thực tế: {format(new Date(schedule.actual_pickup_date), 'dd/MM')}
                                            </div>
                                        )}
                                    </td>
                                    <td>{order.total_price?.toLocaleString()}đ</td>
                                    <td>
                                        {schedule?.requires_overtime && (
                                            <span className="status-badge status-warning">
                                                {schedule.overtime_hours} giờ
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`status-badge ${getStatusColor(order.status)}`}>
                                            {order.status === 'pending' && 'Chờ xử lý'}
                                            {order.status === 'in_progress' && 'Đang thực hiện'}
                                            {order.status === 'completed' && 'Hoàn thành'}
                                        </span>
                                    </td>
                                    <td>
                                        {orderNotifications.length > 0 && (
                                            <div className="order-notifications">
                                                {orderNotifications.map(n => (
                                                    <div key={n.id} className="mini-notification">
                                                        {n.message}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                    {orders.length === 0 && (
                        <div className="empty-state">
                            Chưa có đơn hàng nào
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrderSummary;