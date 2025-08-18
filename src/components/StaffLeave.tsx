import React, { useState } from 'react';
import { Box, Typography, Paper, Button } from '@mui/material';
import { useStaffLeave } from '../hooks/useStaffLeave';
import { formatDate } from '../utils/dateUtils';
import dayjs from 'dayjs';

const StaffLeave: React.FC = () => {
    const { leaves, loading, addLeave, deleteLeave } = useStaffLeave();
    const [newLeave, setNewLeave] = useState({
        staff_name: 'tailor' as 'tailor' | 'decorator',
        leave_date: dayjs().format('YYYY-MM-DD'),
        is_sunday: false
    });

    const handleAddLeave = async (e: React.FormEvent) => {
        e.preventDefault();

        const result = await addLeave(newLeave);

        if (result.success) {
            setNewLeave({
                staff_name: 'tailor',
                leave_date: dayjs().format('YYYY-MM-DD'),
                is_sunday: false
            });
        }
    };

    const handleDeleteLeave = async (id: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa ngày nghỉ này?')) return;
        await deleteLeave(id);
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
                Quản lý ngày nghỉ
            </Typography>

            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    Thêm ngày nghỉ mới
                </Typography>

                <form onSubmit={handleAddLeave}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'end', flexWrap: 'wrap' }}>
                        <Box>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                Nhân viên
                            </Typography>
                            <select
                                value={newLeave.staff_name}
                                onChange={(e) => setNewLeave(prev => ({ ...prev, staff_name: e.target.value as 'tailor' | 'decorator' }))}
                                style={{ padding: '8px', fontSize: '14px' }}
                            >
                                <option value="tailor">Thợ may</option>
                                <option value="decorator">Thợ thêu</option>
                            </select>
                        </Box>

                        <Box>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                Ngày nghỉ
                            </Typography>
                            <input
                                type="date"
                                value={newLeave.leave_date}
                                onChange={(e) => setNewLeave(prev => ({ ...prev, leave_date: e.target.value }))}
                                style={{ padding: '8px', fontSize: '14px' }}
                            />
                        </Box>

                        <Button
                            type="submit"
                            variant="contained"
                            disabled={loading}
                        >
                            {loading ? 'Đang thêm...' : 'Thêm'}
                        </Button>
                    </Box>
                </form>
            </Paper>

            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                    Danh sách ngày nghỉ
                </Typography>

                <Box sx={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                        <tr style={{ backgroundColor: '#f5f5f5' }}>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                                Nhân viên
                            </th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                                Ngày nghỉ
                            </th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                                Thứ
                            </th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                                Hành động
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        {leaves.map((leave) => (
                            <tr key={leave.id}>
                                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                                    {leave.staff_name === 'tailor' ? 'Thợ may' : 'Thợ thêu'}
                                </td>
                                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                                    {formatDate(leave.leave_date)}
                                </td>
                                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                                    {dayjs(leave.leave_date).format('dddd')}
                                </td>
                                <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                                    <Button
                                        size="small"
                                        color="error"
                                        onClick={() => handleDeleteLeave(leave.id)}
                                    >
                                        Xóa
                                    </Button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </Box>
            </Paper>
        </Box>
    );
};

export default StaffLeave;