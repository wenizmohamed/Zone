"""Offline HAR evidence inventory. Never writes captured bodies or credential values.

Based on the app-teardown capture_har.py inventory approach, extended to retain
PHP action selectors, deduplicate body coverage, and inspect WebSocket metadata.
"""
from __future__ import annotations

import base64
import collections
import csv
import datetime as dt
import hashlib
import json
import math
import pathlib
import re
import sys
import urllib.parse as url

SOURCE = pathlib.Path(sys.argv[1]).resolve()
OUT = pathlib.Path(__file__).resolve().parent
FIRST = "www.torn.com"
SELECTORS = {"sid", "step", "action", "mode", "method"}
SECRET_NAME = re.compile(r"cookie|authorization|token|api.?key|csrf|rfcv|session|password|secret", re.I)
COOKIE_FIELD_VALUES = set()


def clean_name(value):
    value = str(value)
    if any(v in value for v in COOKIE_FIELD_VALUES):
        return "{redacted-key}"
    if len(value) > 100 or "@" in value or re.fullmatch(r"[0-9a-fA-F-]{20,}", value):
        return "{redacted-key}"
    if value.isdigit():
        return "{numeric-key}"
    if not re.fullmatch(r"[A-Za-z_$][A-Za-z0-9_$.\[\]-]{0,99}", value):
        return "{dynamic-key}"
    return value


def safe_path(raw):
    if raw.startswith("/cdn-cgi/challenge-platform/"):
        return "/cdn-cgi/challenge-platform/{redacted}"
    parts = []
    for part in raw.split("/"):
        if re.fullmatch(r"[A-Za-z0-9_-]{32,}", part) or ":" in part or "@" in part:
            part = "{redacted}"
        elif part.isdigit() and len(part) >= 6:
            part = "{id}"
        parts.append(part)
    return "/".join(parts)


def route(raw):
    u = url.urlsplit(raw)
    # All non-routing values are omitted, including numeric object/user IDs.
    selectors = sorted((k, v) for k, v in url.parse_qsl(u.query)
                       if u.hostname == FIRST and k in SELECTORS
                       and re.fullmatch(r"[A-Za-z][A-Za-z0-9_/-]{0,60}", v))
    return (u.hostname or "") + safe_path(u.path or "/") + (
        "?" + "&".join(k + "=" + v for k, v in selectors) if selectors else "")


def headers(obj):
    return {h["name"].lower(): h.get("value", "") for h in obj.get("headers", [])}


def body_text(e):
    c = e["response"].get("content", {})
    text = c.get("text", "")
    if not text:
        return ""
    if c.get("encoding") == "base64":
        return base64.b64decode(text).decode("utf-8", "replace")
    return text


def json_body(e):
    try:
        return True, json.loads(body_text(e))
    except (ValueError, TypeError):
        return False, None


def post_body(e):
    p = e["request"].get("postData", {})
    # Some exports also put an entire JSON body in params[0].name.
    # Prefer parsing the actual body before the form-parameter representation.
    if p.get("text"):
        try:
            return json.loads(p["text"])
        except ValueError:
            pass
    if p.get("params"):
        return {x["name"]: x.get("value", "") for x in p["params"]}
    if p.get("text"):
        try:
            return json.loads(p["text"])
        except ValueError:
            if "urlencoded" in p.get("mimeType", ""):
                return dict(url.parse_qsl(p["text"], keep_blank_values=True))
    return {}


def field_types(obj, prefix="", depth=0):
    """Types and field names only, with bounded nesting and dynamic-key masking."""
    result = {}
    if depth > 2:
        return result
    if isinstance(obj, dict):
        for key, val in list(obj.items())[:100]:
            name = (prefix + "." if prefix else "") + clean_name(key)
            result[name] = type(val).__name__
            if not SECRET_NAME.search(str(key)):
                result.update(field_types(val, name, depth + 1))
    elif isinstance(obj, list) and obj:
        result.update(field_types(obj[0], prefix + "[]", depth + 1))
    return result


