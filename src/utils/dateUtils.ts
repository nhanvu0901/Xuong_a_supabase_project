import dayjs from 'dayjs';
import { StaffLeave, StaffType, Order, TaskStage } from '../types/database';

interface ScheduleSlot {
    date: string;
    startHour: number;
    endHour: number;
    available: boolean;
    staff: StaffType;
}

/**
 * Calculate working hours for a specific day
 */
export const getWorkingHours = (date: string, isOvertime: boolean = false): number => {
    const day = dayjs(date).day();
    // Sunday = 0 hours
    if (day === 0) return 0;
    // Monday-Saturday: 8 hours normal, 10 hours with overtime
    return isOvertime ? 10 : 8;
};

/**
 * Get available time slots for a specific date
 */
export const getDailyTimeSlots = (date: string, isOvertime: boolean = false): ScheduleSlot[] => {
    const slots: ScheduleSlot[] = [];
    const day = dayjs(date).day();

    if (day === 0) return slots; // Sunday - no work

    // Morning slots: 8:30 - 12:00 (3.5 hours)
    slots.push({
        date,
        startHour: 8.5,
        endHour: 12,
        available: true,
        staff: 'both'
    });

    // Afternoon slots: 13:30 - 17:30 (4 hours)
    slots.push({
        date,
        startHour: 13.5,
        endHour: 17.5,
        available: true,
        staff: 'both'
    });

    // Overtime slots if needed: 17:30 - 19:30 (2 hours)
    if (isOvertime) {
        slots.push({
            date,
            startHour: 17.5,
            endHour: 19.5,
            available: true,
            staff: 'both'
        });
    }

    return slots;
};

/**
 * Calculate task duration based on type and service
 */
export const getTaskDuration = (
    taskName: string,
    serviceType: 'make_new' | 'fix_update'
): number => {
    if (serviceType === 'fix_update') return 2;

    const durations: Record<string, number> = {
        'first_sewing': 6,      // 6 hours
        'first_fitting': 0.5,   // 30 minutes
        'alteration': 2,        // 2 hours
        'final_sewing': 2,      // 2 hours
        'decoration': 8         // 8 hours (1 day)
    };

    return durations[taskName] || 0;
};

/**
 * Calculate next available slot for a task
 */
export const findNextAvailableSlot = (
    startDate: string,
    duration: number,
    staffType: StaffType,
    existingOrders: Order[],
    staffLeaves: StaffLeave[],
    priority: 'regular' | 'urgent'
): { date: string; startTime: string; endTime: string; requiresOvertime: boolean } => {
    let currentDate = dayjs(startDate);
    let requiresOvertime = false;

    while (true) {
        // Skip Sundays
        if (currentDate.day() === 0) {
            currentDate = currentDate.add(1, 'day');
            continue;
        }

        // Check if staff is on leave
        const isLeaveDay = staffLeaves.some(leave =>
            (staffType === 'both' || leave.staff_name === staffType) &&
            dayjs(leave.leave_date).isSame(currentDate, 'day')
        );

        if (isLeaveDay) {
            currentDate = currentDate.add(1, 'day');
            continue;
        }

        // Get daily capacity
        const dailySlots = getDailyTimeSlots(currentDate.format('YYYY-MM-DD'), priority === 'urgent');

        // Calculate already scheduled hours for this day
        const scheduledHours = existingOrders
            .filter(order => {
                const orderDate = order.scheduled_date || order.order_date;
                return dayjs(orderDate).isSame(currentDate, 'day') &&
                    (staffType === 'both' || order.staff_in_charge === staffType);
            })
            .reduce((total, order) => {
                if (order.current_stage) {
                    return total + order.current_stage.duration_hours;
                }
                return total + (order.service_type === 'fix_update' ? 2 : 8);
            }, 0);

        const availableHours = priority === 'urgent' ? 10 : 8;

        if (scheduledHours + duration <= availableHours) {
            // Found available slot
            const startHour = 8.5 + scheduledHours;
            let adjustedStartHour = startHour;

            // Skip lunch break if needed
            if (startHour >= 12 && startHour < 13.5) {
                adjustedStartHour = 13.5;
            }

            requiresOvertime = adjustedStartHour + duration > 17.5;

            return {
                date: currentDate.format('YYYY-MM-DD'),
                startTime: formatHourToTime(adjustedStartHour),
                endTime: formatHourToTime(adjustedStartHour + duration),
                requiresOvertime
            };
        }

        currentDate = currentDate.add(1, 'day');
    }
};

/**
 * Format hour number to time string
 */
