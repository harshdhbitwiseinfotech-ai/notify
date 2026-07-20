import React from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts";

const PDFReportTemplate = ({ 
  totalSubscribers, 
  totalNotified, 
  reportRows, 
  performanceSummary, 
  chartData, 
  notificationLog,
  relativeTime 
}) => {
  const notificationRate = totalSubscribers > 0 
    ? ((totalNotified / totalSubscribers) * 100).toFixed(1) 
    : "0";

  return (
    <div id="pdf-report-container" style={{ display: "none", width: "800px", position: "absolute", left: "-9999px", top: 0, fontFamily: "sans-serif", color: "#202223" }}>
      
      {/* PAGE 1: Overview */}
      <div id="pdf-page-1" style={{ width: "800px", padding: "40px", backgroundColor: "#fff" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "8px" }}>Store Subscription & Notifications Performance Report</h1>
        <p style={{ color: "#6d7175", marginBottom: "24px" }}>Generated on {new Date().toLocaleDateString()} | Comprehensive view of Overview, Product Reports, and Notification Logs</p>
        <hr style={{ border: "0", borderTop: "1px solid #e1e3e5", marginBottom: "24px" }} />

        <div style={{ borderLeft: "4px solid #5700fa", paddingLeft: "12px", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: 0 }}>Executive Overview (All Time)</h2>
        </div>

        <div style={{ display: "flex", gap: "16px", marginBottom: "32px" }}>
          <StatCard label="Total Subscribers" value={totalSubscribers} trendLabel="all time" />
          <StatCard label="Notifications Sent" value={totalNotified} trendLabel="all time" />
          <StatCard label="Products Tracked" value={reportRows?.length || 0} trendLabel="with subscribers" />
          <StatCard label="Notification Rate" value={`${notificationRate}%`} trendLabel="notified / total" />
        </div>

        <div style={{ borderLeft: "4px solid #5700fa", paddingLeft: "12px", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: 0 }}>Subscription & Notification Trends (Last 30 Days)</h2>
        </div>
        <p style={{ color: "#6d7175", marginBottom: "16px", fontSize: "14px" }}>Timeline view tracking notifications and new customer subscriptions over the trailing 30-day period.</p>
        
        <div style={{ height: "300px", marginBottom: "32px", border: "1px solid #e1e3e5", borderRadius: "8px", padding: "16px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Legend />
              <Area type="monotone" dataKey="subscribers" stroke="#008060" fill="#008060" fillOpacity={0.1} strokeWidth={2} dot={false} name="Subscribers" isAnimationActive={false} />
              <Area type="monotone" dataKey="notifications" stroke="#5700fa" fill="#5700fa" fillOpacity={0.1} strokeWidth={2} dot={false} name="Notifications" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ borderLeft: "4px solid #5700fa", paddingLeft: "12px", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: 0 }}>Performance Summary Table</h2>
        </div>
        
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f4f6f8", textAlign: "left" }}>
              <th style={{ padding: "12px", borderBottom: "1px solid #e1e3e5" }}>Metric</th>
              <th style={{ padding: "12px", borderBottom: "1px solid #e1e3e5" }}>This Period</th>
              <th style={{ padding: "12px", borderBottom: "1px solid #e1e3e5" }}>Last Period</th>
              <th style={{ padding: "12px", borderBottom: "1px solid #e1e3e5" }}>Change</th>
              <th style={{ padding: "12px", borderBottom: "1px solid #e1e3e5" }}>Trend</th>
            </tr>
          </thead>
          <tbody>
            {(performanceSummary || []).map((row, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid #e1e3e5" }}>
                <td style={{ padding: "12px", fontWeight: "bold" }}>{row.metric}</td>
                <td style={{ padding: "12px" }}>{row.thisPeriod}</td>
                <td style={{ padding: "12px" }}>{row.lastPeriod}</td>
                <td style={{ padding: "12px" }}>{row.change}</td>
                <td style={{ padding: "12px" }}>
                  <span style={{ backgroundColor: row.toneUp ? "#aee9d1" : (row.customTrend && row.trendTone === "new") ? "#e3e5e7" : "#fed3d1", color: "#202223", padding: "2px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "bold" }}>
                    {row.trend}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: "center", marginTop: "40px", color: "#6d7175", fontSize: "12px" }}>Page 1 / 3</div>
      </div>

      {/* PAGE 2: Inventory */}
      <div id="pdf-page-2" style={{ width: "800px", padding: "40px", backgroundColor: "#fff" }}>
        <div style={{ borderLeft: "4px solid #5700fa", paddingLeft: "12px", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: 0 }}>Product Subscription Inventory Report</h2>
        </div>
        <p style={{ color: "#6d7175", marginBottom: "24px", fontSize: "14px" }}>Detailed view of tracked items, stock health levels, and active user demand.</p>
        
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f4f6f8", textAlign: "left" }}>
              <th style={{ padding: "12px", borderBottom: "1px solid #e1e3e5" }}>Product Name</th>
              <th style={{ padding: "12px", borderBottom: "1px solid #e1e3e5" }}>Price</th>
              <th style={{ padding: "12px", borderBottom: "1px solid #e1e3e5" }}>Stock</th>
              <th style={{ padding: "12px", borderBottom: "1px solid #e1e3e5" }}>Status</th>
              <th style={{ padding: "12px", borderBottom: "1px solid #e1e3e5" }}>Subscribers</th>
              <th style={{ padding: "12px", borderBottom: "1px solid #e1e3e5" }}>Notified</th>
              <th style={{ padding: "12px", borderBottom: "1px solid #e1e3e5" }}>Last Restocked</th>
            </tr>
          </thead>
          <tbody>
            {(reportRows || []).slice(0, 15).map((row, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid #e1e3e5" }}>
                <td style={{ padding: "12px", fontWeight: "bold" }}>{row.product}</td>
                <td style={{ padding: "12px" }}>{row.price}</td>
                <td style={{ padding: "12px", fontWeight: row.stock === 0 ? "bold" : "normal" }}>{row.stock}</td>
                <td style={{ padding: "12px" }}>
                  <span style={{ backgroundColor: row.status === "in_stock" ? "#aee9d1" : "#fed3d1", color: "#202223", padding: "2px 8px", borderRadius: "12px", fontSize: "12px" }}>
                    {row.status === "in_stock" ? "In Stock" : "Out of Stock"}
                  </span>
                </td>
                <td style={{ padding: "12px" }}>{row.subscribers}</td>
                <td style={{ padding: "12px" }}>{row.notified}</td>
                <td style={{ padding: "12px" }}>{row.lastRestocked}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(reportRows || []).length > 15 && <p style={{ fontSize: "12px", color: "#6d7175", marginTop: "8px", textAlign: "center" }}>* Showing top 15 products *</p>}
        <div style={{ textAlign: "center", marginTop: "40px", color: "#6d7175", fontSize: "12px" }}>Page 2 / 3</div>
      </div>

      {/* PAGE 3: Notifications */}
      <div id="pdf-page-3" style={{ width: "800px", padding: "40px", backgroundColor: "#fff" }}>
        <div style={{ borderLeft: "4px solid #5700fa", paddingLeft: "12px", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: 0 }}>Recent Notification Activity Log</h2>
        </div>
        <p style={{ color: "#6d7175", marginBottom: "24px", fontSize: "14px" }}>History of the last 15 customer alert notification batches sent out.</p>
        
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f4f6f8", textAlign: "left" }}>
              <th style={{ padding: "12px", borderBottom: "1px solid #e1e3e5" }}>Notification ID</th>
              <th style={{ padding: "12px", borderBottom: "1px solid #e1e3e5" }}>Product</th>
              <th style={{ padding: "12px", borderBottom: "1px solid #e1e3e5" }}>Recipients</th>
              <th style={{ padding: "12px", borderBottom: "1px solid #e1e3e5" }}>Sent</th>
              <th style={{ padding: "12px", borderBottom: "1px solid #e1e3e5" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {(notificationLog || []).slice(0, 15).map((entry, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid #e1e3e5" }}>
                <td style={{ padding: "12px", color: "#6d7175", fontWeight: "bold" }}>{entry.id}</td>
                <td style={{ padding: "12px", fontWeight: "bold" }}>{entry.product.length > 50 ? entry.product.substring(0, 50) + "…" : entry.product}</td>
                <td style={{ padding: "12px", color: "#6d7175" }}>{entry.recipients} {entry.recipients === 1 ? "customer" : "customers"}</td>
                <td style={{ padding: "12px", color: "#6d7175" }}>{relativeTime ? relativeTime(entry.sentAt) : "N/A"}</td>
                <td style={{ padding: "12px" }}>
                  <span style={{ backgroundColor: "#aee9d1", color: "#202223", padding: "2px 8px", borderRadius: "12px", fontSize: "12px" }}>
                    Delivered
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: "center", marginTop: "40px", color: "#6d7175", fontSize: "12px" }}>Page 3 / 3</div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, trendLabel }) => (
  <div style={{ flex: 1, border: "1px solid #e1e3e5", borderRadius: "8px", padding: "16px", backgroundColor: "#fff" }}>
    <div style={{ fontSize: "12px", color: "#6d7175", marginBottom: "8px" }}>{label}</div>
    <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
      <div style={{ fontSize: "28px", fontWeight: "bold", color: "#202223" }}>{value}</div>
      <div style={{ backgroundColor: "#aee9d1", color: "#008060", padding: "2px 6px", borderRadius: "12px", fontSize: "10px", fontWeight: "bold" }}>↑ 0%</div>
    </div>
    <div style={{ fontSize: "11px", color: "#6d7175", marginTop: "8px" }}>{trendLabel}</div>
  </div>
);

export default PDFReportTemplate;
