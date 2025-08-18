import React, { useState, useMemo } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
    Card,
    CardContent,
    Chip,
    Button,
    ToggleButton,
    ToggleButtonGroup,
    LinearProgress,
    Tooltip,
    IconButton
} from '@mui/material';
import {
    AccessTime,
    CalendarToday,
    CheckCircle,
    Warning,
    NavigateBefore,
    NavigateNext,
    Person,
    Build
} from '@mui/icons-material';
import { useOrders } from '../hooks/useOrders';
import { formatDate } from '../utils/dateUtils';
import dayjs from 'dayjs';
import DailyTimetable from './DailyTimetable';
import {Order} from "../types/database";

const Dashboard: React.FC = () => {
    const { orders, loading } = useOrders();
    const [viewMode, setViewMode] = useState<'overview' | 'timetable'>('timetable');
    const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));

    const stats = useMemo(() => {
        if (!orders) return { total: 0, urgent: 0, waiting: 0, inProgress: 0, completed: 0 };

        return {
            total: orders.length,
            urgent: orders.filter(o => o.priority === 'urgent').length,
            waiting: orders.filter(o => o.material_status).length,
            inProgress: orders.filter(o => o.current_stage && !o.current_stage.completed).length,
            completed: orders.filter(o => o.current_stage?.name === 'decoration' && o.current_stage.completed).length,
            makeNew: orders.filter(o => o.service_type === 'make_new').length,
            fixUpdate: orders.filter(o => o.service_type === 'fix_update').length
        };
    }, [orders]);

    const handleDateChange = (direction: 'prev' | 'next') => {
        const newDate = direction === 'prev'
            ? dayjs(selectedDate).subtract(1, 'day')
            : dayjs(selectedDate).add(1, 'day');
        setSelectedDate(newDate.format('YYYY-MM-DD'));
    };

    if (loading) {
        return (
            <Box sx={{ p: 3 }}>
                <LinearProgress />
                <Typography sx={{ mt: 2 }}>Đang tải dữ liệu...</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" fontWeight="bold">
                    Quản lý Đơn hàng Áo Dài
                </Typography>
                <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={(e, value) => value && setViewMode(value)}
                    size="small"
                >
                    <ToggleButton value="overview">
                        <CalendarToday sx={{ mr: 1 }} />
                        Tổng quan
                    </ToggleButton>
                    <ToggleButton value="timetable">
                        <AccessTime sx={{ mr: 1 }} />
                        Lịch làm việc
                    </ToggleButton>
                </ToggleButtonGroup>
            </Box>

            {/* Statistics Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: '#e3f2fd' }}>
                        <CardContent>
                            <Typography color="text.secondary" gutterBottom>
                                Tổng đơn hàng
                            </Typography>
                            <Typography variant="h3" color="primary">
                                {stats.total}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                <Chip label={`Mới: ${stats.makeNew}`} size="small" color="info" />
                                <Chip label={`Sửa: ${stats.fixUpdate}`} size="small" />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: '#fff3e0' }}>
                        <CardContent>
                            <Typography color="text.secondary" gutterBottom>
                                Đang xử lý
                            </Typography>
                            <Typography variant="h3" color="warning.main">
                                {stats.inProgress}
                            </Typography>
                            <Chip
                                icon={<Warning />}
                                label={`Chờ vải: ${stats.waiting}`}
                                size="small"
                                color="warning"
                                sx={{ mt: 1 }}
                            />
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: '#ffebee' }}>
                        <CardContent>
                            <Typography color="text.secondary" gutterBottom>
                                Đơn gấp
                            </Typography>
                            <Typography variant="h3" color="error">
                                {stats.urgent}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Cần làm thêm giờ
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: '#e8f5e9' }}>
                        <CardContent>
                            <Typography color="text.secondary" gutterBottom>
                                Hoàn thành
                            </Typography>
                            <Typography variant="h3" color="success.main">
                                {stats.completed}
                            </Typography>
                            <CheckCircle color="success" sx={{ mt: 1 }} />
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Main Content Area */}
            {viewMode === 'timetable' ? (
                <Paper sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                        <Typography variant="h5" fontWeight="bold">
                            Lịch làm việc theo giờ
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <IconButton onClick={() => handleDateChange('prev')}>
                                <NavigateBefore />
                            </IconButton>
                            <Typography variant="h6">
                                {formatDate(selectedDate, 'DD/MM/YYYY')} - {dayjs(selectedDate).format('dddd')}
                            </Typography>
                            <IconButton onClick={() => handleDateChange('next')}>
                                <NavigateNext />
                            </IconButton>
                        </Box>
                    </Box>
                    <DailyTimetable date={selectedDate} orders={orders} />
                </Paper>
            ) : (
                <OrdersOverview orders={orders} />
            )}
        </Box>
    );
};

// Orders Overview Component
const OrdersOverview: React.FC<{ orders: Order[] }> = ({ orders }) => {
    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
                Danh sách đơn hàng
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                    <tr style={{ backgroundColor: '#f5f5f5' }}>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Khách hàng</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Loại dịch vụ</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Sản phẩm</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Giai đoạn</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Ưu tiên</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Trạng thái</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Ngày giao</th>
                    </tr>
                    </thead>
                    <tbody>
                    {orders.map((order) => (
                        <tr key={order.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                            <td style={{ padding: '12px' }}>
                                <Typography variant="body2" fontWeight="bold">
                                    {order.customer_name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {order.customer_phone}
                                </Typography>
                            </td>
                            <td style={{ padding: '12px' }}>
                                <Chip
                                    label={order.service_type === 'make_new' ? 'Làm mới' : 'Sửa/Cập nhật'}
                                    size="small"
                                    color={order.service_type === 'make_new' ? 'primary' : 'secondary'}
                                />
                            </td>
                            <td style={{ padding: '12px' }}>
                                {order.product_name} (x{order.product_quantity})
                            </td>
                            <td style={{ padding: '12px' }}>
                                {order.current_stage && (
                                    <Chip
                                        label={getStageLabel(order.current_stage.name)}
                                        size="small"
                                        variant="outlined"
                                    />
                                )}
                            </td>
                            <td style={{ padding: '12px' }}>
                                <Chip
                                    label={order.priority === 'urgent' ? 'Gấp' : 'Thường'}
                                    size="small"
                                    color={order.priority === 'urgent' ? 'error' : 'default'}
                                />
                            </td>
                            <td style={{ padding: '12px' }}>
                                <Chip
                                    label={order.material_status ? 'Chờ vải' : 'Đủ vải'}
                                    size="small"
                                    color={order.material_status ? 'warning' : 'success'}
                                    variant="outlined"
                                />
                            </td>
                            <td style={{ padding: '12px' }}>
                                {formatDate(order.delivery_appointment_date)}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </Box>
        </Paper>
    );
};

const getStageLabel = (stage: string): string => {
    const labels: Record<string, string> = {
        'first_sewing': 'May lần 1 (50%)',
        'first_fitting': 'Thử lần 1',
        'alteration': 'Sửa chữa',
        'final_sewing': 'May hoàn thiện',
        'decoration': 'Trang trí',
        'fix_update': 'Sửa/Cập nhật'
    };
    return labels[stage] || stage;
};

export default Dashboard;