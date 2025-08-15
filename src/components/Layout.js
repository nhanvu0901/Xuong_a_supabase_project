import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Layout = ({ children }) => {
    const location = useLocation();

    const navigation = [
        { path: '/orders', name: 'Bảng tổng hợp đơn hàng', icon: '📋' },
        { path: '/production', name: 'Bảng theo dõi tiến độ', icon: '⚙️' },
        { path: '/new-order', name: 'Đặt hàng mới', icon: '➕' },
        { path: '/employees', name: 'Lịch nhân viên', icon: '👥' }
    ];

    return (
        <div className="layout">
            <aside className="sidebar">
                <h2>Quản lý xưởng may</h2>
                <nav>
                    <ul className="nav-menu">
                        {navigation.map((item) => (
                            <li key={item.path}>
                                <Link
                                    to={item.path}
                                    className={location.pathname === item.path ? 'active' : ''}
                                >
                                    <span>{item.icon}</span> {item.name}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
            </aside>
            <main className="main-content">
                {children}
            </main>
        </div>
    );
};

export default Layout;