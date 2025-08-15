import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const OrderSummary = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
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
            products (
              name,
              type
            )
          ),
          production_schedule (
            scheduled_fitting_date,
            scheduled_pickup_date,
            status
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

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    };

    if (loading) return <div className="loading">Đang tải...</div>;
    if (error) return <div className="error">Lỗi: {error}</div>;

    return (
        <div className="card">
            <div className="card-header">
                Bảng tổng hợp đơn hàng
            </div>
            <div className="card-body">
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
                            <th>Ngày hẹn lấy</th>
                            <th>Trạng thái</th>
                        </tr>
                        </thead>
                        <tbody>
                        {orders.map((order) => (
                            <tr key={order.id}>
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
                      {order.priority === 'urgent' ? 'Gấp' : 'Thường'}
                    </span>
                                </td>
                                <td>{formatDate(order.order_date)}</td>
                                <td>{formatDate(order.production_schedule?.[0]?.scheduled_fitting_date)}</td>
                                <td>{formatDate(order.production_schedule?.[0]?.scheduled_pickup_date)}</td>
                                <td>
                    <span className={`status-badge ${getStatusColor(order.status)}`}>
                      {order.status === 'pending' && 'Chờ xử lý'}
                        {order.status === 'in_progress' && 'Đang thực hiện'}
                        {order.status === 'completed' && 'Hoàn thành'}
                    </span>
                                </td>
                            </tr>
                        ))}
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