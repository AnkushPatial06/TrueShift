"""
Generates downloadable reports from real database records. Supports CSV,
Excel (.xlsx), and PDF, per the spec's Reports feature.
"""
import csv
import io
from datetime import date, timedelta

from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.time_utils import local_today

from app.repositories.attendance_repository import AttendanceRepository
from app.repositories.leave_repository import LeaveRepository
from app.repositories.user_repository import UserRepository


class ReportService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.users = UserRepository(session)
        self.attendance = AttendanceRepository(session)
        self.leaves = LeaveRepository(session)

    async def _attendance_rows(self, days: int) -> list[dict]:
        today = local_today()
        start = today - timedelta(days=days)
        records = await self.attendance.list_all_between(start, today)
        rows = []
        for r in records:
            user = await self.users.find_by_id(r.employee_id)
            rows.append({
                "Employee": user.name if user else str(r.employee_id),
                "Employee ID": user.employee_id if user else "",
                "Date": r.date.isoformat(),
                "Check In": r.check_in.strftime("%H:%M") if r.check_in else "",
                "Check Out": r.check_out.strftime("%H:%M") if r.check_out else "",
                "Working Hours": r.working_hours or "",
                "Status": r.status,
                "Late (min)": r.late_minutes,
                "Overtime (min)": r.overtime_minutes,
            })
        return rows

    async def _leave_rows(self) -> list[dict]:
        leaves = await self.leaves.list_all_for_scope(None)
        rows = []
        for l in leaves:
            user = await self.users.find_by_id(l.employee_id)
            rows.append({
                "Employee": user.name if user else str(l.employee_id),
                "Leave Type": l.leave_type,
                "Start Date": l.start_date.isoformat(),
                "End Date": l.end_date.isoformat(),
                "Days": l.days_requested,
                "Status": l.status,
                "Reason": l.reason,
            })
        return rows

    async def generate(self, report_type: str, file_format: str, days: int = 30) -> tuple[bytes, str, str]:
        if report_type == "attendance":
            rows = await self._attendance_rows(days)
            filename_base = "attendance_report"
        elif report_type == "leave":
            rows = await self._leave_rows()
            filename_base = "leave_report"
        else:
            raise ValueError("Unsupported report_type")

        if not rows:
            rows = [{"Message": "No data available for this report yet."}]

        if file_format == "csv":
            return self._to_csv(rows), f"{filename_base}.csv", "text/csv"
        if file_format == "excel":
            return self._to_excel(rows), f"{filename_base}.xlsx", \
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if file_format == "pdf":
            return self._to_pdf(rows, filename_base), f"{filename_base}.pdf", "application/pdf"
        raise ValueError("Unsupported file_format")

    def _to_csv(self, rows: list[dict]) -> bytes:
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
        return buffer.getvalue().encode("utf-8")

    def _to_excel(self, rows: list[dict]) -> bytes:
        wb = Workbook()
        ws = wb.active
        ws.title = "Report"
        headers = list(rows[0].keys())
        ws.append(headers)
        for row in rows:
            ws.append([row.get(h, "") for h in headers])
        buffer = io.BytesIO()
        wb.save(buffer)
        return buffer.getvalue()

    def _to_pdf(self, rows: list[dict], title: str) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        elements = [Paragraph(title.replace("_", " ").title(), styles["Title"]), Spacer(1, 12)]

        headers = list(rows[0].keys())
        table_data = [headers] + [[str(row.get(h, "")) for h in headers] for row in rows]
        table = Table(table_data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B1830")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F4EF")]),
        ]))
        elements.append(table)
        doc.build(elements)
        return buffer.getvalue()
