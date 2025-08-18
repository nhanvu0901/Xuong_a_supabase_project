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
    Grid,
    Divider,
    Alert,
    ToggleButton,
    ToggleButtonGroup,
    InputAdornment
} from '@mui/material';
import {
    Build,
    Engineering,
    AccessTime,
    AttachMoney
} from '@mui/icons-material';
import { useOrders } from '../hooks/useOrders';
import { CreateOrderData } from '../types/database';
import dayjs from 'dayjs';

const NewOrderForm: React.FC = () => {
    const { createOrder, loading } = useOrders();
    const [serviceType, setServiceType] = useState<'make_new' | 'fix_update'>('make_new');
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
        actual_delivery_date: '',
        needs_decoration: false
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const orderData: CreateOrderData = {
            ...formData,
            service_type: serviceType,
            customer_dob: formData.customer_dob || null,
            referrer: formData.referrer || null,
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
                actual_delivery_date: '',
                needs_decoration: false
            });
            alert('Đã tạo đơn hàng thành công!');
        } else {
            alert('Lỗi khi tạo đơn hàng: ' + result.error);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const getEstimatedTime = () => {
        if (serviceType === 'fix_update') {
            return '2 giờ';
        }
        let totalHours = 6 + 0.5 + 2 + 2; // Base time for new dress
        if (formData.needs_decoration) totalHours += 8;
        if (formData.material_status) totalHours += 40; // 5 days wait
        return `${Math.ceil(totalHours / 8)} ngày`;
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom fontWeight="bold">
                Tạo đơn hàng mới
            </Typography>

            <Paper sx={{ p: 3 }}>
                {/* Service Type Selection */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Loại dịch vụ
                    </Typography>
                    <ToggleButtonGroup
                        value={serviceType}
                        exclusive
                        onChange={(e, value) => value && setServiceType(value)}
                        fullWidth
                    >
                        <ToggleButton value="make_new" sx={{ py: 2 }}>
                            <Engineering sx={{ mr: 1 }} />
                            <Box>
                                <Typography variant="subtitle1">Làm mới</Typography>
                                <Typography variant="caption" display="block">
                                    Thời gian: 3-5 ngày
                                </Typography>
                            </Box>
                        </ToggleButton>
                        <ToggleButton value="fix_update" sx={{ py: 2 }}>
                            <Build sx={{ mr: 1 }} />
                            <Box>
                                <Typography variant="subtitle1">Sửa / Cập nhật</Typography>
                                <Typography variant="caption" display="block">
                                    Thời gian: 2 giờ
                                </Typography>
                            </Box>
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Box>

                <Divider sx={{ my: 3 }} />

                {/* Estimated Time Alert */}
                <Alert severity="info" sx={{ mb: 3 }} icon={<AccessTime />}>
                    Thời gian ước tính: <strong>{getEstimatedTime()}</strong>
                    {serviceType === 'fix_update' && ' (Có thể hoàn thành trong ngày)'}
                </Alert>

                <form onSubmit={handleSubmit}>
                    <Grid container spacing={3}>
                        {/* Customer Information */}
                        <Grid item xs={12}>
                            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                                Thông tin khách hàng
                            </Typography>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Tên khách hàng"
                                name="customer_name"
                                value={formData.customer_name}
                                onChange={handleChange}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Số điện thoại"
                                name="customer_phone"
                                value={formData.customer_phone}
                                onChange={handleChange}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Ngày sinh"
                                name="customer_dob"
                                type="date"
                                value={formData.customer_dob}
                                onChange={handleChange}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Người giới thiệu"
                                name="referrer"
                                value={formData.referrer}
                                onChange={handleChange}
                            />
                        </Grid>

                        {/* Product Information */}
                        <Grid item xs={12}>
                            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                                Thông tin sản phẩm
                            </Typography>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Tên sản phẩm"
                                name="product_name"
                                value={formData.product_name}
                                onChange={handleChange}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth
                                label="Số lượng"
                                name="product_quantity"
                                type="number"
                                value={formData.product_quantity}
                                onChange={handleChange}
                                InputProps={{ inputProps: { min: 1 } }}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth
                                label="Giá"
                                name="product_price"
                                type="number"
                                value={formData.product_price}
                                onChange={handleChange}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start">₫</InputAdornment>
                                }}
                                required
                            />
                        </Grid>

                        {/* Order Settings */}
                        <Grid item xs={12}>
                            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                                Cài đặt đơn hàng
                            </Typography>
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                select
                                label="Độ ưu tiên"
                                name="priority"
                                value={formData.priority}
                                onChange={handleChange}
                            >
                                <MenuItem value="regular">Thường</MenuItem>
                                <MenuItem value="urgent">Gấp (Làm thêm giờ)</MenuItem>
                            </TextField>
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                select
                                label="Phân công"
                                name="staff_in_charge"
                                value={formData.staff_in_charge}
                                onChange={handleChange}
                            >
                                <MenuItem value="tailor">Thợ may</MenuItem>
                                <MenuItem value="decorator">Thợ trang trí</MenuItem>
                                <MenuItem value="both">Cả hai</MenuItem>
                            </TextField>
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                label="Ngày đặt hàng"
                                name="order_date"
                                type="date"
                                value={formData.order_date}
                                onChange={handleChange}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>

                        {serviceType === 'make_new' && (
                            <>
                                <Grid item xs={12} md={6}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                name="material_status"
                                                checked={formData.material_status}
                                                onChange={handleChange}
                                            />
                                        }
                                        label="Đang chờ vải (thêm 5 ngày)"
                                    />
                                </Grid>

                                <Grid item xs={12} md={6}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                name="needs_decoration"
                                                checked={formData.needs_decoration}
                                                onChange={handleChange}
                                            />
                                        }
                                        label="Cần trang trí (thêm 1 ngày)"
                                    />
                                </Grid>
                            </>
                        )}

                        {formData.priority === 'urgent' && (
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Ngày giao yêu cầu"
                                    name="actual_delivery_date"
                                    type="date"
                                    value={formData.actual_delivery_date}
                                    onChange={handleChange}
                                    InputLabelProps={{ shrink: true }}
                                    helperText="Chỉ áp dụng cho đơn hàng gấp"
                                    required
                                />
                            </Grid>
                        )}

                        {/* Action Buttons */}
                        <Grid item xs={12}>
                            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
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
                                            actual_delivery_date: '',
                                            needs_decoration: false
                                        });
                                    }}
                                >
                                    Đặt lại
                                </Button>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    disabled={loading || !formData.customer_name || !formData.customer_phone || !formData.product_name}
                                    size="large"
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