import React, { useState } from 'react';
import {
    ThemeProvider,
    createTheme,
    CssBaseline,
    Box,
    AppBar,
    Toolbar,
    Typography,
    Tab,
    Tabs
} from '@mui/material';
import { SnackbarProvider } from 'notistack';
import Dashboard from './components/Dashboard';
import NewOrderForm from './components/NewOrderForm';
import StaffLeave from './components/StaffLeave';

// Theme
const theme = createTheme({
    palette: {
        primary: {
            main: '#1976d2',
        },
        secondary: {
            main: '#dc004e',
        },
    },
});

// Main App Component
const App = () => {
    const [currentTab, setCurrentTab] = useState(0);

    const tabs = [
        { label: 'Tổng quan', component: <Dashboard /> },
        { label: 'Đơn hàng mới', component: <NewOrderForm /> },
        { label: 'Quản lý nghỉ phép', component: <StaffLeave /> },
    ];

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <SnackbarProvider maxSnack={3}>
                <Box sx={{ flexGrow: 1 }}>
                    <AppBar position="static">
                        <Toolbar>
                            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                                Quản lý xưởng áo dài
                            </Typography>
                        </Toolbar>
                    </AppBar>

                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)}>
                            {tabs.map((tab, index) => (
                                <Tab key={index} label={tab.label} />
                            ))}
                        </Tabs>
                    </Box>

                    <Box>
                        {tabs[currentTab].component}
                    </Box>
                </Box>
            </SnackbarProvider>
        </ThemeProvider>
    );
};

export default App;