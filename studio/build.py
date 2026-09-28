"""Build studio/darman-studio.html from src.html, the li-human lexicon and the li-post hooks."""
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
out = src.replace("/*__LEX__*/null", json.dumps(lex)).replace("/*__HOOKS__*/null", json.dumps(hooks))
open(os.path.join(here, "darman-studio.html"), "w").write(out)
print("built", len(out), "bytes")
