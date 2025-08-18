import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

const OrderSummary = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notifications, setNotifications] = useState([]);

    // Service type labels for display
    const serviceTypeLabels = {
        'may_ao_dai': 'May Áo Dài',
        'may_ao_cuoi': 'May Áo Cưới',
        'may_vest': 'May Vest',
        'may_dam': 'May Đầm',
        'sua_chua': 'Sửa Chữa',
        'khac': 'Khác'
    };

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

            // UPDATED: Removed products join, using service_type directly
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    customers (
                        name,
                        phone,
                    ),
                    order_items (
                        id,
                        service_type,
                        quantity,
                        price,
                        notes
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
                .order('created_at', { ascending: false });

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

    const getStatusLabel = (status) => {
        switch (status) {
            case 'pending': return 'Chờ xử lý';
            case 'in_progress': return 'Đang thực hiện';
            case 'completed': return 'Hoàn thành';
            case 'cancelled': return 'Đã hủy';
            default: return status;
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
            <h2>Tổng Quan Đơn Hàng</h2>

            {/* Notifications */}
            {notifications.length > 0 && (
                <div className="notifications">
                    {notifications.map(notif => (
                        <div key={notif.id} className="notification">
                            <span>{notif.message}</span>
                            <span className="timestamp">
                                {format(notif.timestamp, 'HH:mm:ss dd/MM/yyyy')}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Orders Table */}
            <div className="orders-table">
                <table>
                    <thead>
                    <tr>
                        <th>Mã Đơn</th>
                        <th>Khách Hàng</th>
                        <th>Loại Dịch Vụ</th>
                        <th>Số Lượng</th>
                        <th>Tổng Tiền</th>
                        <th>Ngày Đặt</th>
                        <th>Ngày Thử</th>
                        <th>Ngày Lấy</th>
                        <th>Trạng Thái</th>
                        <th>Ưu Tiên</th>
                        <th>Làm Thêm Giờ</th>
                    </tr>
                    </thead>
                    <tbody>
                    {orders.map(order => (
                        <tr key={order.id}>
                            <td>{order.order_number}</td>
                            <td>
                                <div className="customer-info">
                                    <strong>{order.customers?.name}</strong>
                                    <span>{order.customers?.phone}</span>
                                </div>
                            </td>
                            <td>
                                {/* UPDATED: Display service type instead of product */}
                                <div className="service-info">
                                    <strong>{serviceTypeLabels[order.service_type] || order.service_type}</strong>
                                    {order.order_items?.map((item, idx) => (
                                        <div key={idx} className="service-item">
                                            {item.service_type !== order.service_type && (
                                                <span>+ {serviceTypeLabels[item.service_type] || item.service_type}</span>
                                            )}
                                            {item.notes && <span className="notes">({item.notes})</span>}
                                        </div>
                                    ))}
                                </div>
                            </td>
                            <td>
                                {order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0}
                            </td>
                            <td className="amount">
                                {order.total_amount?.toLocaleString('vi-VN')} VNĐ
                            </td>
                            <td>
                                {order.order_date && format(new Date(order.order_date), 'dd/MM/yyyy')}
                            </td>
                            <td>
                                {order.production_schedule?.[0]?.scheduled_fitting_date && (
                                    <div>
                                        <div className="scheduled-date">
                                            {format(new Date(order.production_schedule[0].scheduled_fitting_date), 'dd/MM/yyyy')}
                                        </div>
                                        {order.production_schedule[0].actual_fitting_date && (
                                            <div className="actual-date">
                                                Thực tế: {format(new Date(order.production_schedule[0].actual_fitting_date), 'dd/MM/yyyy')}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </td>
                            <td>
                                {order.production_schedule?.[0]?.scheduled_pickup_date && (
                                    <div>
                                        <div className="scheduled-date">
                                            {format(new Date(order.production_schedule[0].scheduled_pickup_date), 'dd/MM/yyyy')}
                                        </div>
                                        {order.production_schedule[0].actual_pickup_date && (
                                            <div className="actual-date">
                                                Thực tế: {format(new Date(order.production_schedule[0].actual_pickup_date), 'dd/MM/yyyy')}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </td>
                            <td>
                                    <span className={`status-badge ${getStatusColor(order.status)}`}>
                                        {getStatusLabel(order.status)}
                                    </span>
                            </td>
                            <td>
                                    <span className={`priority-badge ${getPriorityColor(order.priority)}`}>
                                        {order.priority === 'urgent' ? 'Khẩn Cấp' : 'Bình Thường'}
                                    </span>
                            </td>
                            <td>
                                {order.production_schedule?.[0]?.requires_overtime && (
                                    <span className="overtime">
                                            {order.production_schedule[0].overtime_hours} giờ
                                        </span>
                                )}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>

                {orders.length === 0 && (
                    <div className="no-data">Không có đơn hàng nào</div>
                )}
            </div>

            {/* Summary Statistics */}
            <div className="summary-stats">
                <div className="stat-card">
                    <h4>Tổng Đơn Hàng</h4>
                    <p>{orders.length}</p>
                </div>
                <div className="stat-card">
                    <h4>Đang Xử Lý</h4>
                    <p>{orders.filter(o => o.status === 'in_progress').length}</p>
                </div>
                <div className="stat-card">
                    <h4>Đơn Khẩn Cấp</h4>
                    <p>{orders.filter(o => o.priority === 'urgent').length}</p>
                </div>
                <div className="stat-card">
                    <h4>Tổng Doanh Thu</h4>
                    <p>
                        {orders.reduce((sum, o) => sum + (o.total_amount || 0), 0).toLocaleString('vi-VN')} VNĐ
                    </p>
                </div>
            </div>
        </div>
    );
};

export default OrderSummary;