import React, { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    TextField,
    MenuItem,
    FormControlLabel,
    Checkbox,
    Grid
} from '@mui/material';
import { useOrders } from '../hooks/useOrders';
import { CreateOrderData } from '../types/database';
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

        // Prepare order data using the correct type
        const orderData: CreateOrderData = {
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
            alert('Lỗi khi tạo đơn hàng: ' + result.error);
        }
    };

    const handleInputChange = (field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                Tạo đơn hàng mới
            </Typography>

            <Paper sx={{ p: 3 }}>
                <form onSubmit={handleSubmit}>
                    <Grid container spacing={3}>
                        {/* Customer Information */}
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom>
                                Thông tin khách hàng
                            </Typography>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Tên khách hàng *"
                                value={formData.customer_name}
                                onChange={(e) => handleInputChange('customer_name', e.target.value)}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Số điện thoại *"
                                value={formData.customer_phone}
                                onChange={(e) => handleInputChange('customer_phone', e.target.value)}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                type="date"
                                label="Ngày sinh"
                                value={formData.customer_dob}
                                onChange={(e) => handleInputChange('customer_dob', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Người giới thiệu"
                                value={formData.referrer}
                                onChange={(e) => handleInputChange('referrer', e.target.value)}
                            />
                        </Grid>

                        {/* Product Information */}
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                                Thông tin sản phẩm
                            </Typography>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Tên sản phẩm *"
                                value={formData.product_name}
                                onChange={(e) => handleInputChange('product_name', e.target.value)}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth
                                type="number"
                                label="Số lượng *"
                                value={formData.product_quantity}
                                onChange={(e) => handleInputChange('product_quantity', parseInt(e.target.value) || 1)}
                                inputProps={{ min: 1 }}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth
                                type="number"
                                label="Giá (VND) *"
                                value={formData.product_price}
                                onChange={(e) => handleInputChange('product_price', parseFloat(e.target.value) || 0)}
                                inputProps={{ min: 0 }}
                                required
                            />
                        </Grid>

                        {/* Order Details */}
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                                Thông tin đơn hàng
                            </Typography>
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                type="date"
                                label="Ngày đặt hàng *"
                                value={formData.order_date}
                                onChange={(e) => handleInputChange('order_date', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                select
                                label="Độ ưu tiên *"
                                value={formData.priority}
                                onChange={(e) => handleInputChange('priority', e.target.value)}
                                required
                            >
                                <MenuItem value="regular">Thường</MenuItem>
                                <MenuItem value="urgent">Gấp</MenuItem>
                            </TextField>
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                select
                                label="Nhân viên phụ trách *"
                                value={formData.staff_in_charge}
                                onChange={(e) => handleInputChange('staff_in_charge', e.target.value)}
                                required
                            >
                                <MenuItem value="tailor">Thợ may</MenuItem>
                                <MenuItem value="decorator">Thợ thêu</MenuItem>
                                <MenuItem value="both">Cả hai</MenuItem>
                            </TextField>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={formData.material_status}
                                        onChange={(e) => handleInputChange('material_status', e.target.checked)}
                                    />
                                }
                                label="Đang chờ vải"
                            />
                        </Grid>

                        {/* Urgent Order Special Field */}
                        {formData.priority === 'urgent' && (
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    type="date"
                                    label="Ngày giao yêu cầu"
                                    value={formData.actual_delivery_date}
                                    onChange={(e) => handleInputChange('actual_delivery_date', e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    helperText="Chỉ áp dụng cho đơn hàng gấp"
                                />
                            </Grid>
                        )}

                        <Grid item xs={12}>
                            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
                                <Button
                                    type="button"
                                    variant="outlined"
                                    onClick={() => {
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
                                    }}
                                >
                                    Đặt lại
                                </Button>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    disabled={loading || !formData.customer_name || !formData.customer_phone || !formData.product_name}
                                >
                                    {loading ? 'Đang tạo...' : 'Tạo đơn hàng'}
                                </Button>
                            </Box>
                        </Grid>
                    </Grid>
                </form>
            </Paper>
        </Box>
    );
};

export default NewOrderForm;