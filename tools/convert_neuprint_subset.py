#!/usr/bin/env python3
"""Convert *user-curated* neuPrint MaleCNS CSVs to MapFly's small graph JSON.

IMPORTANT
- This script never invents neuron annotations or connectome edges.
- It does NOT simulate action potentials; MapFly supplies hypothetical dynamics.
- You must create node_map.csv with bodyId,region,side after validating biological roles.
- Accepts edges CSV with bodyId_pre,bodyId_post,weight or bodyId1,bodyId2,weight.
"""
import argparse
import csv
import json
from pathlib import Path

REGIONS = {"visual", "olfactory", "central", "motor"}


def load_nodes(path: Path):
    nodes = []
    seen = set()
    with path.open(newline="", encoding="utf-8-sig") as file:
        rows = csv.DictReader(file)
        if not {"bodyId", "region"}.issubset(set(rows.fieldnames or [])):
            raise ValueError("node_map.csv requires bodyId and region columns")
        for row in rows:
            body = row["bodyId"].strip()
            region = row["region"].strip().lower()
            if not body or body in seen:
                raise ValueError(f"Empty/duplicate bodyId: {body}")
            if region not in REGIONS:
                raise ValueError(f"Bad region for bodyId {body}: {region}")
            raw_side = (row.get("side") or "1").strip()
            side = -1 if raw_side in ("L", "left", "-1") else 1
            nodes.append({"id": body, "region": region, "side": side})
            seen.add(body)
    if not (4 <= len(nodes) <= 240):
        raise ValueError("MapFly only supports 4..240 curated neurons per experiment")
    if not {"visual", "central", "motor"}.issubset({n["region"] for n in nodes}):
        raise ValueError("Need visual, central and motor regions")
    return nodes, seen


def load_edges(path: Path, allowed):
    edges = []
    with path.open(newline="", encoding="utf-8-sig") as file:
        rows = csv.DictReader(file)
        names = set(rows.fieldnames or [])
        if {"bodyId_pre", "bodyId_post", "weight"}.issubset(names):
            pre, post = "bodyId_pre", "bodyId_post"
        elif {"bodyId1", "bodyId2", "weight"}.issubset(names):
            pre, post = "bodyId1", "bodyId2"
        else:
            raise ValueError("edges.csv requires bodyId_pre/bodyId_post/weight or bodyId1/bodyId2/weight")
        for row in rows:
            src, dst = row[pre].strip(), row[post].strip()
            if src not in allowed or dst not in allowed:
                continue
            weight = float(row["weight"])
            if not (-100000 <= weight <= 100000):
                raise ValueError("Invalid synapse weight")
            edges.append({"source": src, "target": dst, "weight": weight})
    edges.sort(key=lambda e: abs(e["weight"]), reverse=True)
    if not edges:
        raise ValueError("No synapses between selected neurons")
    return edges[:1600]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--nodes", type=Path, required=True,
                        help="Curated annotations bodyId,region,side")
    parser.add_argument("--edges", type=Path, required=True,
                        help="Export from male-cns:v1.0 neuPrint adjacency query")
    parser.add_argument("--out", type=Path, default=Path("male-cns-mapfly-subset.json"))
    args = parser.parse_args()
    nodes, ids = load_nodes(args.nodes)
    edges = load_edges(args.edges, ids)
    graph = {
        "name": "MaleCNS v1.0 · selected synapses (uploaded, unvalidated motor model)",
        "source": "male-cns:v1.0",
        "provenance": "User-supplied neuPrint CSV, curated group tags, no in-browser validation",
        "nodes": nodes,
        "edges": edges,
    }
    args.out.write_text(json.dumps(graph, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Saved {len(nodes)} real neuron IDs and {len(edges)} supplied edges to {args.out}")
    print("Important: activation dynamics and motor decoding remain simulated in MapFly.")


if __name__ == "__main__":
    main()
