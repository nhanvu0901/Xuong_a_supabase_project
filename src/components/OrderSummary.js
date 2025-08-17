import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const OrderSummary = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notifications, setNotifications] = useState([]);

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
    }, []);

    const handleScheduleUpdate = (payload) => {
        if (payload.new.adjustment_reason) {
            // Add notification when schedule is adjusted
            setNotifications(prev => [...prev, {
                id: Date.now(),
                order_id: payload.new.order_id,
                message: payload.new.adjustment_reason,
                timestamp: new Date(),
                type: 'schedule_update'
            }]);

            // Refresh orders to show updated dates
            fetchOrders();
        }
    };

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
                        adjustment_reason,
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

    const formatDate = (date) => {
        if (!date) return '-';
        return format(new Date(date), 'dd/MM/yyyy', { locale: vi });
    };

    const formatDateTime = (date) => {
        if (!date) return '-';
        return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: vi });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    };

    const getOrderNotifications = (orderId) => {
        return notifications.filter(n => n.order_id === orderId);
    };

    const removeNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    if (loading) return <div className="loading">Đang tải...</div>;
    if (error) return <div className="error">Lỗi: {error}</div>;

    return (
        <div className="card">
            <div className="card-header">
                Bảng tổng hợp đơn hàng
            </div>
            <div className="card-body">
                {/* Global notifications */}
                {notifications.length > 0 && (
                    <div className="notifications-panel">
                        <h4>Thông báo cập nhật lịch</h4>
                        {notifications.map(notification => (
                            <div key={notification.id} className="notification-item">
                                <span className="notification-time">
                                    {formatDateTime(notification.timestamp)}
                                </span>
                                <span className="notification-message">
                                    {notification.message}
                                </span>
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
                            <th>Mã đơn</th>
                            <th>Khách hàng</th>
                            <th>Ngày sinh</th>
                            <th>Số điện thoại</th>
                            <th>Cơ quan/Người giới thiệu</th>
                            <th>Sản phẩm</th>
                            <th>Số lượng</th>
                            <th>Giá tiền</th>
                            <th>Tình trạng vải</th>
                            <th>Mức độ ưu tiên</th>
                            <th>Ngày nhận</th>
                            <th>Ngày hẹn thử</th>
                            <th>Ngày thử thực tế</th>
                            <th>Ngày hẹn lấy/Ngày lấy thực tế</th>
                            <th>Làm thêm giờ</th>
                            <th>Trạng thái</th>
                            <th>Cập nhật</th>
                        </tr>
                        </thead>
                        <tbody>
                        {orders.map((order) => {
                            const schedule = order.production_schedule?.[0];
                            const orderNotifications = getOrderNotifications(order.id);
                            const isUrgent = order.priority === 'urgent';

                            return (
                                <tr key={order.id} className={orderNotifications.length > 0 ? 'has-notification' : ''}>
                                    <td>{order.id.slice(0, 8)}...</td>
                                    <td>{order.customers?.name}</td>
                                    <td>{formatDate(order.customers?.birth_date)}</td>
                                    <td>{order.customers?.phone}</td>
                                    <td>
                                        {order.customers?.organization && (
                                            <div>{order.customers.organization}</div>
                                        )}
                                        {order.customers?.referrer && (
                                            <div><small>GT: {order.customers.referrer}</small></div>
                                        )}
                                    </td>
                                    <td>
                                        {order.order_items?.map((item, idx) => (
                                            <div key={idx}>{item.products?.name}</div>
                                        ))}
                                    </td>
                                    <td>
                                        {order.order_items?.map((item, idx) => (
                                            <div key={idx}>{item.quantity}</div>
                                        ))}
                                    </td>
                                    <td>{formatCurrency(order.total_price || 0)}</td>
                                    <td>
                                            <span className={`status-badge ${order.material_status === 'need_order' ? 'status-urgent' : 'status-normal'}`}>
                                                {order.material_status === 'need_order' ? 'Cần đặt vải' : 'Có sẵn'}
                                            </span>
                                    </td>
                                    <td>
                                            <span className={`status-badge ${getPriorityColor(order.priority)}`}>
                                                {isUrgent ? 'GẤP' : 'THƯỜNG'}
                                            </span>
                                    </td>
                                    <td>{formatDate(order.order_date)}</td>
                                    <td>{formatDate(schedule?.scheduled_fitting_date)}</td>
                                    <td>
                                        {schedule?.actual_fitting_date && (
                                            <span className={
                                                new Date(schedule.actual_fitting_date).getTime() !==
                                                new Date(schedule.scheduled_fitting_date).getTime()
                                                    ? 'date-changed' : ''
                                            }>
                                                    {formatDate(schedule.actual_fitting_date)}
                                                </span>
                                        )}
                                    </td>
                                    <td>
                                        {isUrgent ? (
                                            // For URGENT orders, show actual delivery date
                                            <div>
                                                <strong>Ngày lấy thực tế:</strong>
                                                <br />
                                                <span className="urgent-delivery">
                                                        {formatDate(order.actual_delivery_date)}
                                                    </span>
                                            </div>
                                        ) : (
                                            // For REGULAR orders, show scheduled pickup date
                                            <div>
                                                <div>Hẹn: {formatDate(schedule?.scheduled_pickup_date)}</div>
                                                {schedule?.actual_pickup_date && (
                                                    <div>Thực tế: {formatDate(schedule.actual_pickup_date)}</div>
                                                )}
                                            </div>
                                        )}
                                    </td>
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
                                        {schedule?.adjustment_reason && (
                                            <div className="adjustment-notification">
                                                <span className="notification-icon">📝</span>
                                                <span className="adjustment-text" title={schedule.adjustment_reason}>
                                                        {schedule.adjustment_reason}
                                                    </span>
                                            </div>
                                        )}
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