
import { useEffect, useState } from "react";
import "./App.css";

function App() {
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    async function fetchComplaints() {
        try {
            const response = await fetch(
                "http://localhost:5000/api/complaints"
            );

            if (!response.ok) {
                throw new Error("Unable to fetch complaints");
            }

            const data = await response.json();
            setComplaints(data.complaints || []);
            setError("");
        } catch (err) {
            setError("Backend connect nahi ho raha. Check karo ki API server running hai.");
        } finally {
            setLoading(false);
        }
    }


    async function updateStatus(id, status) {
        try {
            const response = await fetch(
                `http://localhost:5000/api/complaints/${id}/status`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ status })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Status update failed");
            }

            await fetchComplaints();
            alert("Complaint status updated successfully!");
        } catch (err) {
            alert(err.message || "Unable to update complaint status");
        }
    }


    useEffect(() => {
        fetchComplaints();
    }, []);



    const total = complaints.length;
    const submitted = complaints.filter(
        (item) => item.status === "SUBMITTED"
    ).length;
    const inProgress = complaints.filter(
        (item) => item.status === "IN_PROGRESS"
    ).length;
    const resolved = complaints.filter(
        (item) => item.status === "RESOLVED"
    ).length;

    return (
        <div className="app">
            <aside className="sidebar">
                <div className="brand">
                    <div className="brand-icon">N</div>
                    <div>
                        <h2>NagarMitra</h2>
                        <p>Civic Management</p>
                    </div>
                </div>

                <p className="menu-heading">MAIN MENU</p>
                <div className="menu-item active">▦ Dashboard</div>
                <div className="menu-item">▤ All Complaints</div>
                <div className="menu-item">⌖ Location Reports</div>

                <div className="sidebar-bottom">
                    <div className="staff-avatar">M</div>
                    <div>
                        <strong>Municipal Staff</strong>
                        <p>Administration</p>
                    </div>
                </div>
            </aside>

            <main className="main-content">
                <header className="topbar">
                    <div>
                        <p className="breadcrumb">Workspace / Overview</p>
                        <h1>Municipal Dashboard</h1>
                    </div>
                    <div className="live-label">
                        <span></span> LIVE DATA
                    </div>
                </header>

                <section className="welcome">
                    <div>
                        <p className="eyebrow">CIVIC ISSUE MANAGEMENT</p>
                        <h2>Good work starts with listening.</h2>
                        <p>
                            Monitor citizen complaints and track resolution
                            progress from one place.
                        </p>
                    </div>
                    <div className="welcome-symbol">⌖</div>
                </section>

                {error && (
                    <div className="error-message">
                        {error}
                        <button onClick={fetchComplaints}>Retry</button>
                    </div>
                )}

                <section className="stats-grid">
                    <div className="stat-card">
                        <p>Total Complaints</p>
                        <h2>{loading ? "..." : total}</h2>
                        <span>All recorded reports</span>
                    </div>

                    <div className="stat-card">
                        <p>Awaiting Action</p>
                        <h2>{loading ? "..." : submitted}</h2>
                        <span>Newly submitted</span>
                    </div>

                    <div className="stat-card">
                        <p>In Progress</p>
                        <h2>{loading ? "..." : inProgress}</h2>
                        <span>Being worked on</span>
                    </div>

                    <div className="stat-card">
                        <p>Resolved</p>
                        <h2>{loading ? "..." : resolved}</h2>
                        <span>Successfully completed</span>
                    </div>
                </section>

                <section className="complaints-section">
                    <div className="section-header">
                        <div>
                            <h2>Recent Complaints</h2>
                            <p>Reports received from citizens</p>
                        </div>
                        <button
                            className="refresh-button"
                            onClick={() => {
                                setLoading(true);
                                fetchComplaints();
                            }}
                        >
                            ↻ Refresh
                        </button>
                    </div>

                    {loading ? (
                        <p className="message">Loading complaints...</p>
                    ) : complaints.length === 0 ? (
                        <p className="message">
                            No complaints found. Submitted reports will appear here.
                        </p>
                    ) : (
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>COMPLAINT ID</th>
                                        <th>CATEGORY</th>
                                        <th>DESCRIPTION</th>
                                        <th>STATUS</th>
                                        <th>DATE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {complaints.map((item) => (
                                        <tr key={item.id}>
                                            <td className="complaint-id">
                                                {item.complaint_code}
                                            </td>
                                            <td>{item.category}</td>
                                            <td className="description">
                                                {item.description}
                                            </td>

                                            <td>
                                                <select
                                                    className="status-select"
                                                    value={item.status}
                                                    onChange={(e) =>
                                                        updateStatus(item.id, e.target.value)
                                                    }
                                                >
                                                    <option value="SUBMITTED">SUBMITTED</option>
                                                    <option value="IN_PROGRESS">IN PROGRESS</option>
                                                    <option value="RESOLVED">RESOLVED</option>
                                                </select>
                                            </td>

                                            <td>
                                                {new Date(
                                                    item.created_at
                                                ).toLocaleDateString("en-IN")}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <footer>
                    NagarMitra · Making civic services more responsive.
                </footer>
            </main>
        </div>
    );
}

export default App;
