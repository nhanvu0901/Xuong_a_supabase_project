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

    // MOVE THESE FUNCTIONS BEFORE THE useMemo THAT USES THEM
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

    // NOW THE useMemo CAN USE THE FUNCTIONS
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
    }, [date, orders]); // Add dependencies here

    const isOvertime = schedule.tailorHours > 8 || schedule.decoratorHours > 8;

    // Rest of the component remains the same...
    return (
        <Box>
            {/* Component JSX remains the same */}
        </Box>
    );
};

export default DailyTimetable;