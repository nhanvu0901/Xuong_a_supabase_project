import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { addDays, isSunday, format, differenceInDays } from 'date-fns';
import { vi } from 'date-fns/locale';

const NewOrder = () => {
    // REMOVED products state - no longer needed
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [calculatedDates, setCalculatedDates] = useState(null);
    const [employeeSchedules, setEmployeeSchedules] = useState([]);

    // Service types to replace products
    const serviceTypes = [
        { value: 'may_ao_dai', label: 'May Áo Dài' },
        { value: 'may_ao_cuoi', label: 'May Áo Cưới' },
        { value: 'may_vest', label: 'May Vest' },
        { value: 'may_dam', label: 'May Đầm' },
        { value: 'sua_chua', label: 'Sửa Chữa' },
        { value: 'khac', label: 'Khác' }
    ];

    // Form state - UPDATED to use service_type
    const [formData, setFormData] = useState({
        // Customer info
        customerName: '',
        birthDate: '',
        phone: '',

        // Order info
        priority: 'normal',
        specifiedPickupDate: '', // For URGENT orders - this is the actual delivery date
        materialStatus: 'available',
        totalPrice: 0,

        // UPDATED: Now uses service_type instead of productId
        orderItems: [{
            serviceType: '', // Replaces productId
            quantity: 1,
            unitPrice: 0,
            notes: ''
        }],
    });

    useEffect(() => {
        // REMOVED fetchProducts() - no longer needed
        fetchEmployeeSchedules();
    }, []);

    const fetchEmployeeSchedules = async () => {
        try {
            // Fetch employee schedules for the next 30 days to check for days off
            const today = new Date();
            const endDate = addDays(today, 30);

            const { data, error } = await supabase
                .from('employee_schedule')
                .select('*')
                .gte('date', format(today, 'yyyy-MM-dd'))
                .lte('date', format(endDate, 'yyyy-MM-dd'))
                .eq('is_working', false);

            if (error) throw error;
            setEmployeeSchedules(data || []);
        } catch (error) {
            console.error('Error fetching employee schedules:', error);
        }
    };

    const isWorkingDay = useCallback((date) => {
        // Check if it's Sunday
        if (isSunday(date)) return false;

        // Check if employees have day off
        const dateStr = format(date, 'yyyy-MM-dd');
        const hasSewerOff = employeeSchedules.some(
            s => s.date === dateStr && s.employee_type === 'sewer' && !s.is_working
        );
        const hasDecoratorOff = employeeSchedules.some(
            s => s.date === dateStr && s.employee_type === 'decorator' && !s.is_working
        );

        // If both have day off, it's not a working day
        return !(hasSewerOff && hasDecoratorOff);
    }, [employeeSchedules]);

    const calculateDates = useCallback(() => {
        if (formData.priority === 'urgent' && formData.specifiedPickupDate) {
            // For URGENT orders with specified date
            const pickupDate = new Date(formData.specifiedPickupDate);
            let fittingDate = pickupDate;
            let workingDaysFound = 0;

            // Find 3 working days before pickup for fitting
            while (workingDaysFound < 3) {
                fittingDate = addDays(fittingDate, -1);
                if (isWorkingDay(fittingDate)) {
                    workingDaysFound++;
                }
            }

            setCalculatedDates({
                fittingDate: format(fittingDate, 'yyyy-MM-dd'),
                pickupDate: format(pickupDate, 'yyyy-MM-dd')
            });
        } else {
            // For NORMAL orders
            const today = new Date();
            let fittingDate = today;
            let workingDaysCount = 0;

            // Calculate fitting date (3-5 working days based on material)
            const daysForFitting = formData.materialStatus === 'need_order' ? 5 : 3;
            while (workingDaysCount < daysForFitting) {
                fittingDate = addDays(fittingDate, 1);
                if (isWorkingDay(fittingDate)) {
                    workingDaysCount++;
                }
            }

            // Calculate pickup date (5 working days after fitting)
            let pickupDate = fittingDate;
            workingDaysCount = 0;
            while (workingDaysCount < 5) {
                pickupDate = addDays(pickupDate, 1);
                if (isWorkingDay(pickupDate)) {
                    workingDaysCount++;
                }
            }

            setCalculatedDates({
                fittingDate: format(fittingDate, 'yyyy-MM-dd'),
                pickupDate: format(pickupDate, 'yyyy-MM-dd')
            });
        }
    }, [formData.priority, formData.specifiedPickupDate, formData.materialStatus, isWorkingDay]);

    useEffect(() => {
        calculateDates();
    }, [calculateDates]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // UPDATED: Simplified to work with service_type
    const handleOrderItemChange = (index, field, value) => {
        const newItems = [...formData.orderItems];
        newItems[index] = { ...newItems[index], [field]: value };

        // Set default price based on service type
        if (field === 'serviceType') {
            const defaultPrices = {
                'may_ao_dai': 500000,
                'may_ao_cuoi': 1000000,
                'may_vest': 400000,
                'may_dam': 300000,
                'sua_chua': 50000,
                'khac': 0
            };
            newItems[index].unitPrice = defaultPrices[value] || 0;
        }

        // Calculate total price
        const totalPrice = newItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

        setFormData(prev => ({
            ...prev,
            orderItems: newItems,
            totalPrice
        }));
    };

    const addOrderItem = () => {
        setFormData(prev => ({
            ...prev,
            orderItems: [...prev.orderItems, {
                serviceType: '',
                quantity: 1,
                unitPrice: 0,
                notes: ''
            }]
        }));
    };

    const removeOrderItem = (index) => {
        const newItems = formData.orderItems.filter((_, i) => i !== index);
        const totalPrice = newItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

        setFormData(prev => ({
            ...prev,
            orderItems: newItems,
            totalPrice
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            // Create customer
            const { data: customer, error: customerError } = await supabase
                .from('customers')
                .insert({
                    name: formData.customerName,
                    phone: formData.phone,

                })
                .select()
                .single();

            if (customerError) throw customerError;

            // Generate order number
            const orderNumber = `ORD-${Date.now()}`;

            // UPDATED: Create order with service_type
            const orderData = {
                order_number: orderNumber,
                customer_id: customer.id,
                service_type: formData.orderItems[0].serviceType, // Main service type
                priority: formData.priority,
                material_status: formData.materialStatus,
                total_amount: formData.totalPrice,
                status: 'pending',
                delivery_date: calculatedDates?.pickupDate
            };

            // For URGENT orders, store the actual delivery date
            if (formData.priority === 'urgent' && formData.specifiedPickupDate) {
                orderData.actual_delivery_date = formData.specifiedPickupDate;
            }

            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert(orderData)
                .select()
                .single();

            if (orderError) throw orderError;

            // UPDATED: Create order items with service_type
            const orderItemsData = formData.orderItems.map(item => ({
                order_id: order.id,
                service_type: item.serviceType,
                quantity: item.quantity,
                price: item.unitPrice,
                notes: item.notes || null
            }));

            const { data: orderItems, error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItemsData)
                .select();

            if (itemsError) throw itemsError;

            // Create production schedule
            const scheduleData = {
                order_id: order.id,
                start_date: format(new Date(), 'yyyy-MM-dd'),
                end_date: calculatedDates?.pickupDate,
                status: formData.materialStatus === 'need_order' ? 'waiting_material' : 'scheduled'
            };

            const { error: scheduleError } = await supabase
                .from('production_schedule')
                .insert(scheduleData);

            if (scheduleError) throw scheduleError;

            setMessage('Đơn hàng đã được tạo thành công!');

            // Reset form
            setFormData({
                customerName: '',
                birthDate: '',
                phone: '',
                priority: 'normal',
                specifiedPickupDate: '',
                materialStatus: 'available',
                totalPrice: 0,
                orderItems: [{
                    serviceType: '',
                    quantity: 1,
                    unitPrice: 0,
                    notes: ''
                }]
            });
        } catch (error) {
            console.error('Error creating order:', error);
            setMessage(`Lỗi: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="new-order-container">
            <h2>Tạo Đơn Hàng Mới</h2>

            {message && (
                <div className={`message ${message.includes('Lỗi') ? 'error' : 'success'}`}>
                    {message}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {/* Customer Information */}
                <div className="form-section">
                    <h3>Thông Tin Khách Hàng</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Tên Khách Hàng *</label>
                            <input
                                type="text"
                                name="customerName"
                                value={formData.customerName}
                                onChange={handleInputChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Ngày Sinh</label>
                            <input
                                type="date"
                                name="birthDate"
                                value={formData.birthDate}
                                onChange={handleInputChange}
                            />
                        </div>
                        <div className="form-group">
                            <label>Số Điện Thoại *</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                required
                            />
                        </div>


                    </div>
                </div>

                {/* Order Information */}
                <div className="form-section">
                    <h3>Thông Tin Đơn Hàng</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Độ Ưu Tiên</label>
                            <select
                                name="priority"
                                value={formData.priority}
                                onChange={handleInputChange}
                            >
                                <option value="normal">Bình Thường</option>
                                <option value="urgent">Khẩn Cấp</option>
                            </select>
                        </div>

                        {formData.priority === 'urgent' && (
                            <div className="form-group">
                                <label>Ngày Lấy Hàng Yêu Cầu *</label>
                                <input
                                    type="date"
                                    name="specifiedPickupDate"
                                    value={formData.specifiedPickupDate}
                                    onChange={handleInputChange}
                                    min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                                    required
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label>Tình Trạng Vải</label>
                            <select
                                name="materialStatus"
                                value={formData.materialStatus}
                                onChange={handleInputChange}
                            >
                                <option value="available">Có Sẵn</option>
                                <option value="need_order">Cần Đặt</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* UPDATED: Order Items - Now with service_type */}
                <div className="form-section">
                    <h3>Chi Tiết Dịch Vụ</h3>
                    {formData.orderItems.map((item, index) => (
                        <div key={index} className="order-item">
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Loại Dịch Vụ *</label>
                                    <select
                                        value={item.serviceType}
                                        onChange={(e) => handleOrderItemChange(index, 'serviceType', e.target.value)}
                                        required
                                    >
                                        <option value="">Chọn dịch vụ</option>
                                        {serviceTypes.map(type => (
                                            <option key={type.value} value={type.value}>
                                                {type.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Số Lượng</label>
                                    <input
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => handleOrderItemChange(index, 'quantity', parseInt(e.target.value))}
                                        min="1"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Đơn Giá</label>
                                    <input
                                        type="number"
                                        value={item.unitPrice}
                                        onChange={(e) => handleOrderItemChange(index, 'unitPrice', parseInt(e.target.value))}
                                        min="0"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Ghi Chú</label>
                                    <input
                                        type="text"
                                        value={item.notes}
                                        onChange={(e) => handleOrderItemChange(index, 'notes', e.target.value)}
                                        placeholder="Ghi chú cho dịch vụ..."
                                    />
                                </div>

                                {formData.orderItems.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeOrderItem(index)}
                                        className="btn-remove"
                                    >
                                        Xóa
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    <button type="button" onClick={addOrderItem} className="btn-add">
                        Thêm Dịch Vụ
                    </button>
                </div>

                {/* Summary */}
                <div className="form-section">
                    <h3>Tổng Kết</h3>
                    <div className="summary">
                        <p><strong>Tổng Tiền:</strong> {formData.totalPrice.toLocaleString('vi-VN')} VNĐ</p>
                        {calculatedDates && (
                            <>
                                <p><strong>Ngày Thử Đồ Dự Kiến:</strong> {format(new Date(calculatedDates.fittingDate), 'dd/MM/yyyy', { locale: vi })}</p>
                                <p><strong>Ngày Lấy Hàng Dự Kiến:</strong> {format(new Date(calculatedDates.pickupDate), 'dd/MM/yyyy', { locale: vi })}</p>
                            </>
                        )}
                    </div>
                </div>

                <div className="form-actions">
                    <button type="submit" disabled={loading} className="btn-submit">
                        {loading ? 'Đang xử lý...' : 'Tạo Đơn Hàng'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default NewOrder;