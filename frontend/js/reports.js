document.addEventListener("DOMContentLoaded", () => {
  requireAuth();
  
  const user = TokenStore.getUser();
  if (user) {
    Sidebar.init('reports');
    setAvatarElement('topbar-avatar', user);
    NotificationCenter.init('notif-bell-btn');
    
    // Show org section if admin or hr
    const role = user.role || (user.roles && user.roles[0]);
    if (['admin', 'hr'].includes(role)) {
      document.getElementById('org-reports-section').classList.remove('hidden');
    }
  }

  // Pre-fill dates for org report (last 30 days)
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  document.getElementById("report-end").value = end.toISOString().split('T')[0];
  document.getElementById("report-start").value = start.toISOString().split('T')[0];

  document.getElementById("report-form").addEventListener("submit", downloadOrgReport);
  document.getElementById("dl-my-attendance-btn").addEventListener("click", downloadMyAttendancePDF);
  document.getElementById("dl-my-leave-btn").addEventListener("click", downloadMyLeavePDF);
});

async function downloadOrgReport(e) {
  e.preventDefault();

  const reportType = document.querySelector('input[name="report-type"]:checked').value;
  const fileFormat = document.getElementById("file-format").value;
  const startDate = document.getElementById("report-start").value;
  const endDate = document.getElementById("report-end").value;

  const btn = document.getElementById("download-btn");
  btn.disabled = true;
  btn.textContent = "Preparing…";

  try {
    const token = TokenStore.getAccess();
    // Assuming backend takes start_date and end_date now
    const res = await fetch(
      `${API_BASE_URL}/reports/export?report_type=${reportType}&file_format=${fileFormat}&start_date=${startDate}&end_date=${endDate}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error((data && data.message) || `Export failed (${res.status})`);
    }
    const blob = await res.blob();
    const extension = { csv: "csv", excel: "xlsx", pdf: "pdf" }[fileFormat];
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `org_${reportType}_report_${startDate}_to_${endDate}.${extension}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    Toast.show("Report downloaded successfully.", "success");
  } catch (err) {
    Toast.show(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Download Org Report";
  }
}

async function downloadMyAttendancePDF() {
  const btn = document.getElementById("dl-my-attendance-btn");
  btn.disabled = true;
  
  try {
    const user = TokenStore.getUser();
    const records = await apiRequest('/attendance/history?limit=365');
    
    if (!records || records.length === 0) {
      Toast.show("No attendance records found.", "warning");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Personal Attendance Report', 14, 22);
    doc.setFontSize(11);
    doc.text(`Employee: ${user.name}`, 14, 32);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 40);
    
    doc.autoTable({
      startY: 50,
      head: [['Date', 'Status', 'Check In', 'Check Out', 'Hours', 'Late (min)']],
      body: records.map(r => [
        r.date, 
        r.status, 
        r.check_in ? formatTime(r.check_in) : '—',
        r.check_out ? formatTime(r.check_out) : '—',
        r.working_hours ? r.working_hours.toFixed(1) + 'h' : '—',
        r.late_minutes || 0
      ]),
      theme: 'grid',
      headStyles: { fillColor: [43, 73, 204] } // match primary color
    });
    
    doc.save(`attendance-${user.name.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0,10)}.pdf`);
    Toast.show('Attendance PDF downloaded!', 'success');
  } catch (err) {
    Toast.show(err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

async function downloadMyLeavePDF() {
  const btn = document.getElementById("dl-my-leave-btn");
  btn.disabled = true;
  
  try {
    const user = TokenStore.getUser();
    // Assuming endpoint exists for leave history
    const records = await apiRequest('/leaves/mine');
    
    if (!records || records.length === 0) {
      Toast.show("No leave records found.", "warning");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Personal Leave History', 14, 22);
    doc.setFontSize(11);
    doc.text(`Employee: ${user.name}`, 14, 32);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 40);
    
    doc.autoTable({
      startY: 50,
      head: [['Type', 'Start Date', 'End Date', 'Days', 'Status']],
      body: records.map(r => [
        (r.leave_type || '').replace('_', ' '),
        r.start_date,
        r.end_date,
        r.days,
        r.status
      ]),
      theme: 'grid',
      headStyles: { fillColor: [43, 73, 204] }
    });
    
    doc.save(`leave-history-${user.name.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0,10)}.pdf`);
    Toast.show('Leave history PDF downloaded!', 'success');
  } catch (err) {
    Toast.show(err.message, "error");
  } finally {
    btn.disabled = false;
  }
}
