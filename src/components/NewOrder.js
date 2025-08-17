import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { addDays, isSunday, format, differenceInDays } from 'date-fns';
import { vi } from 'date-fns/locale';

const NewOrder = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [calculatedDates, setCalculatedDates] = useState(null);
    const [employeeSchedules, setEmployeeSchedules] = useState([]);

    // Form state
    const [formData, setFormData] = useState({
        // Customer info
        customerName: '',
        birthDate: '',
        phone: '',
        organization: '',
        referrer: '',

        // Order info
        priority: 'normal',
        specifiedPickupDate: '', // For URGENT orders - this is the actual delivery date
        materialStatus: 'available',
        totalPrice: 0,

        // Order items
        orderItems: [{ productId: '', quantity: 1, unitPrice: 0 }]
    });

    useEffect(() => {
        fetchProducts();
        fetchEmployeeSchedules();
    }, []);

    useEffect(() => {
        if (formData.orderItems.length > 0 && formData.orderItems[0].productId) {
            calculateProductionSchedule();
        }
    }, [formData.orderItems, formData.priority, formData.specifiedPickupDate, formData.materialStatus]);

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('name');

            if (error) throw error;
            setProducts(data || []);
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

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

    const isWorkingDay = (date) => {
        // Check if it's Sunday
        if (isSunday(date)) return false;

        // Check if it's a scheduled day off
        const dateStr = format(date, 'yyyy-MM-dd');
        const isDayOff = employeeSchedules.some(schedule =>
            schedule.date === dateStr && !schedule.is_working
        );

        return !isDayOff;
    };

    const calculateWorkingDays = (startDate, days) => {
        let currentDate = new Date(startDate);
        let workingDaysAdded = 0;

        while (workingDaysAdded < days) {
            currentDate = addDays(currentDate, 1);

            // Check if it's a working day
            if (isWorkingDay(currentDate)) {
                workingDaysAdded++;
            }
        }

        return currentDate;
    };

    const calculateWorkingDaysBackward = (endDate, days) => {
        let currentDate = new Date(endDate);
        let workingDaysSubtracted = 0;

        while (workingDaysSubtracted < days) {
            currentDate = addDays(currentDate, -1);

            // Check if it's a working day
            if (isWorkingDay(currentDate)) {
                workingDaysSubtracted++;
            }
        }

        return currentDate;
    };

    const calculateProductionSchedule = async () => {
        try {
            // Get current production load
            const { data: existingSchedules, error } = await supabase
                .from('production_schedule')
                .select('*')
                .in('status', ['waiting_material', 'sewing', 'fitting', 'finishing', 'decorating']);

            if (error) throw error;

            const today = new Date();
            const selectedProduct = products.find(p => p.id === formData.orderItems[0].productId);
            const needsDecoration = selectedProduct?.type === 'shirt';

            let fittingDate, pickupDate, requiresOvertime = false, overtimeHours = 0;

            if (formData.priority === 'urgent' && formData.specifiedPickupDate) {
                // URGENT order - work backward from actual delivery date
                const actualDeliveryDate = new Date(formData.specifiedPickupDate);

                // Calculate required production days
                const finishingDays = 0.5;
                const decorationDays = needsDecoration ? 1 : 0;
                const totalFinishingDays = finishingDays + decorationDays;

                // Work backward from delivery date
                fittingDate = calculateWorkingDaysBackward(actualDeliveryDate, totalFinishingDays);

                // Calculate if overtime is needed
                const availableWorkingDays = [];
                let checkDate = new Date(today);
                while (checkDate <= actualDeliveryDate) {
                    if (isWorkingDay(checkDate)) {
                        availableWorkingDays.push(checkDate);
                    }
                    checkDate = addDays(checkDate, 1);
                }

                const requiredDays = 1.5 + (needsDecoration ? 1 : 0); // Sewing + finishing + decoration
                if (availableWorkingDays.length < requiredDays) {
                    requiresOvertime = true;
                    overtimeHours = Math.ceil((requiredDays - availableWorkingDays.length) * 8); // 8 hours per day
                }

                pickupDate = actualDeliveryDate;

            } else {
                // REGULAR order - work forward from today
                let startDate = today;

                // If material needs to be ordered, add 5 working days
                if (formData.materialStatus === 'need_order') {
                    startDate = calculateWorkingDays(today, 5);
                }

                // Calculate based on current workload
                const sewingDays = 1; // 1 day for sewing 50%
                const finishingDays = 0.5; // Half day for finishing
                const decorationDays = needsDecoration ? 1 : 0;

                // Calculate fitting date (after sewing 50%)
                fittingDate = calculateWorkingDays(startDate, sewingDays);

                // Calculate pickup date
                pickupDate = calculateWorkingDays(fittingDate, finishingDays + decorationDays);
            }

            setCalculatedDates({
                fittingDate,
                pickupDate,
                requiresOvertime,
                overtimeHours,
                productionDays: differenceInDays(pickupDate, today)
            });

        } catch (error) {
            console.error('Error calculating schedule:', error);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleOrderItemChange = (index, field, value) => {
        const newItems = [...formData.orderItems];
        newItems[index] = { ...newItems[index], [field]: value };

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
            orderItems: [...prev.orderItems, { productId: '', quantity: 1, unitPrice: 0 }]
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
                    birth_date: formData.birthDate || null,
                    phone: formData.phone,
                    organization: formData.organization,
                    referrer: formData.referrer
                })
                .select()
                .single();

            if (customerError) throw customerError;

            // Create order with actual_delivery_date for URGENT orders
            const orderData = {
                customer_id: customer.id,
                priority: formData.priority,
                material_status: formData.materialStatus,
                total_price: formData.totalPrice,
                status: 'pending'
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

            // Create order items
            const orderItemsData = formData.orderItems.map(item => ({
                order_id: order.id,
                product_id: item.productId,
                quantity: item.quantity,
                unit_price: item.unitPrice
            }));

            const { data: orderItems, error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItemsData)
                .select();

            if (itemsError) throw itemsError;

            // Create production schedule
            for (const item of orderItems) {
                const scheduleData = {
                    order_id: order.id,
                    order_item_id: item.id,
                    scheduled_fitting_date: calculatedDates?.fittingDate,
                    status: formData.materialStatus === 'need_order' ? 'waiting_material' : 'sewing',
                    requires_overtime: calculatedDates?.requiresOvertime || false,
                    overtime_hours: calculatedDates?.overtimeHours || 0
                };

                // Only add scheduled_pickup_date for REGULAR orders
                if (formData.priority === 'normal') {
                    scheduleData.scheduled_pickup_date = calculatedDates?.pickupDate;
                }

                const { error: scheduleError } = await supabase
                    .from('production_schedule')
                    .insert(scheduleData);

                if (scheduleError) throw scheduleError;
            }

            // Create material order if needed
            if (formData.materialStatus === 'need_order') {
                const { error: materialError } = await supabase
                    .from('material_orders')
                    .insert({
                        order_id: order.id,
                        material_type: 'Vải may',
                        expected_arrival_date: calculateWorkingDays(new Date(), 5)
                    });

                if (materialError) throw materialError;
            }

            setMessage('Đơn hàng đã được tạo thành công!');

            // Reset form
            setFormData({
                customerName: '',
                birthDate: '',
                phone: '',
                organization: '',
                referrer: '',
                priority: 'normal',
                specifiedPickupDate: '',
                materialStatus: 'available',
                totalPrice: 0,
                orderItems: [{ productId: '', quantity: 1, unitPrice: 0 }]
            });
            setCalculatedDates(null);

        } catch (error) {
            console.error('Error creating order:', error);
            setMessage('Có lỗi xảy ra khi tạo đơn hàng: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date) => {
        if (!date) return '-';
        return format(new Date(date), 'dd/MM/yyyy', { locale: vi });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    };

    return (
        <div className="card">
            <div className="card-header">
                Tạo đơn hàng mới
            </div>
            <div className="card-body">
                {message && (
                    <div className={`alert ${message.includes('thành công') ? 'alert-success' : 'alert-error'}`}>
                        {message}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* Customer Information */}
                    <div className="form-section">
                        <h3>Thông tin khách hàng</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Tên khách hàng *</label>
                                <input
                                    type="text"
                                    name="customerName"
                                    value={formData.customerName}
                                    onChange={handleInputChange}
                                    required
                                    className="form-input"
                                />
                            </div>
                            <div className="form-group">
                                <label>Ngày sinh</label>
                                <input
                                    type="date"
                                    name="birthDate"
                                    value={formData.birthDate}
                                    onChange={handleInputChange}
                                    className="form-input"
                                />
                            </div>
                            <div className="form-group">
                                <label>Số điện thoại *</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    required
                                    className="form-input"
                                />
                            </div>
                            <div className="form-group">
                                <label>Cơ quan</label>
                                <input
                                    type="text"
                                    name="organization"
                                    value={formData.organization}
                                    onChange={handleInputChange}
                                    className="form-input"
                                />
                            </div>
                            <div className="form-group">
                                <label>Người giới thiệu</label>
                                <input
                                    type="text"
                                    name="referrer"
                                    value={formData.referrer}
                                    onChange={handleInputChange}
                                    className="form-input"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Order Information */}
                    <div className="form-section">
                        <h3>Thông tin đơn hàng</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Mức độ ưu tiên *</label>
                                <select
                                    name="priority"
                                    value={formData.priority}
                                    onChange={handleInputChange}
                                    className="form-select"
                                >
                                    <option value="normal">Thường (REGULAR)</option>
                                    <option value="urgent">Gấp (URGENT)</option>
                                </select>
                            </div>

                            {/* Only show delivery date field for URGENT orders */}
                            {formData.priority === 'urgent' && (
                                <div className="form-group">
                                    <label>Ngày lấy hàng thực tế (khách yêu cầu) *</label>
                                    <input
                                        type="date"
                                        name="specifiedPickupDate"
                                        value={formData.specifiedPickupDate}
                                        onChange={handleInputChange}
                                        required={formData.priority === 'urgent'}
                                        className="form-input"
                                        min={format(new Date(), 'yyyy-MM-dd')}
                                    />
                                    <small className="form-hint">
                                        Đây là ngày khách hàng yêu cầu lấy hàng cho đơn GẤP
                                    </small>
                                </div>
                            )}

                            <div className="form-group">
                                <label>Tình trạng vải *</label>
                                <select
                                    name="materialStatus"
                                    value={formData.materialStatus}
                                    onChange={handleInputChange}
                                    className="form-select"
                                >
                                    <option value="available">Có sẵn</option>
                                    <option value="need_order">Cần đặt vải</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Order Items */}
                    <div className="form-section">
                        <h3>Sản phẩm</h3>
                        {formData.orderItems.map((item, index) => (
                            <div key={index} className="order-item">
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Sản phẩm *</label>
                                        <select
                                            value={item.productId}
                                            onChange={(e) => handleOrderItemChange(index, 'productId', e.target.value)}
                                            required
                                            className="form-select"
                                        >
                                            <option value="">Chọn sản phẩm</option>
                                            {products.map(product => (
                                                <option key={product.id} value={product.id}>
                                                    {product.name} - {product.type}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Số lượng *</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => handleOrderItemChange(index, 'quantity', parseInt(e.target.value))}
                                            required
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Đơn giá *</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={item.unitPrice}
                                            onChange={(e) => handleOrderItemChange(index, 'unitPrice', parseFloat(e.target.value))}
                                            required
                                            className="form-input"
                                        />
                                    </div>
                                    {formData.orderItems.length > 1 && (
                                        <div className="form-group">
                                            <button
                                                type="button"
                                                onClick={() => removeOrderItem(index)}
                                                className="btn btn-danger"
                                            >
                                                Xóa
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={addOrderItem}
                            className="btn btn-secondary"
                        >
                            Thêm sản phẩm
                        </button>
                    </div>

                    {/* Calculated Information */}
                    {calculatedDates && (
                        <div className="form-section calculated-info">
                            <h3>Thông tin tính toán</h3>
                            <div className="info-grid">
                                <div className="info-item">
                                    <label>Tổng tiền:</label>
                                    <span>{formatCurrency(formData.totalPrice)}</span>
                                </div>
                                <div className="info-item">
                                    <label>Ngày hẹn thử phôi:</label>
                                    <span>{formatDate(calculatedDates.fittingDate)}</span>
                                </div>

                                {formData.priority === 'normal' && (
                                    <div className="info-item">
                                        <label>Ngày hẹn lấy hàng (tự động tính):</label>
                                        <span>{formatDate(calculatedDates.pickupDate)}</span>
                                    </div>
                                )}

                                {formData.priority === 'urgent' && (
                                    <>
                                        <div className="info-item">
                                            <label>Yêu cầu làm thêm giờ:</label>
                                            <span className={calculatedDates.requiresOvertime ? 'text-danger' : 'text-success'}>
                                                {calculatedDates.requiresOvertime ? `Có (${calculatedDates.overtimeHours} giờ)` : 'Không'}
                                            </span>
                                        </div>
                                        <div className="info-item">
                                            <label>Ngày lấy hàng thực tế:</label>
                                            <span className="text-urgent">{formatDate(calculatedDates.pickupDate)}</span>
                                        </div>
                                    </>
                                )}

                                <div className="info-item">
                                    <label>Số ngày sản xuất:</label>
                                    <span>{calculatedDates.productionDays} ngày</span>
                                </div>
                            </div>

                            {formData.priority === 'urgent' && calculatedDates.requiresOvertime && (
                                <div className="alert alert-warning">
                                    <strong>Lưu ý:</strong> Đơn hàng này yêu cầu nhân viên làm thêm giờ ({calculatedDates.overtimeHours} giờ) để hoàn thành đúng hạn.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Submit Button */}
                    <div className="form-actions">
                        <button
                            type="submit"
                            disabled={loading || !formData.customerName || !formData.phone || formData.orderItems.length === 0}
                            className="btn btn-primary"
                        >
                            {loading ? 'Đang xử lý...' : 'Tạo đơn hàng'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewOrder;