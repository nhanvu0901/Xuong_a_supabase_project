import React, { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    TextField,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    DialogContentText
} from '@mui/material';
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

    // Confirmation dialog state
    const [confirmDialog, setConfirmDialog] = useState({
        open: false,
        leaveId: '',
        staffName: '',
        leaveDate: ''
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
        await deleteLeave(id);
        setConfirmDialog({ open: false, leaveId: '', staffName: '', leaveDate: '' });
    };

    const openConfirmDialog = (id: string, staffName: string, leaveDate: string) => {
        setConfirmDialog({
            open: true,
            leaveId: id,
            staffName: staffName === 'tailor' ? 'Thợ may' : 'Thợ thêu',
            leaveDate: formatDate(leaveDate)
        });
    };

    const closeConfirmDialog = () => {
        setConfirmDialog({ open: false, leaveId: '', staffName: '', leaveDate: '' });
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                Quản lý ngày nghỉ phép
            </Typography>

            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    Thêm ngày nghỉ phép
                </Typography>

                <form onSubmit={handleAddLeave}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                        <TextField
                            select
                            label="Nhân viên"
                            value={newLeave.staff_name}
                            onChange={(e) => setNewLeave({
                                ...newLeave,
                                staff_name: e.target.value as 'tailor' | 'decorator'
                            })}
                            sx={{ minWidth: 150 }}
                        >
                            <MenuItem value="tailor">Thợ may</MenuItem>
                            <MenuItem value="decorator">Thợ thêu</MenuItem>
                        </TextField>

                        <TextField
                            type="date"
                            label="Ngày nghỉ"
                            value={newLeave.leave_date}
                            onChange={(e) => setNewLeave({
                                ...newLeave,
                                leave_date: e.target.value
                            })}
                            InputLabelProps={{ shrink: true }}
                        />

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
                                        onClick={() => openConfirmDialog(
                                            leave.id,
                                            leave.staff_name,
                                            leave.leave_date
                                        )}
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

            {/* Confirmation Dialog */}
            <Dialog
                open={confirmDialog.open}
                onClose={closeConfirmDialog}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Xác nhận xóa</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Bạn có chắc chắn muốn xóa ngày nghỉ phép của{' '}
                        <strong>{confirmDialog.staffName}</strong> vào ngày{' '}
                        <strong>{confirmDialog.leaveDate}</strong>?
                        <br /><br />
                        Hành động này có thể ảnh hưởng đến lịch trình của các đơn hàng đã được lên kế hoạch.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeConfirmDialog} color="primary">
                        Hủy
                    </Button>
                    <Button
                        onClick={() => handleDeleteLeave(confirmDialog.leaveId)}
                        color="error"
                        variant="contained"
                        disabled={loading}
                    >
                        {loading ? 'Đang xóa...' : 'Xóa'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default StaffLeave;