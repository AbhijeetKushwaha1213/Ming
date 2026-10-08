#!/usr/bin/env python3
"""
High-performance persistent pgvector worker for load testing & benchmarking.
Uses ThreadPoolExecutor to handle concurrent queries across multiple cores
while keeping the embedding model warm in memory to evaluate true data-plane latency.
"""
import sys
import os
import json
import time
import threading
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'server')))
from vector_store import get_vector_store

os.environ.setdefault('VECTOR_STORE', 'pgvector')
os.environ.setdefault('PGVECTOR_TEST_LOCAL', '1')

store = get_vector_store('pgvector')
# Warm up in-memory embedding model
store.query_candidates(query_texts=["warmup in-memory embedding model"], top_k=1, user_id="default_user")

sys.stdout.write(json.dumps({"status": "ready"}) + "\n")
sys.stdout.flush()

stdout_lock = threading.Lock()
executor = ThreadPoolExecutor(max_workers=8)

def process_query(req):
    req_id = req.get("id", "")
    try:
        query = req.get("query", "")
        user_id = req.get("user_id", "default_user")
        top_k = req.get("top_k", 3)
        
        t0 = time.time()
        res = store.query_candidates(query_texts=[query], top_k=top_k, user_id=user_id)
        latency_ms = (time.time() - t0) * 1000.0
        
        ids = res.get("ids", [[]])[0] if res.get("ids") else []
        metas = res.get("metadatas", [[]])[0] if res.get("metadatas") else []
        
        results = []
        for i in range(len(ids)):
            results.append({
                "id": ids[i],
                "user_id": metas[i].get("user_id") if i < len(metas) else None,
                "metadata": metas[i] if i < len(metas) else {}
            })
            
        out = {
            "id": req_id,
            "success": True,
            "results": results,
            "latency_ms": latency_ms
        }
        with stdout_lock:
            sys.stdout.write(json.dumps(out) + "\n")
            sys.stdout.flush()
    except Exception as e:
        with stdout_lock:
            sys.stdout.write(json.dumps({"id": req_id, "success": False, "error": str(e)}) + "\n")
            sys.stdout.flush()

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        req_obj = json.loads(line)
        executor.submit(process_query, req_obj)
    except Exception as e:
        with stdout_lock:
            sys.stdout.write(json.dumps({"id": "", "success": False, "error": str(e)}) + "\n")
            sys.stdout.flush()
