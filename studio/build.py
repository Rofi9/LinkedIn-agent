"""Build studio/darman-studio.html from src.html, the li-human lexicon, the li-post hooks and
studio/logos.json (data-URI logos made from brand/darman-logo-original.png)."""
import json, os, re
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
d = json.load(open(os.path.join(root, ".claude/skills/li-human/slop.json")))
st = []
for s in d["structures"]:
    r, fl = s["regex"], "gm"
    if r.startswith("(?i)"):
        r, fl = r[4:], fl + "i"
    if "\\U" in r:
        r, fl = re.sub(r"\\U000([0-9A-Fa-f]{5})", r"\\u{\1}", r), fl + "u"
    st.append({"name": s["name"], "re": r, "fl": fl, "fix": s["fix"]})
lex = {"inv": [e["cp"] for e in d["invisible"] if e["action"] == "delete"],
       "invSpace": [e["cp"] for e in d["invisible"] if e["action"] != "delete"],
       "typo": [[e["from"], e["to"]] for e in d["typographic"]],
       "lex": sorted([[e["find"], e["replace"]] for e in d["phrases"] + d["words"]], key=lambda x: -len(x[0])),
       "st": st}
h = json.load(open(os.path.join(root, ".claude/skills/li-post/hooks.json")))
hooks = {"rules": h["rules"], "hooks": [{"id": x["id"], "name": x["name"], "template": x["template"],
         "best": x["best_for"], "trap": x["trap"]} for x in h["hooks"]]}
src = open(os.path.join(here, "src.html")).read()
logos = json.load(open(os.path.join(here, "logos.json")))
out = (src.replace("/*__LEX__*/null", json.dumps(lex)).replace("/*__HOOKS__*/null", json.dumps(hooks))
       .replace("/*__LOGOS__*/null", json.dumps(logos)).replace("__MARK_CORAL__", logos["markCoral"]))
artifact = out.replace("<!--__PLATFORM__-->", "")
open(os.path.join(here, "darman-studio.html"), "w").write(artifact)
print("built artifact", len(artifact), "bytes")

# Self-hosted version: same page plus the server platform layer, as a full HTML document.
platform = open(os.path.join(here, "platform-server.js")).read()
page = out.replace("<!--__PLATFORM__-->", "<script>\n" + platform + "\n</script>")
doc = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
       '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
       '<link rel="icon" href="' + logos["markCoral"] + '">'
       '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
       'body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>'
       '</head><body>' + page + '</body></html>')
os.makedirs(os.path.join(root, "server", "public"), exist_ok=True)
open(os.path.join(root, "server", "public", "index.html"), "w").write(doc)
print("built server page", len(doc), "bytes")
