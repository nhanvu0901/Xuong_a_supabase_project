import React, { useState, useEffect, useCallback } from 'react';
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
        orderItems: [{ productId: '', quantity: 1, unitPrice: 0 }],

        // Add fix product option
        includeFixProduct: false
    });

    useEffect(() => {
        fetchProducts();
        fetchEmployeeSchedules();
    }, []);

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

    const calculateProductionSchedule = useCallback(() => {
        if (!formData.orderItems[0]?.productId) return;

        try {
            const today = new Date();
            let fittingDate = null;
            let pickupDate = null;
            let requiresOvertime = false;
            let overtimeHours = 0;

            // Get product info
            const selectedProduct = products.find(p => p.id === formData.orderItems[0].productId);
            const needsDecoration = selectedProduct?.type === 'ao_dai';

            // Add 3 hours for fix product
            let additionalHours = formData.includeFixProduct ? 3 : 0;

            if (formData.priority === 'urgent' && formData.specifiedPickupDate) {
                // URGENT order - work backward from delivery date
                const actualDeliveryDate = new Date(formData.specifiedPickupDate);

                // Calculate required days
                const requiredDays = Math.ceil(1.5 + (needsDecoration ? 1 : 0) + (additionalHours / 8));

                // Calculate fitting date
                let daysBeforeDelivery = 0;
                let currentDate = new Date(actualDeliveryDate);

                while (daysBeforeDelivery < requiredDays) {
                    currentDate = addDays(currentDate, -1);
                    if (isWorkingDay(currentDate)) {
                        daysBeforeDelivery++;
                    }
                }

                fittingDate = currentDate;

                // Check if we have enough working days
                const availableWorkingDays = [];
                currentDate = new Date(today);
                while (currentDate <= actualDeliveryDate) {
                    if (isWorkingDay(currentDate)) {
                        availableWorkingDays.push(currentDate);
                    }
                    currentDate = addDays(currentDate, 1);
                }

                if (availableWorkingDays.length < requiredDays) {
                    requiresOvertime = true;
                    overtimeHours = Math.ceil((requiredDays - availableWorkingDays.length) * 8) + additionalHours;
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
                const fixProductDays = formData.includeFixProduct ? (3 / 8) : 0; // 3 hours = 0.375 days

                // Calculate fitting date (after sewing 50%)
                fittingDate = calculateWorkingDays(startDate, sewingDays);

                // Calculate pickup date
                pickupDate = calculateWorkingDays(fittingDate, finishingDays + decorationDays + fixProductDays);
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
    }, [formData.orderItems, formData.priority, formData.specifiedPickupDate, formData.materialStatus, formData.includeFixProduct, products, employeeSchedules]);

    useEffect(() => {
        if (formData.orderItems.length > 0 && formData.orderItems[0].productId) {
            calculateProductionSchedule();
        }
    }, [formData.orderItems, formData.priority, formData.specifiedPickupDate, formData.materialStatus, formData.includeFixProduct, calculateProductionSchedule]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
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

            // Add fix product if selected
            if (formData.includeFixProduct) {
                orderItemsData.push({
                    order_id: order.id,
                    product_id: null, // Fix product doesn't have a product_id
                    quantity: 1,
                    unit_price: 0,
                    notes: 'Sửa chữa sản phẩm (3 giờ)'
                });
            }

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
                    scheduled_pickup_date: calculatedDates?.pickupDate,
                    status: formData.materialStatus === 'need_order' ? 'pending_material' : 'pending',
                    requires_overtime: calculatedDates?.requiresOvertime || false,
                    overtime_hours: calculatedDates?.overtimeHours || 0
                };

                const { error: scheduleError } = await supabase
                    .from('production_schedule')
                    .insert(scheduleData);

                if (scheduleError) throw scheduleError;

                // Create employee_production_schedule link for pickup date
                if (calculatedDates?.pickupDate) {
                    const { error: linkError } = await supabase
                        .from('employee_production_schedule')
                        .insert({
                            production_schedule_id: item.id,
                            date: format(new Date(calculatedDates.pickupDate), 'yyyy-MM-dd'),
                            employee_type: 'sewer',
                            task_type: 'pickup'
                        });

                    if (linkError) console.error('Error creating employee-production link:', linkError);
                }
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
                orderItems: [{ productId: '', quantity: 1, unitPrice: 0 }],
                includeFixProduct: false
            });
            setCalculatedDates(null);

        } catch (error) {
            console.error('Error creating order:', error);
            setMessage('Lỗi khi tạo đơn hàng: ' + error.message);
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
                            <label>Tên khách hàng *</label>
                            <input
                                type="text"
                                name="customerName"
                                value={formData.customerName}
                                onChange={handleInputChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Ngày sinh</label>
                            <input
                                type="date"
                                name="birthDate"
                                value={formData.birthDate}
                                onChange={handleInputChange}
                            />
                        </div>
                        <div className="form-group">
                            <label>Số điện thoại</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                            />
                        </div>
                        <div className="form-group">
                            <label>Tổ chức</label>
                            <input
                                type="text"
                                name="organization"
                                value={formData.organization}
                                onChange={handleInputChange}
                            />
                        </div>
                        <div className="form-group">
                            <label>Người giới thiệu</label>
                            <input
                                type="text"
                                name="referrer"
                                value={formData.referrer}
                                onChange={handleInputChange}
                            />
                        </div>
                    </div>
                </div>

                {/* Order Details */}
                <div className="form-section">
                    <h3>Chi Tiết Đơn Hàng</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Độ ưu tiên</label>
                            <select
                                name="priority"
                                value={formData.priority}
                                onChange={handleInputChange}
                            >
                                <option value="normal">Thường</option>
                                <option value="urgent">Khẩn cấp</option>
                            </select>
                        </div>

                        {formData.priority === 'urgent' && (
                            <div className="form-group">
                                <label>Ngày giao hàng yêu cầu *</label>
                                <input
                                    type="date"
                                    name="specifiedPickupDate"
                                    value={formData.specifiedPickupDate}
                                    onChange={handleInputChange}
                                    min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                                    required={formData.priority === 'urgent'}
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label>Tình trạng vật liệu</label>
                            <select
                                name="materialStatus"
                                value={formData.materialStatus}
                                onChange={handleInputChange}
                            >
                                <option value="available">Có sẵn</option>
                                <option value="need_order">Cần đặt hàng</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>
                                <input
                                    type="checkbox"
                                    name="includeFixProduct"
                                    checked={formData.includeFixProduct}
                                    onChange={handleInputChange}
                                />
                                Thêm sửa chữa sản phẩm (3 giờ)
                            </label>
                        </div>
                    </div>
                </div>

                {/* Order Items */}
                <div className="form-section">
                    <h3>Sản Phẩm</h3>
                    {formData.orderItems.map((item, index) => (
                        <div key={index} className="order-item">
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Sản phẩm</label>
                                    <select
                                        value={item.productId}
                                        onChange={(e) => {
                                            const product = products.find(p => p.id === e.target.value);
                                            handleOrderItemChange(index, 'productId', e.target.value);
                                            if (product) {
                                                handleOrderItemChange(index, 'unitPrice', product.base_price);
                                            }
                                        }}
                                        required
                                    >
                                        <option value="">Chọn sản phẩm</option>
                                        {products.map(product => (
                                            <option key={product.id} value={product.id}>
                                                {product.name} - {product.base_price?.toLocaleString()}đ
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Số lượng</label>
                                    <input
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => handleOrderItemChange(index, 'quantity', parseInt(e.target.value))}
                                        min="1"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Đơn giá</label>
                                    <input
                                        type="number"
                                        value={item.unitPrice}
                                        onChange={(e) => handleOrderItemChange(index, 'unitPrice', parseFloat(e.target.value))}
                                        min="0"
                                        required
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
                        Thêm sản phẩm
                    </button>
                </div>

                {/* Calculated Schedule */}
                {calculatedDates && (
                    <div className="form-section schedule-preview">
                        <h3>Lịch Sản Xuất Dự Kiến</h3>
                        <div className="schedule-info">
                            <p>
                                <strong>Ngày thử phôi:</strong>{' '}
                                {format(new Date(calculatedDates.fittingDate), 'dd/MM/yyyy', { locale: vi })}
                            </p>
                            <p>
                                <strong>Ngày lấy hàng:</strong>{' '}
                                {format(new Date(calculatedDates.pickupDate), 'dd/MM/yyyy', { locale: vi })}
                            </p>
                            {calculatedDates.requiresOvertime && (
                                <p className="overtime-warning">
                                    ⚠️ Cần làm thêm giờ: {calculatedDates.overtimeHours} giờ
                                </p>
                            )}
                            <p>
                                <strong>Tổng thời gian sản xuất:</strong> {calculatedDates.productionDays} ngày
                            </p>
                            {formData.includeFixProduct && (
                                <p className="fix-product-info">
                                    ℹ️ Bao gồm 3 giờ sửa chữa sản phẩm
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Total Price */}
                <div className="form-section">
                    <h3>Tổng Cộng: {formData.totalPrice.toLocaleString()}đ</h3>
                </div>

                <div className="form-actions">
                    <button type="submit" disabled={loading} className="btn-primary">
                        {loading ? 'Đang xử lý...' : 'Tạo đơn hàng'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default NewOrder;