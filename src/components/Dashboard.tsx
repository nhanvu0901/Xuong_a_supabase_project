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
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    useTheme,
    useMediaQuery
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
    const [viewMode, setViewMode] = useState<'overview' | 'timetable'>('overview');
    const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.down('md'));

    // Sort orders by delivery date (newest first)
    const sortedOrders = useMemo(() => {
        if (!orders) return [];
        return [...orders].sort((a, b) => {
            const dateA = dayjs(a.delivery_appointment_date || a.order_date);
            const dateB = dayjs(b.delivery_appointment_date || b.order_date);
            return dateA.valueOf()-dateB.valueOf(); // Newest first
        });
    }, [orders]);

    const stats = useMemo(() => {
        if (!orders) return { total: 0, urgent: 0, waiting: 0, inProgress: 0, completed: 0, makeNew: 0, fixUpdate: 0 };

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
        <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
            <Box sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'stretch', sm: 'center' },
                mb: 3,
                gap: 2
            }}>
                <Typography variant={isMobile ? "h5" : "h4"} fontWeight="bold">
                    Quản lý Đơn hàng Áo Dài
                </Typography>
                <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={(e, value) => value && setViewMode(value)}
                    size={isMobile ? "small" : "medium"}
                    fullWidth={isMobile}
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
                <Grid item xs={6} sm={6} md={3}>
                    <Card sx={{ bgcolor: '#e3f2fd', height: '100%' }}>
                        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                            <Typography color="text.secondary" gutterBottom variant={isMobile ? "caption" : "body2"}>
                                Tổng đơn hàng
                            </Typography>
                            <Typography variant={isMobile ? "h4" : "h3"} color="primary">
                                {stats.total}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                                <Chip label={`Mới: ${stats.makeNew}`} size="small" color="info" />
                                <Chip label={`Sửa: ${stats.fixUpdate}`} size="small" />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} sm={6} md={3}>
                    <Card sx={{ bgcolor: '#fff3e0', height: '100%' }}>
                        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                            <Typography color="text.secondary" gutterBottom variant={isMobile ? "caption" : "body2"}>
                                Đang xử lý
                            </Typography>
                            <Typography variant={isMobile ? "h4" : "h3"} color="warning.main">
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
                <Grid item xs={6} sm={6} md={3}>
                    <Card sx={{ bgcolor: '#ffebee', height: '100%' }}>
                        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                            <Typography color="text.secondary" gutterBottom variant={isMobile ? "caption" : "body2"}>
                                Đơn gấp
                            </Typography>
                            <Typography variant={isMobile ? "h4" : "h3"} color="error">
                                {stats.urgent}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Cần làm thêm giờ
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={6} sm={6} md={3}>
                    <Card sx={{ bgcolor: '#e8f5e9', height: '100%' }}>
                        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                            <Typography color="text.secondary" gutterBottom variant={isMobile ? "caption" : "body2"}>
                                Hoàn thành
                            </Typography>
                            <Typography variant={isMobile ? "h4" : "h3"} color="success.main">
                                {stats.completed}
                            </Typography>
                            <CheckCircle color="success" sx={{ mt: 1 }} />
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Main Content */}
            {viewMode === 'timetable' ? (
                <Paper sx={{ p: { xs: 1, sm: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <IconButton onClick={() => handleDateChange('prev')}>
                            <NavigateBefore />
                        </IconButton>
                        <Typography variant="h6">
                            {dayjs(selectedDate).format('dddd, DD/MM/YYYY')}
                        </Typography>
                        <IconButton onClick={() => handleDateChange('next')}>
                            <NavigateNext />
                        </IconButton>
                    </Box>
                    <DailyTimetable date={selectedDate} orders={sortedOrders} />
                </Paper>
            ) : (
                <OrdersOverview orders={sortedOrders} isMobile={isMobile} isTablet={isTablet} />
            )}
        </Box>
    );
};

// Improved Orders Overview Component with responsive design
const OrdersOverview: React.FC<{ orders: Order[], isMobile: boolean, isTablet: boolean }> = ({ orders, isMobile, isTablet }) => {

    if (isMobile) {
        // Mobile card view
        return (
            <Box>
                <Typography variant="h6" gutterBottom sx={{ px: 1 }}>
                    Danh sách đơn hàng
                </Typography>
                {orders.map((order) => (
                    <Card key={order.id} sx={{ mb: 2 }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="subtitle1" fontWeight="bold">
                                    {order.customer_name}
                                </Typography>
                                <Chip
                                    label={order.priority === 'urgent' ? 'Gấp' : 'Thường'}
                                    size="small"
                                    color={order.priority === 'urgent' ? 'error' : 'default'}
                                />
                            </Box>

                            <Typography variant="caption" color="text.secondary" display="block">
                                {order.customer_phone}
                            </Typography>

                            <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                <Chip
                                    label={order.service_type === 'make_new' ? 'Làm mới' : 'Sửa/Cập nhật'}
                                    size="small"
                                    color={order.service_type === 'make_new' ? 'primary' : 'secondary'}
                                />
                                <Chip
                                    label={order.material_status ? 'Chờ vải' : 'Đủ vải'}
                                    size="small"
                                    color={order.material_status ? 'warning' : 'success'}
                                    variant="outlined"
                                />
                                {order.current_stage && (
                                    <Chip
                                        label={getStageLabel(order.current_stage.name)}
                                        size="small"
                                        variant="outlined"
                                    />
                                )}
                            </Box>

                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                                <Typography variant="body2">
                                    <strong>Sản phẩm:</strong> {order.product_name} (x{order.product_quantity})
                                </Typography>
                                <Typography variant="body2">
                                    <strong>Ngày giao:</strong> {order.delivery_appointment_date ? formatDate(order.delivery_appointment_date) : 'N/A'}
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                ))}
            </Box>
        );
    }

    // Desktop/Tablet table view with improved responsive design
    return (
        <TableContainer component={Paper}>
            <Typography variant="h6" sx={{ p: 2, pb: 0 }}>
                Danh sách đơn hàng
            </Typography>
            <Table sx={{ minWidth: isTablet ? 650 : 950 }}>
                <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                        <TableCell>Khách hàng</TableCell>
                        <TableCell>Loại dịch vụ</TableCell>
                        <TableCell>Sản phẩm</TableCell>
                        {!isTablet && <TableCell>Giai đoạn</TableCell>}
                        <TableCell>Ưu tiên</TableCell>
                        <TableCell>Trạng thái</TableCell>
                        <TableCell align="right">Ngày giao</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {orders.map((order) => (
                        <TableRow key={order.id} hover>
                            <TableCell>
                                <Typography variant="body2" fontWeight="bold">
                                    {order.customer_name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {order.customer_phone}
                                </Typography>
                            </TableCell>
                            <TableCell>
                                <Chip
                                    label={order.service_type === 'make_new' ? 'Làm mới' : 'Sửa/Cập nhật'}
                                    size="small"
                                    color={order.service_type === 'make_new' ? 'primary' : 'secondary'}
                                />
                            </TableCell>
                            <TableCell>
                                <Typography variant="body2">
                                    {order.product_name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    SL: {order.product_quantity}
                                </Typography>
                            </TableCell>
                            {!isTablet && (
                                <TableCell>
                                    {order.current_stage && (
                                        <Chip
                                            label={getStageLabel(order.current_stage.name)}
                                            size="small"
                                            variant="outlined"
                                        />
                                    )}
                                </TableCell>
                            )}
                            <TableCell>
                                <Chip
                                    label={order.priority === 'urgent' ? 'Gấp' : 'Thường'}
                                    size="small"
                                    color={order.priority === 'urgent' ? 'error' : 'default'}
                                />
                            </TableCell>
                            <TableCell>
                                <Chip
                                    label={order.material_status ? 'Chờ vải' : 'Đủ vải'}
                                    size="small"
                                    color={order.material_status ? 'warning' : 'success'}
                                    variant="outlined"
                                />
                            </TableCell>
                            <TableCell align="right">
                                <Typography variant="body2">
                                    {order.delivery_appointment_date ? formatDate(order.delivery_appointment_date) : 'N/A'}
                                </Typography>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
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