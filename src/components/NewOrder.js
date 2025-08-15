import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { addDays, isSunday, format } from 'date-fns';
import { vi } from 'date-fns/locale';

const NewOrder = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [calculatedDates, setCalculatedDates] = useState(null);

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
        specifiedPickupDate: '',
        materialStatus: 'available',
        totalPrice: 0,

        // Order items
        orderItems: [{ productId: '', quantity: 1, unitPrice: 0 }]
    });

    useEffect(() => {
        fetchProducts();
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

    const calculateWorkingDays = (startDate, days) => {
        let currentDate = new Date(startDate);
        let workingDaysAdded = 0;

        while (workingDaysAdded < days) {
            currentDate = addDays(currentDate, 1);

            // Skip Sundays (assuming Sunday is day off)
            if (!isSunday(currentDate)) {
                workingDaysAdded++;
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
            let startDate = today;

            // If material needs to be ordered, add 5 days
            if (formData.materialStatus === 'need_order') {
                startDate = calculateWorkingDays(today, 5);
            }

            // Calculate based on current workload
            const sewingDays = 1; // 1 day for sewing 50%
            const fittingDays = 0.5; // Half day for fitting
            const finishingDays = 0.5; // Half day for finishing

            // Check if product needs decoration
            const selectedProduct = products.find(p => p.id === formData.orderItems[0].productId);
            const needsDecoration = selectedProduct?.type === 'shirt'; // Assuming shirts need decoration

            let productionDays = sewingDays;
            if (needsDecoration) {
                productionDays += 1; // 1 day for decoration
            }

            // Calculate fitting date (after sewing 50%)
            const fittingDate = calculateWorkingDays(startDate, sewingDays);

            // Calculate pickup date
            let pickupDate;
            if (formData.priority === 'urgent' && formData.specifiedPickupDate) {
                pickupDate = new Date(formData.specifiedPickupDate);
            } else {
                pickupDate = calculateWorkingDays(fittingDate, finishingDays + (needsDecoration ? 1 : 0));
            }

            setCalculatedDates({
                fittingDate,
                pickupDate,
                requiresOvertime: formData.priority === 'urgent',
                productionDays
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

            // Create order
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    customer_id: customer.id,
                    priority: formData.priority,
                    specified_pickup_date: formData.specifiedPickupDate || null,
                    material_status: formData.materialStatus,
                    total_price: formData.totalPrice,
                    status: 'pending'
                })
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
                const { error: scheduleError } = await supabase
                    .from('production_schedule')
                    .insert({
                        order_id: order.id,
                        order_item_id: item.id,
                        scheduled_fitting_date: calculatedDates?.fittingDate,
                        scheduled_pickup_date: calculatedDates?.pickupDate,
                        status: formData.materialStatus === 'need_order' ? 'waiting_material' : 'sewing',
                        requires_overtime: calculatedDates?.requiresOvertime || false
                    });

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
                    <h3>Thông tin khách hàng</h3>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Tên khách hàng *</label>
                            <input
                                type="text"
                                name="customerName"
                                value={formData.customerName}
                                onChange={handleInputChange}
                                className="form-input"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Ngày sinh</label>
                            <input
                                type="date"
                                name="birthDate"
                                value={formData.birthDate}
                                onChange={handleInputChange}
                                className="form-input"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Số điện thoại</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                className="form-input"
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Cơ quan</label>
                            <input
                                type="text"
                                name="organization"
                                value={formData.organization}
                                onChange={handleInputChange}
                                className="form-input"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Người giới thiệu</label>
                            <input
                                type="text"
                                name="referrer"
                                value={formData.referrer}
                                onChange={handleInputChange}
                                className="form-input"
                            />
                        </div>
                    </div>

                    {/* Order Information */}
                    <h3>Thông tin đơn hàng</h3>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Mức độ ưu tiên</label>
                            <select
                                name="priority"
                                value={formData.priority}
                                onChange={handleInputChange}
                                className="form-select"
                            >
                                <option value="normal">Hàng thường</option>
                                <option value="urgent">Hàng gấp</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Tình trạng vải</label>
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
                        {formData.priority === 'urgent' && (
                            <div className="form-group">
                                <label className="form-label">Ngày chỉ định lấy hàng</label>
                                <input
                                    type="date"
                                    name="specifiedPickupDate"
                                    value={formData.specifiedPickupDate}
                                    onChange={handleInputChange}
                                    className="form-input"
                                />
                            </div>
                        )}
                    </div>

                    {/* Order Items */}
                    <h3>Sản phẩm</h3>
                    {formData.orderItems.map((item, index) => (
                        <div key={index} className="form-row" style={{ alignItems: 'end' }}>
                            <div className="form-group">
                                <label className="form-label">Sản phẩm</label>
                                <select
                                    value={item.productId}
                                    onChange={(e) => handleOrderItemChange(index, 'productId', e.target.value)}
                                    className="form-select"
                                    required
                                >
                                    <option value="">Chọn sản phẩm</option>
                                    {products.map(product => (
                                        <option key={product.id} value={product.id}>
                                            {product.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Số lượng</label>
                                <input
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) => handleOrderItemChange(index, 'quantity', parseInt(e.target.value))}
                                    className="form-input"
                                    min="1"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Đơn giá</label>
                                <input
                                    type="number"
                                    value={item.unitPrice}
                                    onChange={(e) => handleOrderItemChange(index, 'unitPrice', parseFloat(e.target.value))}
                                    className="form-input"
                                    min="0"
                                    step="1000"
                                />
                            </div>
                            <div className="form-group">
                                {formData.orderItems.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeOrderItem(index)}
                                        className="btn btn-danger"
                                    >
                                        Xóa
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    <div style={{ marginBottom: '20px' }}>
                        <button type="button" onClick={addOrderItem} className="btn btn-primary">
                            Thêm sản phẩm
                        </button>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Tổng tiền: {formatCurrency(formData.totalPrice)}</label>
                    </div>

                    {/* Calculated Schedule */}
                    {calculatedDates && (
                        <div className="card" style={{ backgroundColor: '#f8f9fa', margin: '20px 0' }}>
                            <div className="card-header">
                                Lịch sản xuất dự kiến
                            </div>
                            <div className="card-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Ngày hẹn thử phôi</label>
                                        <input
                                            type="text"
                                            value={formatDate(calculatedDates.fittingDate)}
                                            className="form-input"
                                            readOnly
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Ngày hẹn lấy hàng</label>
                                        <input
                                            type="text"
                                            value={formatDate(calculatedDates.pickupDate)}
                                            className="form-input"
                                            readOnly
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Thông tin thêm</label>
                                        <div>
                                            {calculatedDates.requiresOvertime && (
                                                <span className="status-badge status-warning">Cần làm thêm giờ</span>
                                            )}
                                            {formData.materialStatus === 'need_order' && (
                                                <span className="status-badge status-urgent">Chờ đặt vải (5 ngày)</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ textAlign: 'center', marginTop: '30px' }}>
                        <button
                            type="submit"
                            className="btn btn-success"
                            disabled={loading || !formData.customerName || formData.orderItems[0].productId === ''}
                            style={{ minWidth: '200px' }}
                        >
                            {loading ? 'Đang tạo...' : 'Tạo đơn hàng'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewOrder;