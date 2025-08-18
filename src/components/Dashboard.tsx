import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { useOrders } from '../hooks/useOrders';
import { formatDate } from '../utils/dateUtils';

const Dashboard: React.FC = () => {
    const { orders, loading } = useOrders();

    if (loading) {
        return <Box sx={{ p: 3 }}>Đang tải...</Box>;
    }

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
                Tổng quan đơn hàng
            </Typography>

            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    Thống kê
                </Typography>
                <Box sx={{ display: 'flex', gap: 4 }}>
                    <Box>
                        <Typography variant="body2" color="text.secondary">
                            Tổng đơn hàng
                        </Typography>
                        <Typography variant="h4">
                            {orders.length}
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="body2" color="text.secondary">
                            Đơn gấp
                        </Typography>
                        <Typography variant="h4" color="error">
                            {orders.filter(order => order.priority === 'urgent').length}
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="body2" color="text.secondary">
                            Chờ vải
                        </Typography>
                        <Typography variant="h4" color="warning.main">
                            {orders.filter(order => order.material_status).length}
                        </Typography>
                    </Box>
                </Box>
            </Paper>

            <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                    Danh sách đơn hàng
                </Typography>

                <Box sx={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                        <tr style={{ backgroundColor: '#f5f5f5' }}>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                                Khách hàng
                            </th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                                Sản phẩm
                            </th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                                Ưu tiên
                            </th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                                Ngày đặt
                            </th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                                Ngày thử
                            </th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                                Trạng thái vải
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        {orders.map((order) => (
                            <tr key={order.id}>
                                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                                    {order.customer_name}
                                </td>
                                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                                    {order.product_name} (x{order.product_quantity})
                                </td>
                                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                    <span
                        style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: order.priority === 'urgent' ? '#ffebee' : '#e8f5e8',
                            color: order.priority === 'urgent' ? '#c62828' : '#2e7d32',
                            fontSize: '12px'
                        }}
                    >
                      {order.priority === 'urgent' ? 'Gấp' : 'Thường'}
                    </span>
                                </td>
                                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                                    {formatDate(order.order_date)}
                                </td>
                                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                                    {formatDate(order.sample_testing_appointment_date)}
                                </td>
                                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                    <span
                        style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: order.material_status ? '#fff3e0' : '#e8f5e8',
                            color: order.material_status ? '#e65100' : '#2e7d32',
                            fontSize: '12px'
                        }}
                    >
                      {order.material_status ? 'Chờ vải' : 'Đủ vải'}
                    </span>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </Box>
            </Paper>
        </Box>
    );
};

export default Dashboard;