def describe(values):
    values = sorted(v for v in values if isinstance(v, (int, float)) and v >= 0)
    if not values:
        return {}
    return {"n": len(values), "min_ms": round(values[0], 2),
            "median_ms": round((values[(len(values)-1)//2] + values[len(values)//2])/2, 2),
            "p95_ms": round(values[math.ceil(.95 * len(values))-1], 2),
            "max_ms": round(values[-1], 2)}


def category(e):
    c = e["response"].get("content", {})
    mime = c.get("mimeType", "").split(";")[0]
    r = e.get("_resourceType", "")
    if r == "document": return "documents"
    if r in {"script", "stylesheet", "image", "font", "wasm"}: return r
    if "javascript" in mime: return "script"
    if mime == "text/css": return "stylesheet"
    if mime.startswith("image/"): return "image"
    if mime.startswith("font/"): return "font"
    if url.urlsplit(e["request"]["url"]).path.endswith((".glb", ".hdr")): return "3d_assets"
    if r in {"xhr", "fetch"}: return "api_or_fetch"
    return r or "other"


def write_csv(name, rows):
    if not rows:
        return
    with (OUT / name).open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


raw = SOURCE.read_bytes()
log = json.loads(raw)["log"]
entries = log["entries"]
for entry in entries:
    for header in entry["request"].get("headers", []):
        if header["name"].lower() == "cookie":
            for part in header.get("value", "").split(";"):
                if "=" in part:
                    cookie_value = part.strip().split("=", 1)[1]
                    if len(cookie_value) >= 12:
                        COOKIE_FIELD_VALUES.add(cookie_value)
source_hash = hashlib.sha256(raw).hexdigest()
del raw
reqs = []
groups = collections.defaultdict(list)
endpoints = {}
errors = collections.defaultdict(list)
doc_groups = collections.defaultdict(list)
valid_times, invalid_times = [], []
req_header_counts, resp_header_counts = collections.Counter(), collections.Counter()
post_sensitive = collections.Counter()
ws = {"records": 0, "handshakes_101": 0, "frames": 0, "directions": collections.Counter(),
      "json_top_keys": collections.Counter(), "channel_classes": collections.Counter(),
      "message_field_types": {}, "token_field_occurrences": 0}
json_parse_failures = []
builds = collections.defaultdict(set)
json_flags = collections.Counter()

for idx, e in enumerate(entries, 1):
    req, resp = e["request"], e["response"]
    u = url.urlsplit(req["url"])
    h = u.hostname or ""
    r = route(req["url"])
    c = resp.get("content", {})
    kind = category(e)
    has_body = bool(c.get("text"))
    rh, sh = headers(req), headers(resp)
    req_header_counts.update(rh.keys())
    resp_header_counts.update(hh["name"].lower() for hh in resp.get("headers", []))
    try:
        stamp = dt.datetime.fromisoformat(e["startedDateTime"].replace("Z", "+00:00"))
        if 2020 <= stamp.year <= 2030:
            valid_times.append(stamp)
        else:
            invalid_times.append(idx)
    except (ValueError, KeyError):
        invalid_times.append(idx)
    row = {"entry": idx, "page": e.get("pageref", ""), "method": req.get("method", ""),
           "route": r, "query_field_names": ",".join(sorted(set(clean_name(k) for k, _ in url.parse_qsl(u.query)))),
           "resource_type": e.get("_resourceType", ""), "status": resp["status"],
           "mime": c.get("mimeType", "").split(";")[0], "time_ms": round(e.get("time", 0), 2),
           "wait_ms": round(e.get("timings", {}).get("wait", -1), 2),
           "transfer_bytes": resp.get("_transferSize", -1), "content_bytes": c.get("size", -1),
           "body_present": has_body, "network_error": resp.get("_error") or ""}
    reqs.append(row)
    groups[(kind, req["url"])].append(idx)
    if resp["status"] == 0 or resp["status"] >= 400:
        errors[(resp["status"], r, e.get("_resourceType", ""), resp.get("_error") or "unrecorded")].append(idx)
    if h == FIRST and e.get("_resourceType") == "document":
        doc_groups[r].append(idx)
    match = re.match(r"/builds/([^/]+)/", u.path)
    if h == FIRST and match:
        builds[match[1]].add(u.path)
    pd = post_body(e)
    if isinstance(pd, dict):
        post_sensitive.update(clean_name(k) for k, v in pd.items() if SECRET_NAME.search(k) and v)
    if h == FIRST and e.get("_resourceType") in {"xhr", "fetch"} and kind == "api_or_fetch" and not u.path.startswith("/cdn-cgi/"):
        selectors = {k: v for k, v in pd.items() if k in SELECTORS and isinstance(v, str)
                     and re.fullmatch(r"[A-Za-z][A-Za-z0-9_/-]{0,60}", v)} if isinstance(pd, dict) else {}
        if u.path == "/websocket.php" and isinstance(pd, dict) and pd.get("q") == "initWebsocketConnection":
            selectors["q"] = "initWebsocketConnection"
        operation = " ".join(k + "=" + selectors[k] for k in sorted(selectors))
        key = (req["method"], r, operation)
        ep = endpoints.setdefault(key, {"method": req["method"], "route": r, "body_operation": operation,
                "entries": [], "status_counts": collections.Counter(), "request_fields": set(),
                "response_field_types": {}, "response_json_types": collections.Counter(), "bodies_present": 0})
        ep["entries"].append(idx)
        ep["status_counts"][str(resp["status"])]+=1
        if isinstance(pd, dict):
            ep["request_fields"].update(clean_name(k) for k in pd)
        ep["bodies_present"] += has_body
        ok, data = json_body(e)
        if ok:
            ep["response_json_types"][type(data).__name__]+=1
            for k, t in field_types(data).items():
                ep["response_field_types"].setdefault(k, set()).add(t)
            if isinstance(data, dict):
                for k in ["success", "error", "status"]:
                    v = data.get(k)
                    if v is False or v is True or isinstance(v, (int, float)):
                        json_flags[(r, k, str(v))]+=1
        elif has_body and "json" in c.get("mimeType", ""):
            json_parse_failures.append(idx)
    if e.get("_resourceType") == "websocket":
        ws["records"]+=1
        ws["handshakes_101"]+=resp["status"]==101
        for m in e.get("_webSocketMessages", []):
            ws["frames"]+=1
            ws["directions"][m.get("type", "unknown")]+=1
            for line in m.get("data", "").splitlines():
                try: data=json.loads(line)
                except ValueError: continue
                if not isinstance(data, dict): continue
                ws["json_top_keys"].update(data.keys())
                if isinstance(data.get("connect"), dict) and data["connect"].get("token"):
                    ws["token_field_occurrences"]+=1
                p=data.get("push", {})
                if not isinstance(p, dict): continue
                channel=p.get("channel", "")
                if channel:
                    safe = "item-market_{id}" if re.fullmatch(r"item-market_\d+", channel) else (
                        channel if channel in {"item-market_Most Popular", "elimination_channel"} else "{opaque-private-channel}")
                    ws["channel_classes"][safe]+=1
                pub=p.get("pub", {})
                if isinstance(pub, dict):
                    ws["message_field_types"].update(field_types(pub.get("data")))

coverage = {}
asset_rows = []
for (kind, original_url), ids in groups.items():
    h=url.urlsplit(original_url).hostname
    k=kind + (":first_party" if h == FIRST else ":other")
    cv=coverage.setdefault(k,{"requests":0,"unique_exact_urls":0,"urls_with_body":0,"entries_with_body":0})
    bodies=[i for i in ids if reqs[i-1]["body_present"]]
    cv["requests"]+=len(ids); cv["unique_exact_urls"]+=1; cv["urls_with_body"]+=bool(bodies); cv["entries_with_body"]+=len(bodies)
    if kind in {"script", "stylesheet", "image", "font", "wasm", "3d_assets"}:
        asset_rows.append({"category":kind,"route":route(original_url),"requests":len(ids),
                           "body_available":bool(bodies),"body_entries":",".join(map(str,bodies)),
                           "example_entry":ids[0]})

ep_list=[]
for ep in endpoints.values():
    ep["request_fields"]=sorted(ep["request_fields"])
    ep["response_field_types"]={k:sorted(v) for k,v in sorted(ep["response_field_types"].items())}
    ep["timing"]=describe(reqs[i-1]["time_ms"] for i in ep["entries"] if reqs[i-1]["status"]==200)
    ep_list.append(ep)
ep_list.sort(key=lambda x:(x["route"],x["method"],x["body_operation"]))
doc_rows=[]
for r, ids in sorted(doc_groups.items()):
    doc_rows.append({"route":r,"requests":len(ids),"status_counts":dict(collections.Counter(str(reqs[i-1]["status"]) for i in ids)),
                     "bodies":sum(reqs[i-1]["body_present"] for i in ids),"entries":ids})
page_rows=[]
for p in log.get("pages",[]):
    ids=[i for i,e in enumerate(entries,1) if e.get("pageref")==p["id"] and e.get("_resourceType")=="document" and url.urlsplit(e["request"]["url"]).hostname==FIRST]
    page_rows.append({"page":p["id"],"started":p.get("startedDateTime"),"routes":list(dict.fromkeys(reqs[i-1]["route"] for i in ids)),
                      "document_entries":ids,"dom_content_ms":p.get("pageTimings",{}).get("onContentLoad"),"load_ms":p.get("pageTimings",{}).get("onLoad")})
summary={
    "source":{"path":str(SOURCE),"bytes":SOURCE.stat().st_size,"sha256":source_hash,"creator":log.get("creator"),"har_version":log.get("version")},
    "totals":{"requests":len(entries),"pages":len(log.get("pages",[])),"exact_request_urls":len(set(e["request"]["url"] for e in entries)),
              "entries_with_body":sum(r["body_present"] for r in reqs),"all_urls_with_body":len(set(e["request"]["url"] for e in entries if e["response"].get("content",{}).get("text"))),
              "first_party_api_operations":len(ep_list),"first_party_api_calls":sum(len(e["entries"]) for e in ep_list)},
    "time":{"first_valid_request":min(valid_times).isoformat(),"last_valid_request":max(valid_times).isoformat(),
            "valid_start_span_seconds":(max(valid_times)-min(valid_times)).total_seconds(),"invalid_request_timestamp_entries":invalid_times,
            "invalid_page_ids":[p["page"] for p in page_rows if not p["started"].startswith("2026-")]},
    "hosts":dict(collections.Counter(url.urlsplit(e["request"]["url"]).hostname for e in entries)),
    "status_counts":dict(collections.Counter(str(e["response"]["status"]) for e in entries)),
    "resource_types":dict(collections.Counter(e.get("_resourceType", "") for e in entries)),
    "coverage":coverage,"build_modules":{k:len(v) for k,v in sorted(builds.items())},
    "traffic":{"reported_transfer_bytes_nonnegative_sum":sum(max(0,r["transfer_bytes"]) for r in reqs),
               "transfer_field_negative_or_missing":sum(r["transfer_bytes"]<0 for r in reqs),
               "zero_transfer_entries":sum(r["transfer_bytes"]==0 for r in reqs),
               "reported_content_size_sum":sum(max(0,r["content_bytes"]) for r in reqs)},
    "timing":{"main_document_200":describe(r["time_ms"] for r in reqs if r["resource_type"]=="document" and r["route"].startswith(FIRST+"/") and r["status"]==200),
              "main_document_200_wait":describe(r["wait_ms"] for r in reqs if r["resource_type"]=="document" and r["route"].startswith(FIRST+"/") and r["status"]==200),
              "page_onload":describe(p["load_ms"] for p in page_rows if p["page"] not in {p["page"] for p in page_rows if not p["started"].startswith("2026-")}),
              "slowest_http_200":sorted([r for r in reqs if r["status"]==200],key=lambda x:x["time_ms"],reverse=True)[:15]},
    "errors":[{"status":s,"route":r,"type":t,"network_error":er,"count":len(ids),"entries":ids} for (s,r,t,er),ids in sorted(errors.items())],
    "prefetch_refusals":dict(collections.Counter(headers(e["response"]).get("cf-speculation-refused", "absent") for e in entries if e["response"]["status"]==503)),
    "sensitive_metadata":{"request_header_counts":dict(req_header_counts),"response_header_counts":dict(resp_header_counts),
                          "sensitive_post_field_occurrences":dict(post_sensitive),"credential_values_exported":False},
    "json_parse_failures":json_parse_failures,"application_flags":[{"route":r,"key":k,"value":v,"count":n} for (r,k,v),n in sorted(json_flags.items())],
    "websocket":ws,"document_routes":doc_rows,"pages":page_rows,"api_operations":ep_list,
    "limitations":["Offline captured evidence only; endpoints and credentials were not replayed.",
                   "Body coverage is grouped by exact URL; query versions can refer to the same resource.",
                   "Timing comes from one cached browsing session and is not a cold-load benchmark.",
                   "Captured request/response schemas do not reveal private server code, database, or complete business rules.",
                   "Field types describe observed samples, not a normative or complete API specification."]}

OUT.mkdir(parents=True,exist_ok=True)
(OUT/"evidence.json").write_text(json.dumps(summary,indent=2,ensure_ascii=True),encoding="utf-8")
write_csv("request_inventory.csv",reqs)
write_csv("asset_coverage.csv",asset_rows)
write_csv("api_operations.csv",[{"method":x["method"],"route":x["route"],"body_operation":x["body_operation"],
          "calls":len(x["entries"]),"bodies_present":x["bodies_present"],"request_fields":",".join(x["request_fields"]),
          "response_top_fields":",".join(k for k in x["response_field_types"] if "." not in k and "[]" not in k),
          "entry_ids":",".join(map(str,x["entries"]))} for x in ep_list])
assert len(reqs)==len(entries)
assert sum(int(v) for v in summary["status_counts"].values())==len(entries)
assert all(x["urls_with_body"]<=x["unique_exact_urls"] for x in coverage.values())
assert len(list(csv.DictReader((OUT/"request_inventory.csv").open(encoding="utf-8"))))==len(entries)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash
print(json.dumps({"verification":"PASS","source_unchanged":True,"totals":summary["totals"],"coverage":coverage,
                  "traffic":summary["traffic"],"timing":{k:v for k,v in summary["timing"].items() if k!="slowest_http_200"},
                  "build_modules":summary["build_modules"],"websocket":ws,"sensitive_post_fields":dict(post_sensitive)},indent=2))
