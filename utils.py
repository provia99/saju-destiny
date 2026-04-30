from fastapi.templating import Jinja2Templates

templates = Jinja2Templates(directory=["templates"])
templates.env.auto_reload = True

def format_phone(phone):
    if not phone: return ""
    p = "".join(filter(str.isdigit, str(phone)))
    if len(p) == 11: return f"{p[:3]}-{p[3:7]}-{p[7:]}"
    if len(p) == 10:
        if p.startswith("02"): return f"{p[:2]}-{p[2:6]}-{p[6:]}"
        return f"{p[:3]}-{p[3:6]}-{p[6:]}"
    if len(p) == 9 and p.startswith("02"):
        return f"{p[:2]}-{p[2:5]}-{p[5:]}"
    return phone

templates.env.filters["phone"] = format_phone
