import React, { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import {
    FiUsers,
    FiFileText,
    FiCheckCircle,
    FiClock,
    FiTrendingUp,
    FiActivity,
    FiBarChart2
} from 'react-icons/fi';
import './Dashboard.css';

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const response = await dashboardAPI.getStats();
            setStats(response.data.data);
        } catch (err) {
            console.error('Error fetching stats:', err);
            setError('Failed to load statistics');
        } finally {
            setLoading(false);
        }
    };

    const formatNumber = (num) => {
        return num?.toLocaleString() || 0;
    };

    const calculatePercentage = (value, total) => {
        if (!total || total === 0) return 0;
        return Math.round((value / total) * 100);
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="spinner"></div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    return (
        <div className="dashboard">
            {/* Main Stats Overview */}
            {stats && (
                <>
                    {/* Top KPI Cards */}
                    <div className="kpi-grid">
                        <div className="kpi-card primary">
                            <div className="kpi-header">
                                <FiFileText className="kpi-icon" />
                                <span className="kpi-label">Total Enquiries</span>
                            </div>
                            <div className="kpi-value">{formatNumber(stats.totalEnquiries)}</div>
                            <div className="kpi-trend positive">
                                <FiTrendingUp />
                                <span>Website projects</span>
                            </div>
                        </div>

                        <div className="kpi-card success">
                            <div className="kpi-header">
                                <FiCheckCircle className="kpi-icon" />
                                <span className="kpi-label">Completed Projects</span>
                            </div>
                            <div className="kpi-value">{formatNumber(stats.completedEnquiries)}</div>
                            <div className="kpi-trend positive">
                                <FiTrendingUp />
                                <span>Success rate: {calculatePercentage(stats.completedEnquiries, stats.totalEnquiries)}%</span>
                            </div>
                        </div>

                        <div className="kpi-card info">
                            <div className="kpi-header">
                                <FiUsers className="kpi-icon" />
                                <span className="kpi-label">Active Users</span>
                            </div>
                            <div className="kpi-value">{formatNumber(stats.totalContacts)}</div>
                            <div className="kpi-trend positive">
                                <FiTrendingUp />
                                <span>Unique clients</span>
                            </div>
                        </div>
                    </div>

                    {/* Enquiry Status Breakdown */}
                    <div className="analytics-section">
                        <div className="section-header">
                            <FiBarChart2 />
                            <h2>Enquiry Status Overview</h2>
                        </div>

                        <div className="status-analytics">
                            <div className="status-card">
                                <div className="status-info">
                                    <div className="status-header">
                                        <FiClock className="status-icon pending" />
                                        <div>
                                            <h3>New Enquiries</h3>
                                            <p>Awaiting review</p>
                                        </div>
                                    </div>
                                    <div className="status-value">{formatNumber(stats.pendingEnquiries)}</div>
                                </div>
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill pending"
                                        style={{ width: `${calculatePercentage(stats.pendingEnquiries, stats.totalEnquiries)}%` }}
                                    >
                                        <span className="progress-label">
                                            {calculatePercentage(stats.pendingEnquiries, stats.totalEnquiries)}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="status-card">
                                <div className="status-info">
                                    <div className="status-header">
                                        <FiActivity className="status-icon progress" />
                                        <div>
                                            <h3>In Progress</h3>
                                            <p>In discussion</p>
                                        </div>
                                    </div>
                                    <div className="status-value">{formatNumber(stats.progressEnquiries)}</div>
                                </div>
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill progress"
                                        style={{ width: `${calculatePercentage(stats.progressEnquiries, stats.totalEnquiries)}%` }}
                                    >
                                        <span className="progress-label">
                                            {calculatePercentage(stats.progressEnquiries, stats.totalEnquiries)}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="status-card">
                                <div className="status-info">
                                    <div className="status-header">
                                        <FiCheckCircle className="status-icon approved" />
                                        <div>
                                            <h3>Completed</h3>
                                            <p>Consultation finished</p>
                                        </div>
                                    </div>
                                    <div className="status-value">{formatNumber(stats.completedEnquiries)}</div>
                                </div>
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill approved"
                                        style={{ width: `${calculatePercentage(stats.completedEnquiries, stats.totalEnquiries)}%` }}
                                    >
                                        <span className="progress-label">
                                            {calculatePercentage(stats.completedEnquiries, stats.totalEnquiries)}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="status-card">
                                <div className="status-info">
                                    <div className="status-header">
                                        <FiUsers className="status-icon disbursed" />
                                        <div>
                                            <h3>Callbacks</h3>
                                            <p>Action required</p>
                                        </div>
                                    </div>
                                    <div className="status-value">{formatNumber(stats.callbackRequests)}</div>
                                </div>
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill disbursed"
                                        style={{ width: `${calculatePercentage(stats.callbackRequests, stats.totalEnquiries)}%` }}
                                    >
                                        <span className="progress-label">
                                            {calculatePercentage(stats.callbackRequests, stats.totalEnquiries)}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {error && (
                <div className="error-message">
                    <p>{error}</p>
                </div>
            )}
        </div>
    );
};

export default Dashboard;