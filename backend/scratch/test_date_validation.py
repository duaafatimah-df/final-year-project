import re
from datetime import datetime
from typing import Optional

def parse_date(date_str: str) -> Optional[datetime]:
    cleaned = date_str.replace('/', '-').strip()
    
    # Try DD-MM-YYYY
    try:
        return datetime.strptime(cleaned, "%d-%m-%Y")
    except ValueError:
        pass
    
    # Try MM-YYYY
    try:
        return datetime.strptime(cleaned, "%m-%Y")
    except ValueError:
        pass
        
    # Try MM-YY
    try:
        return datetime.strptime(cleaned, "%m-%y")
    except ValueError:
        pass
        
    return None

def extract_dates(text: str):
    # Order patterns by specificity
    p1 = r'\b(?:0[1-9]|[12][0-9]|3[01])[-/](?:0[1-9]|1[0-2])[-/]\d{4}\b'
    p2 = r'\b(?:0[1-9]|[12][0-9]|3[01])[-/](?:0[1-9]|1[0-2])[-/]\d{2}\b'
    p3 = r'\b(?:0[1-9]|1[0-2])[-/]\d{4}\b'
    p4 = r'\b(?:0[1-9]|1[0-2])[-/]\d{2}\b'
    
    temp_text = text
    matches = []
    
    for pattern in [p1, p2, p3, p4]:
        for m in re.finditer(pattern, temp_text):
            date_str = m.group(0)
            parsed_dt = parse_date(date_str)
            if parsed_dt:
                start, end = m.span()
                # Mask out matched area to avoid duplicate matches
                temp_text = temp_text[:start] + (" " * (end - start)) + temp_text[end:]
                matches.append({
                    "raw": date_str,
                    "parsed": parsed_dt,
                    "start": start,
                    "end": end
                })
                
    matches.sort(key=lambda x: x["start"])
    return matches

def assign_mfg_exp(matches, text: str):
    text_lower = text.lower()
    mfg_keywords = ["mfg", "mfd", "mng", "prod", "prd", "manu", "mfg.date", "mfd.date", "manufacturing"]
    exp_keywords = ["exp", "expiry", "val", "use", "expire", "exp.date"]
    
    mfg_match = None
    exp_match = None
    
    for m in matches:
        start_idx = max(0, m["start"] - 40)
        end_idx = min(len(text_lower), m["end"] + 20)
        context = text_lower[start_idx:end_idx]
        
        is_mfg = any(kw in context for kw in mfg_keywords)
        is_exp = any(kw in context for kw in exp_keywords)
        
        if is_mfg and not is_exp:
            mfg_match = m
        elif is_exp and not is_mfg:
            exp_match = m
        elif is_mfg and is_exp:
            mfg_dists = [abs(context.find(kw) - 40) for kw in mfg_keywords if kw in context]
            exp_dists = [abs(context.find(kw) - 40) for kw in exp_keywords if kw in context]
            if min(mfg_dists) < min(exp_dists):
                mfg_match = m
            else:
                exp_match = m
                
    # Fallback: if we have 2 dates and haven't assigned both
    if len(matches) == 2 and (not mfg_match or not exp_match):
        mfg_match = matches[0]
        exp_match = matches[1]
    elif len(matches) == 1 and not exp_match:
        exp_match = matches[0]
        
    return mfg_match, exp_match

def run_test_case(mfg_input, exp_input):
    text = f"MFG. DATE: {mfg_input} EXP. DATE: {exp_input}"
    matches = extract_dates(text)
    mfg_match, exp_match = assign_mfg_exp(matches, text)
    
    # Let's override actual date to simulate the current date in June 2026 for consistent testing
    current_date = datetime(2026, 6, 8)
    
    mfg_date_str = mfg_match["raw"] if mfg_match else None
    exp_date_str = exp_match["raw"] if exp_match else None
    
    mfg_dt = mfg_match["parsed"] if mfg_match else None
    exp_dt = exp_match["parsed"] if exp_match else None
    
    is_valid = True
    msg = "Valid date ranges."
    
    if mfg_dt and mfg_dt > current_date:
        is_valid = False
        msg = "The manufacturing date is in the future, therefore the batch is unverifiable and unsafe."
    elif exp_dt and exp_dt < current_date:
        is_valid = False
        msg = "The medicine has expired and is unsafe."
    elif mfg_dt and exp_dt and exp_dt < mfg_dt:
        is_valid = False
        msg = "The expiry date is before the manufacturing date, which is invalid and unsafe."
        
    print(f"TESTING MFG: {mfg_input} | EXP: {exp_input}")
    print(f"Extracted MFG: {mfg_date_str} | EXP: {exp_date_str}")
    print(f"Parsed MFG: {mfg_dt} | EXP: {exp_dt}")
    print(f"Current Date: {current_date.strftime('%Y-%m-%d')}")
    print(f"Validation Result: {'PASS' if is_valid else 'FAIL'} - {msg}")
    print("-" * 50)
    return is_valid

# Test cases:
# 1. MFG: 09-25, EXP: 03-27
# 2. MFG: 01-24, EXP: 01-26
# 3. MFG: 12-26, EXP: 12-28
# 4. MFG: 05-25, EXP: 04-25

print("Running Medicine Date Validation tests...")
print("-" * 50)
run_test_case("09-25", "03-27")
run_test_case("01-24", "01-26")
run_test_case("12-26", "12-28")
run_test_case("05-25", "04-25")