const formatHourToTime = (hour: number): string => {
    const hours = Math.floor(hour);
    const minutes = Math.round((hour - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

/**
 * Calculate sample testing appointment date with task scheduling
 */
export const calculateSampleTestingDate = (
    orderDate: string,
    materialStatus: boolean,
    priority: 'regular' | 'urgent',
    serviceType: 'make_new' | 'fix_update',
    staffLeaves: StaffLeave[],
    existingOrders: Order[]
): string => {
    let startDate = dayjs(orderDate);

    // Add material waiting time if needed
    if (materialStatus) {
        startDate = startDate.add(5, 'day');
    }

    if (serviceType === 'fix_update') {
        // Fix/update can be done same day or next available
        const slot = findNextAvailableSlot(
            startDate.format('YYYY-MM-DD'),
            2,
            'tailor',
            existingOrders,
            staffLeaves,
            priority
        );
        return slot.date;
    }

    // For new making, first sewing takes 6 hours
    const firstSewingSlot = findNextAvailableSlot(
        startDate.format('YYYY-MM-DD'),
        6,
        'tailor',
        existingOrders,
        staffLeaves,
        priority
    );

    // Fitting is scheduled after first sewing (next available 30-minute slot)
    const fittingDate = dayjs(firstSewingSlot.date).add(1, 'day');
    const fittingSlot = findNextAvailableSlot(
        fittingDate.format('YYYY-MM-DD'),
        0.5,
        'tailor',
        existingOrders,
        staffLeaves,
        priority
    );

    return fittingSlot.date;
};

/**
 * Calculate delivery appointment date based on all task stages
 */
export const calculateDeliveryDate = (
    sampleTestingDate: string,
    serviceType: 'make_new' | 'fix_update',
    needsDecoration: boolean,
    additionalDays: number = 0,
    staffLeaves: StaffLeave[],
    existingOrders: Order[],
    priority: 'regular' | 'urgent'
): string => {
    if (serviceType === 'fix_update') {
        // Fix/update completes same day
        return sampleTestingDate;
    }

    let currentDate = dayjs(sampleTestingDate);

    // After fitting, schedule alteration if needed (2 hours)
    const alterationSlot = findNextAvailableSlot(
        currentDate.format('YYYY-MM-DD'),
        2,
        'tailor',
        existingOrders,
        staffLeaves,
        priority
    );

    // Final sewing (2 hours)
    currentDate = dayjs(alterationSlot.date);
    const finalSewingSlot = findNextAvailableSlot(
        currentDate.format('YYYY-MM-DD'),
        2,
        'tailor',
        existingOrders,
        staffLeaves,
        priority
    );

    // Decoration if needed (8 hours = 1 full day)
    if (needsDecoration) {
        currentDate = dayjs(finalSewingSlot.date).add(1, 'day');
        const decorationSlot = findNextAvailableSlot(
            currentDate.format('YYYY-MM-DD'),
            8,
            'decorator',
            existingOrders,
            staffLeaves,
            priority
        );
        currentDate = dayjs(decorationSlot.date);
    } else {
        currentDate = dayjs(finalSewingSlot.date);
    }

    // Add any additional days requested
    if (additionalDays > 0) {
        currentDate = currentDate.add(additionalDays, 'day');
    }

    return currentDate.format('YYYY-MM-DD');
};

/**
 * Calculate if overtime is required for urgent orders
 */
export const calculateOvertimeRequired = (
    requestedDeliveryDate: string,
    calculatedDeliveryDate: string
): boolean => {
    return dayjs(requestedDeliveryDate).isBefore(dayjs(calculatedDeliveryDate));
};

/**
 * Format date for display
 */
export const formatDate = (date: string, format: string = 'DD/MM/YYYY'): string => {
    return dayjs(date).format(format);
};

/**
 * Check if a date is a working day
 */
export const isWorkingDay = (date: string, staffLeaves: StaffLeave[], staffType: StaffType): boolean => {
    const day = dayjs(date);

    // Not Sunday
    if (day.day() === 0) return false;

    // Not a leave day
    const isLeaveDay = staffLeaves.some(leave =>
        (staffType === 'both' || leave.staff_name === staffType) &&
        dayjs(leave.leave_date).isSame(day, 'day')
    );

    return !isLeaveDay;
};

/**
 * Get queue position for a new order
 */
export const getQueuePosition = (
    orders: Order[],
    priority: 'regular' | 'urgent'
): number => {
    const pendingOrders = orders.filter(o =>
        !o.current_stage || !o.current_stage.completed
    );

    if (priority === 'urgent') {
        // Urgent orders go to front of queue after other urgent orders
        const urgentCount = pendingOrders.filter(o => o.priority === 'urgent').length;
        return urgentCount + 1;
    }

    return pendingOrders.length + 1;
};

/**
 * Calculate daily workload summary
 */
export const calculateDailyWorkload = (
    date: string,
    orders: Order[]
): {
    tailorHours: number;
    decoratorHours: number;
    totalOrders: number;
    requiresOvertime: boolean;
} => {
    const dayOrders = orders.filter(order => {
        const scheduledDate = order.scheduled_date || order.order_date;
        return dayjs(scheduledDate).format('YYYY-MM-DD') === date;
    });

    let tailorHours = 0;
    let decoratorHours = 0;

    dayOrders.forEach(order => {
        if (order.service_type === 'fix_update') {
            tailorHours += 2;
        } else if (order.current_stage) {
            const duration = order.current_stage.duration_hours;

            if (order.current_stage.name === 'decoration') {
                decoratorHours += duration;
            } else {
                tailorHours += duration;
            }
        }
    });

    return {
        tailorHours,
        decoratorHours,
        totalOrders: dayOrders.length,
        requiresOvertime: tailorHours > 8 || decoratorHours > 8
    };
};