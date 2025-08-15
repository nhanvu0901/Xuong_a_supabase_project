import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import OrderSummary from './components/OrderSummary';
import ProductionSchedule from './components/ProductionSchedule';
import NewOrder from './components/NewOrder';
import EmployeeSchedule from './components/EmployeeSchedule';
import './App.css';

function App() {
    return (
        <Router>
            <div className="App">
                <Layout>
                    <Routes>
                        <Route path="/" element={<Navigate to="/orders" replace />} />
                        <Route path="/orders" element={<OrderSummary />} />
                        <Route path="/production" element={<ProductionSchedule />} />
                        <Route path="/new-order" element={<NewOrder />} />
                        <Route path="/employees" element={<EmployeeSchedule />} />
                    </Routes>
                </Layout>
            </div>
        </Router>
    );
}

export default App;