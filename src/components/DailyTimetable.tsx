import React, { useMemo } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
    Chip,
    LinearProgress,
    Tooltip,
    Card,
    CardContent,
    Divider,
    Alert
} from '@mui/material';
import {
    Person,
    Build,
    AccessTime,
    Warning,
    CheckCircle
} from '@mui/icons-material';
import dayjs from 'dayjs';
import {Order, TimeSlot} from "../types/database";

interface DailyTimetableProps {
    date: string;
    orders: Order[];
}

const DailyTimetable: React.FC<DailyTimetableProps> = ({ date, orders }) => {
    const workingHours = useMemo(() => {
        const hours = [];
        // Morning: 8:30 - 12:00
        for (let h = 8.5; h <= 11.5; h += 0.5) {
            hours.push(h);
        }
        // Afternoon: 13:30 - 17:30
        for (let h = 13.5; h <= 17; h += 0.5) {
            hours.push(h);
        }
        return hours;
    }, []);

    const schedule = useMemo(() => {
        const dayOrders = orders.filter(order => {
            const scheduledDate = order.scheduled_date || order.order_date;
            return dayjs(scheduledDate).format('YYYY-MM-DD') === date;
        });

        const tailorTasks: TimeSlot[] = [];
        const decoratorTasks: TimeSlot[] = [];
        let tailorHours = 0;
        let decoratorHours = 0;

        dayOrders.forEach(order => {
            if (order.service_type === 'fix_update') {
                // Fix/Update takes 2 hours
                const slot: TimeSlot = {
                    date,
                    start_time: getNextAvailableTime(tailorHours),
                    end_time: getEndTime(tailorHours, 2),
                    duration_hours: 2,
                    order_id: order.id,
                    task: `Sửa: ${order.customer_name} - ${order.product_name}`,
                    staff: 'tailor'
                };
                tailorTasks.push(slot);
                tailorHours += 2;
            } else {
                // Make new - process stages
                const stage = order.current_stage || { name: 'first_sewing', duration_hours: 6, completed: false };

                switch (stage.name) {
                    case 'first_sewing':
                        const sewingSlot: TimeSlot = {
                            date,
                            start_time: getNextAvailableTime(tailorHours),
                            end_time: getEndTime(tailorHours, 6),
                            duration_hours: 6,
                            order_id: order.id,
                            task: `May lần 1: ${order.customer_name} - ${order.product_name}`,
                            staff: 'tailor'
                        };
                        tailorTasks.push(sewingSlot);
                        tailorHours += 6;
                        break;

                    case 'first_fitting':
                        const fittingSlot: TimeSlot = {
                            date,
                            start_time: getNextAvailableTime(tailorHours),
                            end_time: getEndTime(tailorHours, 0.5),
                            duration_hours: 0.5,
                            order_id: order.id,
                            task: `Thử: ${order.customer_name}`,
                            staff: 'tailor'
                        };
                        tailorTasks.push(fittingSlot);
                        tailorHours += 0.5;
                        break;

                    case 'alteration':
                        const alterSlot: TimeSlot = {
                            date,
                            start_time: getNextAvailableTime(tailorHours),
                            end_time: getEndTime(tailorHours, 2),
                            duration_hours: 2,
                            order_id: order.id,
                            task: `Sửa: ${order.customer_name}`,
                            staff: 'tailor'
                        };
                        tailorTasks.push(alterSlot);
                        tailorHours += 2;
                        break;

                    case 'final_sewing':
                        const finalSlot: TimeSlot = {
                            date,
                            start_time: getNextAvailableTime(tailorHours),
                            end_time: getEndTime(tailorHours, 2),
                            duration_hours: 2,
                            order_id: order.id,
                            task: `May hoàn thiện: ${order.customer_name}`,
                            staff: 'tailor'
                        };
                        tailorTasks.push(finalSlot);
                        tailorHours += 2;
                        break;

                    case 'decoration':
                        const decorSlot: TimeSlot = {
                            date,
                            start_time: getNextAvailableTime(decoratorHours),
                            end_time: getEndTime(decoratorHours, 8),
                            duration_hours: 8,
                            order_id: order.id,
                            task: `Trang trí: ${order.customer_name} - ${order.product_name}`,
                            staff: 'decorator'
                        };
                        decoratorTasks.push(decorSlot);
                        decoratorHours += 8;
                        break;
                }
            }
        });

        return { tailorTasks, decoratorTasks, tailorHours, decoratorHours };
    }, [date, orders]);

    const getNextAvailableTime = (currentHours: number): string => {
        const baseTime = 8.5; // 8:30 AM
        let time = baseTime + currentHours;

        // Skip lunch break (12:00 - 13:30)
        if (time >= 12 && time < 13.5) {
            time = 13.5;
        }

        const hours = Math.floor(time);
        const minutes = (time - hours) * 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };

    const getEndTime = (startHours: number, duration: number): string => {
        return getNextAvailableTime(startHours + duration);
    };

    const formatTime = (time: number): string => {
        const hours = Math.floor(time);
        const minutes = (time - hours) * 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };

    const isOvertime = schedule.tailorHours > 8 || schedule.decoratorHours > 8;

    return (
        <Box>
            {/* Capacity Overview */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Person sx={{ mr: 1 }} />
                                <Typography variant="h6">Thợ may</Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={Math.min((schedule.tailorHours / 8) * 100, 100)}
                                color={schedule.tailorHours > 8 ? 'error' : 'primary'}
                                sx={{ height: 10, borderRadius: 5, mb: 1 }}
                            />
                            <Typography variant="body2" color="text.secondary">
                                {schedule.tailorHours}/8 giờ ({Math.round((schedule.tailorHours / 8) * 100)}%)
                            </Typography>
                            {schedule.tailorHours > 8 && (
                                <Alert severity="warning" sx={{ mt: 1 }}>
                                    Cần làm thêm giờ: {schedule.tailorHours - 8} giờ
                                </Alert>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Build sx={{ mr: 1 }} />
                                <Typography variant="h6">Thợ trang trí</Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={Math.min((schedule.decoratorHours / 8) * 100, 100)}
                                color={schedule.decoratorHours > 8 ? 'error' : 'secondary'}
                                sx={{ height: 10, borderRadius: 5, mb: 1 }}
                            />
                            <Typography variant="body2" color="text.secondary">
                                {schedule.decoratorHours}/8 giờ ({Math.round((schedule.decoratorHours / 8) * 100)}%)
                            </Typography>
                            {schedule.decoratorHours > 8 && (
                                <Alert severity="warning" sx={{ mt: 1 }}>
                                    Cần làm thêm giờ: {schedule.decoratorHours - 8} giờ
                                </Alert>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Hourly Schedule */}
            <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                    Lịch làm việc chi tiết
                </Typography>

                <Box sx={{ display: 'flex', gap: 2 }}>
                    {/* Time column */}
                    <Box sx={{ minWidth: 80 }}>
                        <Typography variant="subtitle2" sx={{ height: 40, display: 'flex', alignItems: 'center' }}>
                            Giờ
                        </Typography>
                        <Divider />
                        {workingHours.map(hour => (
                            <Box key={hour} sx={{ height: 40, display: 'flex', alignItems: 'center', borderBottom: '1px solid #e0e0e0' }}>
                                <Typography variant="body2" color="text.secondary">
                                    {formatTime(hour)}
                                </Typography>
                            </Box>
                        ))}
                    </Box>

                    {/* Tailor column */}
                    <Box sx={{ flex: 1, minWidth: 300 }}>
                        <Typography variant="subtitle2" sx={{ height: 40, display: 'flex', alignItems: 'center' }}>
                            <Person sx={{ mr: 1, fontSize: 18 }} />
                            Thợ may
                        </Typography>
                        <Divider />
                        <Box sx={{ position: 'relative' }}>
                            {workingHours.map(hour => (
                                <Box key={hour} sx={{ height: 40, borderBottom: '1px solid #e0e0e0' }} />
                            ))}
                            {schedule.tailorTasks.map((task, index) => (
                                <TaskBlock key={index} task={task} workingHours={workingHours} />
                            ))}
                        </Box>
                    </Box>

                    {/* Decorator column */}
                    <Box sx={{ flex: 1, minWidth: 300 }}>
                        <Typography variant="subtitle2" sx={{ height: 40, display: 'flex', alignItems: 'center' }}>
                            <Build sx={{ mr: 1, fontSize: 18 }} />
                            Thợ trang trí
                        </Typography>
                        <Divider />
                        <Box sx={{ position: 'relative' }}>
                            {workingHours.map(hour => (
                                <Box key={hour} sx={{ height: 40, borderBottom: '1px solid #e0e0e0' }} />
                            ))}
                            {schedule.decoratorTasks.map((task, index) => (
                                <TaskBlock key={index} task={task} workingHours={workingHours} />
                            ))}
                        </Box>
                    </Box>
                </Box>

                {/* Legend */}
                <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Chip icon={<AccessTime />} label="Giờ làm việc: 8:30-12:00, 13:30-17:30" size="small" />
                    {isOvertime && <Chip icon={<Warning />} label="Cần làm thêm giờ" color="error" size="small" />}
                    <Chip icon={<CheckCircle />} label="Công suất tối đa: 8 giờ/ngày" color="success" size="small" />
                </Box>
            </Paper>
        </Box>
    );
};

// Task Block Component
const TaskBlock: React.FC<{ task: TimeSlot; workingHours: number[] }> = ({ task, workingHours }) => {
    const startHour = parseInt(task.start_time.split(':')[0]) + parseInt(task.start_time.split(':')[1]) / 60;
    const startIndex = workingHours.findIndex(h => h >= startHour);
    const blocks = Math.ceil(task.duration_hours * 2); // Each block is 30 minutes

    const top = startIndex * 40;
    const height = blocks * 20;

    const getTaskColor = () => {
        if (task.task.includes('May lần 1')) return '#2196f3';
        if (task.task.includes('Thử')) return '#ff9800';
        if (task.task.includes('Sửa')) return '#9c27b0';
        if (task.task.includes('May hoàn thiện')) return '#4caf50';
        if (task.task.includes('Trang trí')) return '#f44336';
        return '#757575';
    };

    return (
        <Tooltip title={`${task.task} (${task.duration_hours} giờ)`}>
            <Box
                sx={{
                    position: 'absolute',
                    top: `${top}px`,
                    left: 8,
                    right: 8,
                    height: `${height}px`,
                    backgroundColor: getTaskColor(),
                    color: 'white',
                    borderRadius: 1,
                    padding: '4px 8px',
                    fontSize: '11px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    opacity: 0.9,
                    '&:hover': {
                        opacity: 1,
                        zIndex: 10
                    }
                }}
            >
                <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold' }}>
                    {task.task}
                </Typography>
            </Box>
        </Tooltip>
    );
};

export default DailyTimetable;