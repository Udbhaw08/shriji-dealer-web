import json
from pathlib import Path
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.wiki import to_wiki

extraction = json.loads(Path("graphify-out/graph.json").read_text(encoding="utf-8"))
G = build_from_json(extraction)
communities = cluster(G)
cohesion = score_all(G, communities)
gods = god_nodes(G)
surprises = surprising_connections(G, communities)
detection = json.loads(Path("graphify-out/.graphify_detect.json").read_text(encoding="utf-8")) if Path("graphify-out/.graphify_detect.json").exists() else {"total_files": 48, "total_words": 56000, "files": {}}

labels = {
    0: "Dealer Auth & Session Management",
    1: "Price Presentation & Product UI",
    2: "Zoho Backend & Proxy Endpoints",
    3: "Dependencies & Package Config",
    4: "Product Pages Specification",
    5: "Master Codebase Architecture Reference",
    6: "Design System & UI Tokens",
    7: "Product Requirements Documentation",
    8: "Pricing Regression Test Suite",
    9: "Zoho Integration Architecture",
    10: "Client Products Data Store",
    11: "Product Brand & Business Vision",
    12: "Live Pricing Audit Tool",
    13: "Architecture Doc Generator",
    14: "Roles & Customer Sharing Spec",
    15: "Pricing Hierarchy & Zero-Leakage Spec",
    16: "Graphify Knowledge Graph Skill",
    17: "Pricing & Roles Skill",
    18: "Mobile Responsive UI Skill",
    19: "Oxlint Linter Configuration",
    20: "Zoho Integration Skill",
    21: "Claude Agent Instructions",
    22: "Project Readme & Layout",
    23: "Agent Guidelines (AGENTS.md)",
    24: "Zoho API Diagnostic Script",
    25: "Testing & Workflow Skill",
    26: "Vercel Deployment Routing",
    27: "Graphify Agent Rules",
    28: "Graphify Workflow",
}

questions = suggest_questions(G, communities, labels)
report = generate(G, communities, cohesion, labels, gods, surprises, detection, {"input": 0, "output": 0}, ".", suggested_questions=questions)
Path("graphify-out/GRAPH_REPORT.md").write_text(report, encoding="utf-8")
Path("graphify-out/.graphify_labels.json").write_text(json.dumps({str(k): v for k, v in labels.items()}, indent=2, ensure_ascii=False), encoding="utf-8")

wiki_count = to_wiki(G, communities, "graphify-out/wiki", community_labels=labels, cohesion=cohesion, god_nodes_data=gods)
print(f"Updated GRAPH_REPORT.md and built {wiki_count} wiki pages in graphify-out/wiki")
