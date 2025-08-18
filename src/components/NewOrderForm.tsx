import React, { useState } from 'react';
import { Box, Typography, Paper, Button } from '@mui/material';
import { useOrders } from '../hooks/useOrders';
import { Order } from '../types/database';
import dayjs from 'dayjs';

const NewOrderForm: React.FC = () => {
    const { createOrder, loading } = useOrders();
    const [formData, setFormData] = useState({
        customer_name: '',
        customer_dob: '',
        customer_phone: '',
        referrer: '',
        product_quantity: 1,
        product_name: '',
        product_price: 0,
        material_status: false,
        priority: 'regular' as 'regular' | 'urgent',
        order_date: dayjs().format('YYYY-MM-DD'),
        staff_in_charge: 'both' as 'tailor' | 'decorator' | 'both',
        actual_delivery_date: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const orderData: Omit<Order, 'id' | 'created_at' | 'updated_at' | 'sample_testing_appointment_date' | 'delivery_appointment_date' | 'updates_log'> = {
            customer_name: formData.customer_name,
            customer_dob: formData.customer_dob || null,
            customer_phone: formData.customer_phone,
            referrer: formData.referrer || null,
            product_quantity: formData.product_quantity,
            product_name: formData.product_name,
            product_price: formData.product_price,
            material_status: formData.material_status,
            priority: formData.priority,
            order_date: formData.order_date,
            staff_in_charge: formData.staff_in_charge,
            actual_sample_testing_date: null,
            actual_delivery_date: formData.priority === 'urgent' ? formData.actual_delivery_date : null
        };

        const result = await createOrder(orderData);

        if (result.success) {
            // Reset form
            setFormData({
                customer_name: '',
                customer_dob: '',
                customer_phone: '',
                referrer: '',
                product_quantity: 1,
                product_name: '',
                product_price: 0,
                material_status: false,
                priority: 'regular',
                order_date: dayjs().format('YYYY-MM-DD'),
                staff_in_charge: 'both',
                actual_delivery_date: ''
            });
            alert('Đã tạo đơn hàng thành công!');
        } else {
            alert('Lỗi: ' + result.error);
        }
    };

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
                Đơn hàng mới
            </Typography>

            <Paper sx={{ p: 3 }}>
                <form onSubmit={handleSubmit}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                        <Box>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                Tên khách hàng *
                            </Typography>
                            <input
                                type="text"
                                value={formData.customer_name}
                                onChange={(e) => handleChange('customer_name', e.target.value)}
                                required
                                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                            />
                        </Box>

                        <Box>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                Ngày sinh
                            </Typography>
                            <input
                                type="date"
                                value={formData.customer_dob}
                                onChange={(e) => handleChange('customer_dob', e.target.value)}
                                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                            />
                        </Box>

                        <Box>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                Số điện thoại *
                            </Typography>
                            <input
                                type="tel"
                                value={formData.customer_phone}
                                onChange={(e) => handleChange('customer_phone', e.target.value)}
                                required
                                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                            />
                        </Box>

                        <Box>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                Người giới thiệu
                            </Typography>
                            <input
                                type="text"
                                value={formData.referrer}
                                onChange={(e) => handleChange('referrer', e.target.value)}
                                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                            />
                        </Box>

                        <Box>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                Tên sản phẩm *
                            </Typography>
                            <input
                                type="text"
                                value={formData.product_name}
                                onChange={(e) => handleChange('product_name', e.target.value)}
                                required
                                placeholder="Áo dài truyền thống, Áo dài cách tân, ..."
                                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                            />
                        </Box>

                        <Box>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                Số lượng *
                            </Typography>
                            <input
                                type="number"
                                min="1"
                                value={formData.product_quantity}
                                onChange={(e) => handleChange('product_quantity', parseInt(e.target.value))}
                                required
                                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                            />
                        </Box>

                        <Box>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                Giá tiền *
                            </Typography>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.product_price}
                                onChange={(e) => handleChange('product_price', parseFloat(e.target.value))}
                                required
                                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                            />
                        </Box>

                        <Box>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                Ưu tiên
                            </Typography>
                            <select
                                value={formData.priority}
                                onChange={(e) => handleChange('priority', e.target.value)}
                                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                            >
                                <option value="regular">Thường</option>
                                <option value="urgent">Gấp</option>
                            </select>
                        </Box>

                        <Box>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                Phân công
                            </Typography>
                            <select
                                value={formData.staff_in_charge}
                                onChange={(e) => handleChange('staff_in_charge', e.target.value)}
                                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                            >
                                <option value="tailor">Thợ may</option>
                                <option value="decorator">Thợ thêu</option>
                                <option value="both">Cả hai</option>
                            </select>
                        </Box>

                        <Box>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                Ngày đặt hàng
                            </Typography>
                            <input
                                type="date"
                                value={formData.order_date}
                                onChange={(e) => handleChange('order_date', e.target.value)}
                                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                            />
                        </Box>

                        {formData.priority === 'urgent' && (
                            <Box>
                                <Typography variant="body2" sx={{ mb: 1 }}>
                                    Ngày giao hàng mong muốn *
                                </Typography>
                                <input
                                    type="date"
                                    value={formData.actual_delivery_date}
                                    onChange={(e) => handleChange('actual_delivery_date', e.target.value)}
                                    required
                                    style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                                />
                            </Box>
                        )}

                        <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.material_status}
                                    onChange={(e) => handleChange('material_status', e.target.checked)}
                                />
                                <Typography variant="body2">
                                    Đang chờ vải (sẽ trì hoãn 5 ngày)
                                </Typography>
                            </label>
                        </Box>
                    </Box>

                    <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={loading}
                            size="large"
                        >
                            {loading ? 'Đang tạo...' : 'Tạo đơn hàng'}
                        </Button>
                    </Box>
                </form>
            </Paper>
        </Box>
    );
};

export default NewOrderForm;