import os
import pptx
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

def create_deck(filename="TrueShift_Project_Presentation.pptx"):
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Color Palette - Modern Tech Dark Theme
    BG_COLOR = RGBColor(15, 23, 42)        # Slate 900
    CARD_BG = RGBColor(30, 41, 59)         # Slate 800
    CARD_BORDER = RGBColor(51, 65, 85)     # Slate 700
    PRIMARY_BLUE = RGBColor(59, 130, 246)  # Blue 500
    ACCENT_CYAN = RGBColor(14, 165, 233)   # Sky 500
    ACCENT_EMERALD = RGBColor(16, 185, 129)# Emerald 500
    ACCENT_AMBER = RGBColor(245, 158, 11)  # Amber 500
    ACCENT_PURPLE = RGBColor(139, 92, 246) # Violet 500
    TEXT_WHITE = RGBColor(248, 250, 252)   # Slate 50
    TEXT_MUTED = RGBColor(148, 163, 184)   # Slate 400
    TEXT_LIGHT = RGBColor(203, 213, 225)   # Slate 300

    FONT_FAMILY = "Segoe UI"

    def set_slide_background(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), prs.slide_width, prs.slide_height)
        bg.fill.solid()
        bg.fill.fore_color.rgb = BG_COLOR
        bg.line.fill.background()
        return bg

    def add_header(slide, tag_text, title_text, subtitle_text=""):
        # Category Tag / Badge
        tag_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.5), Inches(11.7), Inches(0.4))
        tf_tag = tag_box.text_frame
        tf_tag.word_wrap = True
        tf_tag.margin_left = tf_tag.margin_top = tf_tag.margin_right = tf_tag.margin_bottom = 0
        p_tag = tf_tag.paragraphs[0]
        p_tag.text = tag_text.upper()
        p_tag.font.name = FONT_FAMILY
        p_tag.font.size = Pt(11)
        p_tag.font.bold = True
        p_tag.font.color.rgb = ACCENT_CYAN

        # Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.85), Inches(11.7), Inches(0.65))
        tf_title = title_box.text_frame
        tf_title.word_wrap = True
        tf_title.margin_left = tf_title.margin_top = tf_title.margin_right = tf_title.margin_bottom = 0
        p_title = tf_title.paragraphs[0]
        p_title.text = title_text
        p_title.font.name = FONT_FAMILY
        p_title.font.size = Pt(24)
        p_title.font.bold = True
        p_title.font.color.rgb = TEXT_WHITE

        if subtitle_text:
            sub_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.5), Inches(11.7), Inches(0.4))
            tf_sub = sub_box.text_frame
            tf_sub.word_wrap = True
            tf_sub.margin_left = tf_sub.margin_top = tf_sub.margin_right = tf_sub.margin_bottom = 0
            p_sub = tf_sub.paragraphs[0]
            p_sub.text = subtitle_text
            p_sub.font.name = FONT_FAMILY
            p_sub.font.size = Pt(13)
            p_sub.font.color.rgb = TEXT_MUTED

    def add_card(slide, left, top, width, height, border_color=CARD_BORDER):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = border_color
        card.line.width = Pt(1.2)
        return card

    # ==========================================================
    # SLIDE 1: Title Slide
    # ==========================================================
    s1 = prs.slides.add_slide(blank_layout)
    set_slide_background(s1)

    # Accent decorative glow bar
    bar = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.8), Inches(0.15), Inches(2.2))
    bar.fill.solid()
    bar.fill.fore_color.rgb = PRIMARY_BLUE
    bar.line.fill.background()

    # Title box
    tbox = s1.shapes.add_textbox(Inches(1.2), Inches(1.6), Inches(11.0), Inches(2.6))
    tf = tbox.text_frame
    tf.word_wrap = True

    p0 = tf.paragraphs[0]
    p0.text = "MAJOR PROJECT PRESENTATION"
    p0.font.name = FONT_FAMILY
    p0.font.size = Pt(12)
    p0.font.bold = True
    p0.font.color.rgb = ACCENT_CYAN
    p0.space_after = Pt(10)

    p1 = tf.add_paragraph()
    p1.text = "TrueShift: AI Workforce Intelligence Platform"
    p1.font.name = FONT_FAMILY
    p1.font.size = Pt(36)
    p1.font.bold = True
    p1.font.color.rgb = TEXT_WHITE
    p1.space_after = Pt(8)

    p2 = tf.add_paragraph()
    p2.text = "Face-Verified Biometric Attendance, Shift Governance & Predictive Absenteeism Analytics"
    p2.font.name = FONT_FAMILY
    p2.font.size = Pt(16)
    p2.font.color.rgb = TEXT_LIGHT

    # Metadata Cards (2 columns at bottom)
    # Project & Institution Card
    add_card(s1, Inches(0.8), Inches(4.5), Inches(5.6), Inches(2.2))
    c1_box = s1.shapes.add_textbox(Inches(1.1), Inches(4.7), Inches(5.0), Inches(1.8))
    tf_c1 = c1_box.text_frame
    tf_c1.word_wrap = True

    p_inst_lbl = tf_c1.paragraphs[0]
    p_inst_lbl.text = "INSTITUTION & DEPARTMENT"
    p_inst_lbl.font.name = FONT_FAMILY
    p_inst_lbl.font.size = Pt(10)
    p_inst_lbl.font.bold = True
    p_inst_lbl.font.color.rgb = ACCENT_CYAN
    p_inst_lbl.space_after = Pt(4)

    p_inst = tf_c1.add_paragraph()
    p_inst.text = "PCTE Group of Institutes"
    p_inst.font.name = FONT_FAMILY
    p_inst.font.size = Pt(16)
    p_inst.font.bold = True
    p_inst.font.color.rgb = TEXT_WHITE

    p_dept = tf_c1.add_paragraph()
    p_dept.text = "Department of Computer Science & Engineering\nFinal Year Capstone Project"
    p_dept.font.name = FONT_FAMILY
    p_dept.font.size = Pt(12)
    p_dept.font.color.rgb = TEXT_LIGHT

    # Team Members Card
    add_card(s1, Inches(6.8), Inches(4.5), Inches(5.7), Inches(2.2))
    c2_box = s1.shapes.add_textbox(Inches(7.1), Inches(4.7), Inches(5.1), Inches(1.8))
    tf_c2 = c2_box.text_frame
    tf_c2.word_wrap = True

    p_team_lbl = tf_c2.paragraphs[0]
    p_team_lbl.text = "PROJECT TEAM"
    p_team_lbl.font.name = FONT_FAMILY
    p_team_lbl.font.size = Pt(10)
    p_team_lbl.font.bold = True
    p_team_lbl.font.color.rgb = ACCENT_CYAN
    p_team_lbl.space_after = Pt(4)

    members = [
        ("Ankush Patial", "Roll No. 2329286"),
        ("Gaurav Chugh", "Roll No. 2445918"),
        ("Rajat Thukral", "Roll No. 2446001")
    ]
    for name, rno in members:
        p_m = tf_c2.add_paragraph()
        p_m.text = f"{name}  —  {rno}"
        p_m.font.name = FONT_FAMILY
        p_m.font.size = Pt(12)
        p_m.font.bold = True
        p_m.font.color.rgb = TEXT_WHITE

    # ==========================================================
    # SLIDE 2: Project Idea
    # ==========================================================
    s2 = prs.slides.add_slide(blank_layout)
    set_slide_background(s2)
    add_header(s2, "Section 01 // Vision & Overview", "Project Idea: Next-Gen Workforce Intelligence", 
               "Transforming passive punch-clocks into an active, intelligent, and proactive workforce governance ecosystem.")

    # 4 Architectural Pillars (2x2 Grid)
    pillars = [
        {
            "num": "01",
            "title": "Zero-Trust Biometric Authentication",
            "accent": PRIMARY_BLUE,
            "desc": "Browser-native face check-in leveraging multi-angle registration, 512D ArcFace embeddings, and MediaPipe optical liveness detection to eliminate proxy clock-ins with sub-second response times."
        },
        {
            "num": "02",
            "title": "Autonomous Policy & Shift Engine",
            "accent": ACCENT_CYAN,
            "desc": "Intelligent shift window enforcement (±10m grace period), duplicate check-in locking (HTTP 409 guard), automated leave accrual, and multi-tier role-based approval workflows."
        },
        {
            "num": "03",
            "title": "Predictive Behavioral Analytics",
            "accent": ACCENT_EMERALD,
            "desc": "Dual-model absenteeism risk prediction (Logistic Regression vs. Random Forest) and unsupervised Isolation Forest anomaly detection that alerts HR to burnout patterns before disruption occurs."
        },
        {
            "num": "04",
            "title": "Enterprise Cloud Architecture",
            "accent": ACCENT_PURPLE,
            "desc": "Production-grade decoupled stack pairing an asynchronous FastAPI backend and MySQL relational database with Qdrant vector database and an interactive Bento UI."
        }
    ]

    card_coords_2x2 = [
        (Inches(0.8), Inches(2.1), Inches(5.65), Inches(2.25)),
        (Inches(6.85), Inches(2.1), Inches(5.65), Inches(2.25)),
        (Inches(0.8), Inches(4.65), Inches(5.65), Inches(2.25)),
        (Inches(6.85), Inches(4.65), Inches(5.65), Inches(2.25)),
    ]

    for (left, top, w, h), p_data in zip(card_coords_2x2, pillars):
        add_card(s2, left, top, w, h)
        
        # Pill indicator
        ind = s2.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top + Inches(0.2), Inches(0.08), Inches(0.4))
        ind.fill.solid()
        ind.fill.fore_color.rgb = p_data["accent"]
        ind.line.fill.background()

        tb = s2.shapes.add_textbox(left + Inches(0.3), top + Inches(0.2), w - Inches(0.5), h - Inches(0.3))
        tframe = tb.text_frame
        tframe.word_wrap = True

        p_h = tframe.paragraphs[0]
        p_h.text = f"{p_data['num']}  {p_data['title']}"
        p_h.font.name = FONT_FAMILY
        p_h.font.size = Pt(14)
        p_h.font.bold = True
        p_h.font.color.rgb = TEXT_WHITE
        p_h.space_after = Pt(8)

        p_b = tframe.add_paragraph()
        p_b.text = p_data["desc"]
        p_b.font.name = FONT_FAMILY
        p_b.font.size = Pt(11.5)
        p_b.font.color.rgb = TEXT_LIGHT

    # ==========================================================
    # SLIDE 3: Problem Statement
    # ==========================================================
    s3 = prs.slides.add_slide(blank_layout)
    set_slide_background(s3)
    add_header(s3, "Section 02 // Operational Challenges", "Problem Statement: Flaws in Legacy Workforce Systems",
               "Traditional attendance and HR workflows suffer from security vulnerabilities, manual bottlenecks, and reactive reporting.")

    # 3 Column Cards
    problems = [
        {
            "tag": "SECURITY VULNERABILITY",
            "stat": "16%",
            "stat_lbl": "Payroll Leakage via Time Theft",
            "title": "Proxy Check-In & Buddy Punching",
            "accent": RGBColor(239, 68, 68), # Red
            "points": [
                "RFID cards, QR codes, and PINs are easily shared, stolen, or forged.",
                "Static biometrics are vulnerable to photo replay and 2D digital screen spoofing.",
                "Organizations lose millions annually compensating unverified or absent staff."
            ]
        },
        {
            "tag": "ADMINISTRATIVE FRICTION",
            "stat": "40%+",
            "stat_lbl": "HR Overhead Wasted on Manual Tasks",
            "title": "Fragmented & Chaotic Management",
            "accent": ACCENT_AMBER,
            "points": [
                "Disjointed spreadsheets lead to inaccurate leave balance reconciliations.",
                "Rigid punch-clocks cannot handle shift grace periods, overtime, or remote workers.",
                "HR teams spend hours per week resolving routine attendance conflicts and email approvals."
            ]
        },
        {
            "tag": "ANALYTICS DEFICIT",
            "stat": "0%",
            "stat_lbl": "Predictive Intelligence in Legacy Tools",
            "title": "Purely Reactive Attendance Records",
            "accent": ACCENT_CYAN,
            "points": [
                "Legacy software only logs past timestamps; it offers zero predictive capability.",
                "Management cannot detect emerging absenteeism trends or burnout patterns.",
                "Attendance anomalies (e.g. erratic shifts, abrupt check-out spikes) go unnoticed until attrition."
            ]
        }
    ]

    col_w = Inches(3.68)
    gap = Inches(0.38)
    start_x = Inches(0.8)
    top_y = Inches(2.1)
    card_h = Inches(4.8)

    for i, p_data in enumerate(problems):
        left_x = start_x + i * (col_w + gap)
        add_card(s3, left_x, top_y, col_w, card_h)

        tb = s3.shapes.add_textbox(left_x + Inches(0.25), top_y + Inches(0.25), col_w - Inches(0.5), card_h - Inches(0.5))
        tf_prob = tb.text_frame
        tf_prob.word_wrap = True

        # Tag
        ptag = tf_prob.paragraphs[0]
        ptag.text = p_data["tag"]
        ptag.font.name = FONT_FAMILY
        ptag.font.size = Pt(9.5)
        ptag.font.bold = True
        ptag.font.color.rgb = p_data["accent"]
        ptag.space_after = Pt(6)

        # Stat
        pstat = tf_prob.add_paragraph()
        pstat.text = p_data["stat"]
        pstat.font.name = FONT_FAMILY
        pstat.font.size = Pt(32)
        pstat.font.bold = True
        pstat.font.color.rgb = TEXT_WHITE
        pstat.space_after = Pt(0)

        # Stat Label
        pstat_lbl = tf_prob.add_paragraph()
        pstat_lbl.text = p_data["stat_lbl"]
        pstat_lbl.font.name = FONT_FAMILY
        pstat_lbl.font.size = Pt(11)
        pstat_lbl.font.bold = True
        pstat_lbl.font.color.rgb = p_data["accent"]
        pstat_lbl.space_after = Pt(10)

        # Title
        ptitle = tf_prob.add_paragraph()
        ptitle.text = p_data["title"]
        ptitle.font.name = FONT_FAMILY
        ptitle.font.size = Pt(13)
        ptitle.font.bold = True
        ptitle.font.color.rgb = TEXT_WHITE
        ptitle.space_after = Pt(10)

        # Points
        for pt in p_data["points"]:
            ppt = tf_prob.add_paragraph()
            ppt.text = f"•  {pt}"
            ppt.font.name = FONT_FAMILY
            ppt.font.size = Pt(10.5)
            ppt.font.color.rgb = TEXT_LIGHT
            ppt.space_after = Pt(6)

    # ==========================================================
    # SLIDE 4: Proposed Solution
    # ==========================================================
    s4 = prs.slides.add_slide(blank_layout)
    set_slide_background(s4)
    add_header(s4, "Section 03 // Technical Architecture", "Proposed Solution: TrueShift's Multi-Tier Architecture",
               "An integrated pipeline combining deep face recognition, anti-spoof liveness, shift rules, and predictive machine learning.")

    # Left: End-to-End Attendance Pipeline (Card)
    add_card(s4, Inches(0.8), Inches(2.1), Inches(5.65), Inches(4.8))
    tb_pipe = s4.shapes.add_textbox(Inches(1.1), Inches(2.3), Inches(5.1), Inches(4.4))
    tf_pipe = tb_pipe.text_frame
    tf_pipe.word_wrap = True

    p_p_title = tf_pipe.paragraphs[0]
    p_p_title.text = "ATTENDANCE VERIFICATION PIPELINE"
    p_p_title.font.name = FONT_FAMILY
    p_p_title.font.size = Pt(11)
    p_p_title.font.bold = True
    p_p_title.font.color.rgb = ACCENT_CYAN
    p_p_title.space_after = Pt(8)

    pipeline_steps = [
        ("Step 1: Frame Capture & Quality Assessment", "Captures camera frames in browser; checks illumination, blur, and minimum face size using OpenCV."),
        ("Step 2: 512D ArcFace Embedding Generation", "Extracts deep biometric vector representations via InsightFace (buffalo_l model pack)."),
        ("Step 3: Qdrant Vector Similarity Search", "Executes high-speed cosine vector search against registered employee biometric profiles (<800ms)."),
        ("Step 4: Active Optical Liveness (Anti-Spoof)", "Evaluates eye blinks and micro-movements with MediaPipe FaceMesh to prevent screen/photo spoofing."),
        ("Step 5: Shift Rule Engine & Duplicate Lock", "Validates shift window (±10m grace), blocks duplicate daily clock-ins (HTTP 409), and logs to MySQL.")
    ]

    for title, desc in pipeline_steps:
        p_st = tf_pipe.add_paragraph()
        p_st.text = title
        p_st.font.name = FONT_FAMILY
        p_st.font.size = Pt(11)
        p_st.font.bold = True
        p_st.font.color.rgb = TEXT_WHITE
        p_st.space_after = Pt(2)

        p_sd = tf_pipe.add_paragraph()
        p_sd.text = desc
        p_sd.font.name = FONT_FAMILY
        p_sd.font.size = Pt(9.5)
        p_sd.font.color.rgb = TEXT_LIGHT
        p_sd.space_after = Pt(8)

    # Right: Core System Capabilities (3 Cards Stacked)
    right_cards = [
        {
            "tag": "BIOMETRIC ENGINE",
            "title": "ArcFace + Qdrant Cloud Vector Store",
            "desc": "Separates biometric vector indexing from relational operational data, guaranteeing sub-second matching at scale with zero mockups.",
            "accent": PRIMARY_BLUE
        },
        {
            "tag": "GOVERNANCE & WORKFLOW",
            "title": "Automated Shift & Leave Rule Engine",
            "desc": "Dynamic accrual tracking, 4-tier RBAC (Admin/HR/Manager/Employee), grace period compliance, and PDF/Excel/CSV automated reporting.",
            "accent": ACCENT_CYAN
        },
        {
            "tag": "PREDICTIVE ML",
            "title": "Supervised & Unsupervised ML Engines",
            "desc": "Logistic Regression vs. Random Forest for absenteeism forecasting and Isolation Forest for real-time anomaly detection with plain-text insights.",
            "accent": ACCENT_EMERALD
        }
    ]

    r_top = Inches(2.1)
    r_h = Inches(1.45)
    r_gap = Inches(0.22)
    for i, rc in enumerate(right_cards):
        cy = r_top + i * (r_h + r_gap)
        add_card(s4, Inches(6.85), cy, Inches(5.65), r_h)

        tb_rc = s4.shapes.add_textbox(Inches(7.1), cy + Inches(0.15), Inches(5.15), r_h - Inches(0.3))
        tf_rc = tb_rc.text_frame
        tf_rc.word_wrap = True

        pt = tf_rc.paragraphs[0]
        pt.text = rc["tag"]
        pt.font.name = FONT_FAMILY
        pt.font.size = Pt(9)
        pt.font.bold = True
        pt.font.color.rgb = rc["accent"]
        pt.space_after = Pt(2)

        ph = tf_rc.add_paragraph()
        ph.text = rc["title"]
        ph.font.name = FONT_FAMILY
        ph.font.size = Pt(12)
        ph.font.bold = True
        ph.font.color.rgb = TEXT_WHITE
        ph.space_after = Pt(3)

        pd = tf_rc.add_paragraph()
        pd.text = rc["desc"]
        pd.font.name = FONT_FAMILY
        pd.font.size = Pt(10)
        pd.font.color.rgb = TEXT_LIGHT

    # ==========================================================
    # SLIDE 5: Interdisciplinary Contribution
    # ==========================================================
    s5 = prs.slides.add_slide(blank_layout)
    set_slide_background(s5)
    add_header(s5, "Section 04 // Interdisciplinary Fusion", "Interdisciplinary Contribution: Cross-Domain Integration",
               "TrueShift bridges four foundational domains to deliver an intelligent, secure, and human-centric enterprise solution.")

    domains = [
        {
            "field": "COMPUTER VISION & BIOMETRICS",
            "sub": "Artificial Intelligence & Perception",
            "color": PRIMARY_BLUE,
            "points": [
                "Haar Cascade & OpenCV frame quality inspection (brightness, blur, resolution).",
                "Deep metric learning via ArcFace generating 512D facial identity vectors.",
                "Real-time MediaPipe optical liveness (eye-aspect ratio blink & head movement tracking)."
            ]
        },
        {
            "field": "DATA SCIENCE & PREDICTIVE ML",
            "sub": "Applied Statistics & Machine Learning",
            "color": ACCENT_CYAN,
            "points": [
                "Supervised Absenteeism Risk Modeling: Logistic Regression vs Random Forest on chronological splits.",
                "Unsupervised Anomaly Detection: Isolation Forest identifying abnormal shift durations & check-in patterns.",
                "Honesty-by-design methodology: Rejects synthetic data; requires statistical sample validity."
            ]
        },
        {
            "field": "SOFTWARE & DATABASE SYSTEMS",
            "sub": "Enterprise Distributed Engineering",
            "color": ACCENT_EMERALD,
            "points": [
                "Modern decoupled async architecture (FastAPI Python 3.11 + REST endpoints).",
                "Hybrid Database Architecture: Relational ACID storage (MySQL) + Vector DB (Qdrant).",
                "Robust security: Cryptographic JWT authentication, role guards (RBAC), and audit trails."
            ]
        },
        {
            "field": "HR MANAGEMENT & ORGANIZATIONAL PSYCHOLOGY",
            "sub": "Human Factors & Workplace Governance",
            "color": ACCENT_PURPLE,
            "points": [
                "Mitigating workplace burnout through proactive absenteeism risk identification.",
                "Ethical, transparent governance: Privacy-first biometric vectorization (no raw image storage).",
                "Frictionless operational workflows: Dynamic grace periods, multi-tier leaves, and WFH support."
            ]
        }
    ]

    for (left, top, w, h), d_data in zip(card_coords_2x2, domains):
        add_card(s5, left, top, w, h)

        # Left color strip
        strip = s5.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top + Inches(0.2), Inches(0.08), Inches(0.45))
        strip.fill.solid()
        strip.fill.fore_color.rgb = d_data["color"]
        strip.line.fill.background()

        tb = s5.shapes.add_textbox(left + Inches(0.25), top + Inches(0.18), w - Inches(0.45), h - Inches(0.3))
        tf_d = tb.text_frame
        tf_d.word_wrap = True

        p_f = tf_d.paragraphs[0]
        p_f.text = d_data["field"]
        p_f.font.name = FONT_FAMILY
        p_f.font.size = Pt(11)
        p_f.font.bold = True
        p_f.font.color.rgb = d_data["color"]
        p_f.space_after = Pt(2)

        p_s = tf_d.add_paragraph()
        p_s.text = d_data["sub"]
        p_s.font.name = FONT_FAMILY
        p_s.font.size = Pt(9.5)
        p_s.font.bold = True
        p_s.font.color.rgb = TEXT_MUTED
        p_s.space_after = Pt(6)

        for pt in d_data["points"]:
            ppt = tf_d.add_paragraph()
            ppt.text = f"•  {pt}"
            ppt.font.name = FONT_FAMILY
            ppt.font.size = Pt(10.5)
            ppt.font.color.rgb = TEXT_LIGHT
            ppt.space_after = Pt(4)

    # ==========================================================
    # SLIDE 6: Expected Outcomes
    # ==========================================================
    s6 = prs.slides.add_slide(blank_layout)
    set_slide_background(s6)
    add_header(s6, "Section 05 // Business Impact & Metrics", "Expected Outcomes: Measurable Value & Performance",
               "Tangible improvements across operational efficiency, security integrity, and predictive workforce analytics.")

    # 4 Stat Callout Cards on Top
    stat_cards = [
        ("100%", "Proxy Check-In Elimination", "Biometric face verification + optical liveness eliminates buddy punching.", ACCENT_EMERALD),
        ("70%+", "HR Overhead Reduction", "Automated shift boundary evaluation, leave approvals, and instant compliance exports.", PRIMARY_BLUE),
        ("< 0.8s", "Authentication Latency", "Sub-second vector indexing via Qdrant Cloud enables rapid peak check-in throughput.", ACCENT_CYAN),
        ("0%", "Fabricated AI Metrics", "ML models enforce sample validity, refusing to fabricate inaccurate predictions.", ACCENT_PURPLE)
    ]

    stat_w = Inches(2.72)
    stat_gap = Inches(0.27)
    stat_x = Inches(0.8)
    stat_y = Inches(2.1)
    stat_h = Inches(1.85)

    for i, (val, label, subtext, color) in enumerate(stat_cards):
        cx = stat_x + i * (stat_w + stat_gap)
        add_card(s6, cx, stat_y, stat_w, stat_h)

        tb = s6.shapes.add_textbox(cx + Inches(0.15), stat_y + Inches(0.15), stat_w - Inches(0.3), stat_h - Inches(0.3))
        tf_stat = tb.text_frame
        tf_stat.word_wrap = True

        pval = tf_stat.paragraphs[0]
        pval.text = val
        pval.font.name = FONT_FAMILY
        pval.font.size = Pt(28)
        pval.font.bold = True
        pval.font.color.rgb = color
        pval.space_after = Pt(2)

        plbl = tf_stat.add_paragraph()
        plbl.text = label
        plbl.font.name = FONT_FAMILY
        plbl.font.size = Pt(10.5)
        plbl.font.bold = True
        plbl.font.color.rgb = TEXT_WHITE
        plbl.space_after = Pt(4)

        psub = tf_stat.add_paragraph()
        psub.text = subtext
        psub.font.name = FONT_FAMILY
        psub.font.size = Pt(9)
        psub.font.color.rgb = TEXT_LIGHT

    # Bottom 2 Comparison Cards (Qualitative & Quantitative Outcomes)
    b_y = Inches(4.2)
    b_w = Inches(5.65)
    b_h = Inches(2.7)

    # Bottom Left: Operational & Compliance Outcomes
    add_card(s6, Inches(0.8), b_y, b_w, b_h)
    tb_b1 = s6.shapes.add_textbox(Inches(1.1), b_y + Inches(0.2), b_w - Inches(0.6), b_h - Inches(0.4))
    tf_b1 = tb_b1.text_frame
    tf_b1.word_wrap = True

    p_b1_title = tf_b1.paragraphs[0]
    p_b1_title.text = "OPERATIONAL & REGULATORY COMPLIANCE"
    p_b1_title.font.name = FONT_FAMILY
    p_b1_title.font.size = Pt(11)
    p_b1_title.font.bold = True
    p_b1_title.font.color.rgb = ACCENT_CYAN
    p_b1_title.space_after = Pt(6)

    b1_bullets = [
        "Audit-Proof Digital Trails: Instant PDF, Excel, and CSV multi-format reports matching live database state.",
        "Equitable Policy Enforcement: Grace periods and late arrival thresholds enforced objectively across all staff.",
        "Privacy-Preserving Architecture: Raw facial imagery discarded after vectorization, ensuring data compliance."
    ]
    for b in b1_bullets:
        pb = tf_b1.add_paragraph()
        pb.text = f"•  {b}"
        pb.font.name = FONT_FAMILY
        pb.font.size = Pt(10.5)
        pb.font.color.rgb = TEXT_LIGHT
        pb.space_after = Pt(5)

    # Bottom Right: Strategic & Proactive Management
    add_card(s6, Inches(6.85), b_y, b_w, b_h)
    tb_b2 = s6.shapes.add_textbox(Inches(7.15), b_y + Inches(0.2), b_w - Inches(0.6), b_h - Inches(0.4))
    tf_b2 = tb_b2.text_frame
    tf_b2.word_wrap = True

    p_b2_title = tf_b2.paragraphs[0]
    p_b2_title.text = "PROACTIVE WORKFORCE RETENTION & ML VALUE"
    p_b2_title.font.name = FONT_FAMILY
    p_b2_title.font.size = Pt(11)
    p_b2_title.font.bold = True
    p_b2_title.font.color.rgb = ACCENT_EMERALD
    p_b2_title.space_after = Pt(6)

    b2_bullets = [
        "Early Absenteeism Warning: Managers receive proactive risk flags (LOW/MED/HIGH) to address employee fatigue early.",
        "Actionable Anomaly Summaries: Plain-language summaries explain unusual punch times and excessive overtime.",
        "Real-Time Analytics Dashboards: High-visibility visual trends on attendance, department averages, and leaves."
    ]
    for b in b2_bullets:
        pb = tf_b2.add_paragraph()
        pb.text = f"•  {b}"
        pb.font.name = FONT_FAMILY
        pb.font.size = Pt(10.5)
        pb.font.color.rgb = TEXT_LIGHT
        pb.space_after = Pt(5)

    # ==========================================================
    # SLIDE 7: Summary & Conclusion
    # ==========================================================
    s7 = prs.slides.add_slide(blank_layout)
    set_slide_background(s7)
    add_header(s7, "Section 06 // Conclusion & Roadmap", "System Deliverables & Future Scope",
               "A fully functional production-ready build covering complete attendance, leave, and predictive analytics.")

    # Left Card: Current Milestones Completed
    add_card(s7, Inches(0.8), Inches(2.1), Inches(5.65), Inches(4.8))
    tb_m = s7.shapes.add_textbox(Inches(1.1), Inches(2.3), Inches(5.05), Inches(4.4))
    tf_m = tb_m.text_frame
    tf_m.word_wrap = True

    pm_title = tf_m.paragraphs[0]
    pm_title.text = "PHASES 1–7: DELIVERED CAPABILITIES"
    pm_title.font.name = FONT_FAMILY
    pm_title.font.size = Pt(11)
    pm_title.font.bold = True
    pm_title.font.color.rgb = ACCENT_EMERALD
    pm_title.space_after = Pt(8)

    delivered_items = [
        ("Authentication & 4-Tier RBAC", "JWT token authentication with Admin, HR, Manager, and Employee permissions."),
        ("Multi-Angle Biometric Face ID", "Webcam face capture (front, left, right) stored in Qdrant vector space."),
        ("Active Anti-Spoof Liveness", "MediaPipe FaceMesh blink & micro-motion detection preventing fraud."),
        ("Attendance & Dynamic Shifts", "Strict shift window gating, grace period rules, and single-check-in lock."),
        ("Leave & Holiday Workflows", "Application, multi-tier approvals, dynamic balance deductions, and WFH support."),
        ("Dual ML Predictive Engines", "Absenteeism risk modeling (LR vs RF) + Isolation Forest anomaly detection.")
    ]

    for title, desc in delivered_items:
        pt = tf_m.add_paragraph()
        pt.text = f"✓  {title}"
        pt.font.name = FONT_FAMILY
        pt.font.size = Pt(10.5)
        pt.font.bold = True
        pt.font.color.rgb = TEXT_WHITE
        pt.space_after = Pt(1)

        pd = tf_m.add_paragraph()
        pd.text = f"     {desc}"
        pd.font.name = FONT_FAMILY
        pd.font.size = Pt(9.5)
        pd.font.color.rgb = TEXT_LIGHT
        pd.space_after = Pt(5)

    # Right Card: Future Scope & Evaluation Note
    add_card(s7, Inches(6.85), Inches(2.1), Inches(5.65), Inches(3.2))
    tb_f = s7.shapes.add_textbox(Inches(7.15), Inches(2.3), Inches(5.05), Inches(2.8))
    tf_f = tb_f.text_frame
    tf_f.word_wrap = True

    pf_title = tf_f.paragraphs[0]
    pf_title.text = "FUTURE ROADMAP & EXTENSIONS"
    pf_title.font.name = FONT_FAMILY
    pf_title.font.size = Pt(11)
    pf_title.font.bold = True
    pf_title.font.color.rgb = ACCENT_CYAN
    pf_title.space_after = Pt(8)

    future_items = [
        ("RAG-Powered HR Policy Assistant", "LangChain + isolated Qdrant vector store for natural language employee queries."),
        ("Edge-AI Mobile Native Applications", "Native iOS & Android apps with offline caching and biometric hardware integration."),
        ("Automated Payroll & ERP Integration", "Direct webhooks into ERPNext, SAP, and automated salary slip generation.")
    ]

    for title, desc in future_items:
        pt = tf_f.add_paragraph()
        pt.text = f"→  {title}"
        pt.font.name = FONT_FAMILY
        pt.font.size = Pt(10.5)
        pt.font.bold = True
        pt.font.color.rgb = TEXT_WHITE
        pt.space_after = Pt(1)

        pd = tf_f.add_paragraph()
        pd.text = f"     {desc}"
        pd.font.name = FONT_FAMILY
        pd.font.size = Pt(9.5)
        pd.font.color.rgb = TEXT_LIGHT
        pd.space_after = Pt(5)

    # Bottom Right Card: Closing / Thank You
    add_card(s7, Inches(6.85), Inches(5.5), Inches(5.65), Inches(1.4), border_color=PRIMARY_BLUE)
    tb_th = s7.shapes.add_textbox(Inches(7.15), Inches(5.65), Inches(5.05), Inches(1.1))
    tf_th = tb_th.text_frame
    tf_th.word_wrap = True

    p_th1 = tf_th.paragraphs[0]
    p_th1.text = "THANK YOU"
    p_th1.font.name = FONT_FAMILY
    p_th1.font.size = Pt(16)
    p_th1.font.bold = True
    p_th1.font.color.rgb = ACCENT_CYAN
    p_th1.space_after = Pt(2)

    p_th2 = tf_th.add_paragraph()
    p_th2.text = "Questions, Feedback & Project Evaluation"
    p_th2.font.name = FONT_FAMILY
    p_th2.font.size = Pt(12)
    p_th2.font.color.rgb = TEXT_WHITE

    prs.save(filename)
    print(f"Presentation saved successfully to {filename}")

if __name__ == "__main__":
    create_deck()
