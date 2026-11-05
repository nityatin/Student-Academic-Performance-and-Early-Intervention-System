# Generates ER_diagram.(png|pdf|svg) from the table definitions below. Needs graphviz: dot
import subprocess
T = {
 "department": [("dept_id","PK"),("dept_name","UK")],
 "faculty": [("faculty_id","PK"),("name",""),("email","UK"),("dept_id","FK")],
 "student": [("srn","PK"),("name",""),("email","UK"),("dept_id","FK"),("semester",""),("section",""),("mentor_id","FK")],
 "course": [("course_code","PK"),("title",""),("credits",""),("dept_id","FK")],
 "course_prerequisite": [("course_code","PK, FK"),("prereq_code","PK, FK")],
 "course_offering": [("offering_id","PK"),("course_code","FK"),("faculty_id","FK"),("academic_term","")],
 "enrollment": [("enrollment_id","PK"),("srn","FK"),("offering_id","FK")],
 "assessment": [("assessment_id","PK"),("offering_id","FK"),("name",""),("max_marks",""),("weightage","")],
 "score": [("enrollment_id","PK, FK"),("assessment_id","PK, FK"),("marks_obtained","")],
 "attendance": [("enrollment_id","PK, FK"),("class_date","PK"),("status","")],
 "risk_assessment": [("srn","PK, FK"),("attendance_pct",""),("avg_score_pct",""),("risk_level",""),("computed_at","")],
 "intervention": [("intervention_id","PK"),("srn","FK"),("faculty_id","FK"),("risk_level",""),("action_type",""),("status",""),("opened_on",""),("closed_on","")],
 "app_user": [("user_id","PK"),("email","UK"),("password_hash",""),("full_name",""),("role",""),("faculty_id","FK, UK"),("srn","FK, UK")],
 "audit_log": [("log_id","PK"),("table_name",""),("record_id",""),("action",""),("detail",""),("logged_at","")],
}
COL = {"PK":"#FDECC8","FK":"#DCE8FA","UK":"#E8E8E8"}
def node(name, attrs):
    rows = ""
    for a,k in attrs:
        bg = COL.get(k.split(",")[0].strip(), "white")
        rows += f'<TR><TD ALIGN="LEFT" BGCOLOR="{bg}">{a}</TD><TD ALIGN="LEFT" BGCOLOR="{bg}">{('<FONT POINT-SIZE="9" COLOR="#555555">'+k+'</FONT>') if k else ' '}</TD></TR>'
    return (f'"{name}" [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" COLOR="#14213D">'
            f'<TR><TD COLSPAN="2" BGCOLOR="#14213D"><FONT COLOR="white"><B>{name}</B></FONT></TD></TR>{rows}</TABLE>>];')
# (one-side, many-side, label, many-optional)
E = [
 ("department","faculty","employs",0), ("department","student","admits",0), ("department","course","owns",0),
 ("faculty","student","mentors",1), ("course","course_offering","is offered as",0), ("faculty","course_offering","teaches",0),
 ("student","enrollment","enrolls",0), ("course_offering","enrollment","has",0),
 ("course_offering","assessment","defines",0), ("enrollment","score","earns",0), ("assessment","score","graded in",0),
 ("enrollment","attendance","records",0), ("student","risk_assessment","has (1:1)",0),
 ("student","intervention","needs",0), ("faculty","intervention","handles",1),
 ("faculty","app_user","login for (1:0..1)",1), ("student","app_user","login for (1:0..1)",1),
]
dot = ['digraph ER {','graph [rankdir=TB, splines=true, nodesep=0.55, ranksep=0.9, fontname="Helvetica", pad=0.3, bgcolor=white];',
       'node [shape=plain, fontname="Helvetica", fontsize=11];','edge [fontname="Helvetica", fontsize=9, color="#5B677D", fontcolor="#14213D", dir=both, arrowtail=tee, labeldistance=1.2];']
for n,a in T.items(): dot.append(node(n,a))
for one,many,lab,opt in E:
    head = "crowodot" if opt else "crow"
    if lab.startswith("has (1:1)"): head = "teetee"
    if lab.startswith("login for"): head = "teeodot"
    dot.append(f'"{one}" -> "{many}" [label="{lab}", arrowhead={head}];')
# self-referencing many-to-many of course via course_prerequisite
dot.append('"course" -> "course_prerequisite" [label="is the course", arrowhead=crow];')
dot.append('"course" -> "course_prerequisite" [label="is the prerequisite", arrowhead=crow, style=dashed];')
dot.append('"audit_log" [peripheries=1];')
dot.append('{rank=same; "department"; "course"}')
dot.append('}')
open("er.dot","w").write("\n".join(dot))
for fmt in ("png","pdf","svg"):
    extra = ["-Gdpi=170"] if fmt=="png" else []
    subprocess.run(["dot",f"-T{fmt}","er.dot","-o",f"ER_diagram.{fmt}"]+extra, check=True)
print("ok")
