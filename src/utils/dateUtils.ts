import dayjs from 'dayjs';
import { StaffLeave, StaffType } from '../types/database';

/**
 * Calculate working days excluding Sundays and staff leave days
 */
export const calculateWorkingDays = (
    startDate: string,
    days: number,
    staffLeaves: StaffLeave[],
    staffType: StaffType
): string => {
    let current = dayjs(startDate);
    let workingDaysAdded = 0;

    while (workingDaysAdded < days) {
        current = current.add(1, 'day');

        // Skip Sundays (day 0)
        if (current.day() === 0) continue;

        // Skip staff leave days
        const isLeaveDay = staffLeaves.some(leave =>
            (staffType === 'both' || leave.staff_name === staffType) &&
            dayjs(leave.leave_date).isSame(current, 'day')
        );

        if (!isLeaveDay) {
            workingDaysAdded++;
        }
    }

    return current.format('YYYY-MM-DD');
};

/**
 * Calculate sample testing appointment date based on order requirements
 */
export const calculateSampleTestingDate = (
    orderDate: string,
    materialStatus: boolean,
    priority: 'regular' | 'urgent',
    staffLeaves: StaffLeave[]
): string => {
    let daysToAdd = materialStatus ? 7 : 2; // 5 days fabric wait + 2 days processing or just 2 days

    if (priority === 'urgent') {
        daysToAdd = Math.max(1, daysToAdd - 1); // Urgent orders get priority
    }

    return calculateWorkingDays(orderDate, daysToAdd, staffLeaves, 'tailor');
};

/**
 * Calculate delivery appointment date based on sample testing date
 */
export const calculateDeliveryDate = (
    sampleTestingDate: string,
    additionalDays: number = 0,
    staffLeaves: StaffLeave[]
): string => {
    // Default process: First sewing (1 day) + fitting + alteration (1 day) + final sewing (1 day) + decoration (1 day)
    const standardDays = 4;
    const totalDays = standardDays + additionalDays;

    return calculateWorkingDays(sampleTestingDate, totalDays, staffLeaves, 'both');
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
 * Get working hours for a specific day (8 hours normal, 10 hours with overtime)
 */
export const getWorkingHours = (date: string, isOvertime: boolean = false): number => {
    const day = dayjs(date).day();

    // Sunday = 0 hours
    if (day === 0) return 0;

    // Monday-Saturday: 8 hours normal, 10 hours with overtime
    return isOvertime ? 10 : 8;
};

/**
 * Calculate capacity for a given date range
 */
export const calculateCapacity = (
    startDate: string,
    endDate: string,
    staffType: StaffType,
    staffLeaves: StaffLeave[],
    includeOvertime: boolean = false
): number => {
    let current = dayjs(startDate);
    const end = dayjs(endDate);
    let totalCapacity = 0;

    while (current.isSameOrBefore(end, 'day')) {
        // Skip Sundays
        if (current.day() === 0) {
            current = current.add(1, 'day');
            continue;
        }

        // Check if staff is on leave
        const isLeaveDay = staffLeaves.some(leave =>
            (staffType === 'both' || leave.staff_name === staffType) &&
            dayjs(leave.leave_date).isSame(current, 'day')
        );

        if (!isLeaveDay) {
            const hours = getWorkingHours(current.format('YYYY-MM-DD'), includeOvertime);

            // Capacity calculation based on staff type
            if (staffType === 'tailor') {
                // Tailor: 1 new outfit/day + 1 alteration, or 5 alterations
                totalCapacity += 1; // 1 outfit per day
            } else if (staffType === 'decorator') {
                // Decorator: 1 product/day, only after fitting
                totalCapacity += 1;
            } else if (staffType === 'both') {
                // Combined: 10 alterations/day for urgent
                totalCapacity += includeOvertime ? 10 : 5;
            }
        }

        current = current.add(1, 'day');
    }

    return totalCapacity;
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
 * Get next working day
 */
export const getNextWorkingDay = (date: string, staffLeaves: StaffLeave[], staffType: StaffType): string => {
    let current = dayjs(date);

    do {
        current = current.add(1, 'day');
    } while (!isWorkingDay(current.format('YYYY-MM-DD'), staffLeaves, staffType));

    return current.format('YYYY-MM-DD');
};