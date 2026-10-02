#!/usr/bin/env python3
"""
Seed Multimodal Knowledge Base for StudyMate Phase 7 Benchmarking.
Ingests:
1. OS Comprehensive Text (Deadlocks, Banker's, Concurrency)
2. OS Multimodal PDF (Processes, Scheduling, Paging, Virtual Memory - Pages 1-4)
3. Computer Networks Multimodal Slides (OSI, TCP/UDP, Flow Control, Congestion Control - Slides 1-4)
4. DBMS Multimodal Lecture Video (Relational Model, ACID, 2PL, B+ Trees - Timestamps 45s, 150s, 300s, 480s)
5. Algorithms & Data Structures Text (Complexities, Trees, Dynamic Programming)
"""

import os
import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "server"))

from rag_engine import get_collection

def seed_knowledge_base():
    collection = get_collection()

    chunks = [
        # ==========================================
        # 1. Operating Systems - Text Source (src_ad8692700e78)
        # ==========================================
        {
            "id": "os_txt_deadlocks_c1",
            "text": "A deadlock occurs when processes are waiting for resources held by each other. The four Coffman conditions for deadlock are mutual exclusion, hold and wait, no preemption, and circular wait. All four conditions must hold simultaneously for a deadlock to exist. The Banker algorithm tests for safety by simulating the allocation of predetermined maximum possible amounts of all resources, ensuring there exists a safe sequence where all processes can finish.",
            "metadata": {
                "user_id": "default_user",
                "source_id": "src_ad8692700e78",
                "document_id": "doc_os_core",
                "topic": "Operating Systems",
                "subtopic": "Deadlocks & Avoidance",
                "chunk_id": "os_txt_deadlocks_c1",
                "source_type": "TEXT",
                "page_number": -1,
                "slide_number": -1,
                "timestamp_start": -1.0,
                "timestamp_end": -1.0,
            }
        },
        {
            "id": "os_txt_deadlocks_c2",
            "text": "Deadlock prevention functions by eliminating at least one of the four Coffman conditions statically before system execution. For example, invalidating circular wait by imposing a strict global ordering on all resource requests. In contrast, deadlock avoidance dynamically monitors resource allocation requests using algorithms like the Banker algorithm to ensure the system never enters an unsafe state. In a resource allocation graph, hold and wait is represented by assignment and request edges, and circular wait corresponds to a directed cycle in single-unit resource graphs.",
            "metadata": {
                "user_id": "default_user",
                "source_id": "src_ad8692700e78",
                "document_id": "doc_os_core",
                "topic": "Operating Systems",
                "subtopic": "Deadlocks & Avoidance",
                "chunk_id": "os_txt_deadlocks_c2",
                "source_type": "TEXT",
                "page_number": -1,
                "slide_number": -1,
                "timestamp_start": -1.0,
                "timestamp_end": -1.0,
            }
        },

        # ==========================================
        # 2. Operating Systems - Multimodal PDF (src_os_pdf)
        # ==========================================
        {
            "id": "os_pdf_p1_c1",
            "text": "Chapter 3: Process Management. A process is a program in execution. The states of a process include New, Ready, Running, Waiting, and Terminated. The Process Control Block (PCB) contains process state, program counter, CPU registers, CPU scheduling information, and memory management information. A context switch is the mechanism of saving the state of the current running process and restoring the state of another process to resume execution.",
            "metadata": {
                "user_id": "default_user",
                "source_id": "src_os_pdf",
                "document_id": "doc_os_textbook_pdf",
                "topic": "Operating Systems",
                "subtopic": "Process Management",
                "chunk_id": "os_pdf_p1_c1",
                "source_type": "PDF",
                "page_number": 1,
                "slide_number": -1,
                "timestamp_start": -1.0,
                "timestamp_end": -1.0,
            }
        },
        {
            "id": "os_pdf_p2_c1",
            "text": "Chapter 5: CPU Scheduling. The CPU scheduler selects a process from the ready queue to execute when the CPU becomes idle. Common scheduling algorithms include First-Come First-Served (FCFS), Shortest Job First (SJF), Priority Scheduling, and Round Robin (RR). In Round Robin, each process gets a small unit of CPU time known as a time quantum, typically 10 to 100 milliseconds. If the time quantum is too small, excessive context switching overhead occurs, degrading performance into processor sharing.",
            "metadata": {
                "user_id": "default_user",
                "source_id": "src_os_pdf",
                "document_id": "doc_os_textbook_pdf",
                "topic": "Operating Systems",
                "subtopic": "CPU Scheduling",
                "chunk_id": "os_pdf_p2_c1",
                "source_type": "PDF",
                "page_number": 2,
                "slide_number": -1,
                "timestamp_start": -1.0,
                "timestamp_end": -1.0,
            }
        },
        {
            "id": "os_pdf_p3_c1",
            "text": "Chapter 8: Memory Management & Paging. Paging is a memory management scheme that eliminates the need for contiguous allocation of physical memory. Physical memory is divided into fixed-sized blocks called frames, and logical memory is divided into blocks of the same size called pages. A logical address generated by the CPU consists of a page number (p) and a page offset (d). The Translation Lookaside Buffer (TLB) is a fast associative hardware cache used to speed up address translation. If page size is 4KB (2^12 bytes) and logical address is 12500, page number is 3 and offset is 212.",
            "metadata": {
                "user_id": "default_user",
                "source_id": "src_os_pdf",
                "document_id": "doc_os_textbook_pdf",
                "topic": "Operating Systems",
                "subtopic": "Memory Management",
                "chunk_id": "os_pdf_p3_c1",
                "source_type": "PDF",
                "page_number": 3,
                "slide_number": -1,
                "timestamp_start": -1.0,
                "timestamp_end": -1.0,
            }
        },
        {
            "id": "os_pdf_p4_c1",
            "text": "Chapter 9: Virtual Memory and Page Replacement. Virtual memory allows execution of processes that are not completely in physical memory. A page fault trap occurs when a process accesses a page marked invalid in the page table. When physical frames are exhausted, page replacement algorithms choose a victim frame. Common algorithms include FIFO, Optimal Page Replacement (which has the lowest possible page fault rate), and Least Recently Used (LRU), which replaces the page that has not been used for the longest period of time.",
            "metadata": {
                "user_id": "default_user",
                "source_id": "src_os_pdf",
                "document_id": "doc_os_textbook_pdf",
                "topic": "Operating Systems",
                "subtopic": "Virtual Memory",
                "chunk_id": "os_pdf_p4_c1",
                "source_type": "PDF",
                "page_number": 4,
                "slide_number": -1,
                "timestamp_start": -1.0,
                "timestamp_end": -1.0,
            }
        },

        # ==========================================
        # 3. Computer Networks - Multimodal Slides (src_net_slides)
        # ==========================================
        {
            "id": "net_slide_s1_c1",
            "text": "Lecture 2: Layered Network Architecture. The OSI model defines seven layers: Physical, Data Link, Network, Transport, Session, Presentation, Application. In contrast, the Internet TCP/IP protocol suite simplifies this into five layers: Physical, Data Link, Network (IP), Transport (TCP/UDP), and Application. Layering provides modularity, clean interfaces, and independent protocol evolution.",
            "metadata": {
                "user_id": "default_user",
                "source_id": "src_net_slides",
                "document_id": "doc_net_deck",
                "topic": "Computer Networks",
                "subtopic": "Layered Architecture",
                "chunk_id": "net_slide_s1_c1",
                "source_type": "SLIDE",
                "page_number": -1,
                "slide_number": 1,
                "timestamp_start": -1.0,
                "timestamp_end": -1.0,
            }
        },
        {
            "id": "net_slide_s2_c1",
            "text": "Lecture 4: Transport Layer Protocols: TCP vs UDP. Transmission Control Protocol (TCP) is connection-oriented, reliable, byte-stream oriented, and provides flow and congestion control. TCP establishes connections via a 3-way handshake (SYN, SYN-ACK, ACK). In contrast, User Datagram Protocol (UDP) is connectionless, unreliable, message-oriented, and provides low overhead suited for real-time multimedia and DNS.",
            "metadata": {
                "user_id": "default_user",
                "source_id": "src_net_slides",
                "document_id": "doc_net_deck",
                "topic": "Computer Networks",
                "subtopic": "Transport Layer",
                "chunk_id": "net_slide_s2_c1",
                "source_type": "SLIDE",
                "page_number": -1,
                "slide_number": 2,
                "timestamp_start": -1.0,
                "timestamp_end": -1.0,
            }
        },
        {
            "id": "net_slide_s3_c1",
            "text": "Lecture 6: Flow Control & Sliding Window Protocols. Flow control prevents a fast sender from overwhelming a slow receiver. In sliding window protocols, the receiver advertises a receive window (rwnd) indicating buffer availability. In Go-Back-N (GBN), the sender can transmit up to N unacknowledged packets, but a single lost packet requires retransmission of all subsequent packets. Selective Repeat (SR) buffers out-of-order packets and retransmits only lost packets.",
            "metadata": {
                "user_id": "default_user",
                "source_id": "src_net_slides",
                "document_id": "doc_net_deck",
                "topic": "Computer Networks",
                "subtopic": "Flow Control",
                "chunk_id": "net_slide_s3_c1",
                "source_type": "SLIDE",
                "page_number": -1,
                "slide_number": 3,
                "timestamp_start": -1.0,
                "timestamp_end": -1.0,
            }
        },
        {
            "id": "net_slide_s4_c1",
            "text": "Lecture 8: TCP Congestion Control Mechanisms. Congestion control prevents traffic collapse within network routers. TCP uses four core algorithms: Slow Start, Congestion Avoidance, Fast Retransmit, and Fast Recovery. During Slow Start, the congestion window (cwnd) doubles every RTT until reaching slow start threshold (ssthresh). In Congestion Avoidance, cwnd increases linearly by 1 MSS per RTT (Additive Increase Multiplicative Decrease - AIMD). Three duplicate ACKs trigger Fast Retransmit without waiting for retransmission timeout.",
            "metadata": {
                "user_id": "default_user",
                "source_id": "src_net_slides",
                "document_id": "doc_net_deck",
                "topic": "Computer Networks",
                "subtopic": "Congestion Control",
                "chunk_id": "net_slide_s4_c1",
                "source_type": "SLIDE",
                "page_number": -1,
                "slide_number": 4,
                "timestamp_start": -1.0,
                "timestamp_end": -1.0,
            }
        },

        # ==========================================
        # 4. DBMS - Multimodal Lecture Video (src_dbms_video)
        # ==========================================
        {
            "id": "dbms_vid_t1_c1",
            "text": "Video Segment 0:00 - 1:30: Relational Model & Integrity. In the relational database model, data is organized into relations (tables) with tuples (rows) and attributes (columns). A primary key uniquely identifies each tuple in a relation. A foreign key enforces referential integrity between two tables by ensuring referencing attributes match a valid primary key in the referenced relation.",
            "metadata": {
                "user_id": "default_user",
                "source_id": "src_dbms_video",
                "document_id": "doc_dbms_lecture_video",
                "topic": "Database Systems",
                "subtopic": "Relational Model",
                "chunk_id": "dbms_vid_t1_c1",
                "source_type": "VIDEO",
                "page_number": -1,
                "slide_number": -1,
                "timestamp_start": 45.0,
                "timestamp_end": 90.0,
            }
        },
        {
            "id": "dbms_vid_t2_c1",
            "text": "Video Segment 1:30 - 4:00: Transaction Processing & ACID Properties. A database transaction is an atomic unit of program execution. Transactions must satisfy the ACID properties: Atomicity (all-or-nothing execution guaranteed by write-ahead logging), Consistency (database transitions between valid states satisfying constraints), Isolation (concurrent transactions execute without interference), and Durability (committed changes persist despite system crashes).",
            "metadata": {
                "user_id": "default_user",
                "source_id": "src_dbms_video",
                "document_id": "doc_dbms_lecture_video",
                "topic": "Database Systems",
                "subtopic": "Transactions & ACID",
                "chunk_id": "dbms_vid_t2_c1",
                "source_type": "VIDEO",
                "page_number": -1,
                "slide_number": -1,
                "timestamp_start": 150.0,
                "timestamp_end": 240.0,
            }
        },
        {
            "id": "dbms_vid_t3_c1",
            "text": "Video Segment 4:00 - 7:00: Concurrency Control and Two-Phase Locking. Concurrency control manages simultaneous transaction execution to ensure serializability. The Two-Phase Locking (2PL) protocol requires transactions to acquire all locks during a growing phase and release locks during a shrinking phase. Strict 2PL holds all exclusive locks until transaction commit or abort, guaranteeing conflict serializability and preventing cascading rollbacks.",
            "metadata": {
                "user_id": "default_user",
                "source_id": "src_dbms_video",
                "document_id": "doc_dbms_lecture_video",
                "topic": "Database Systems",
                "subtopic": "Concurrency Control",
                "chunk_id": "dbms_vid_t3_c1",
                "source_type": "VIDEO",
                "page_number": -1,
                "slide_number": -1,
                "timestamp_start": 300.0,
                "timestamp_end": 420.0,
            }
        },
        {
            "id": "dbms_vid_t4_c1",
            "text": "Video Segment 7:00 - 10:00: Database Indexing with B+ Trees. A B+ Tree is a self-balancing search tree widely used in relational storage engines. In a B+ Tree, all data records or pointers reside exclusively in the leaf nodes, while internal nodes store only routing search keys. The leaf nodes are linked sequentially as a doubly linked list, enabling highly efficient range queries in O(log n + k) time. If a B+ tree has order 4, each internal node contains at most 3 keys and 4 child pointers.",
            "metadata": {
                "user_id": "default_user",
                "source_id": "src_dbms_video",
                "document_id": "doc_dbms_lecture_video",
                "topic": "Database Systems",
                "subtopic": "Indexing & B+ Trees",
                "chunk_id": "dbms_vid_t4_c1",
                "source_type": "VIDEO",
                "page_number": -1,
                "slide_number": -1,
                "timestamp_start": 480.0,
                "timestamp_end": 600.0,
            }
        },

        # ==========================================
        # 5. Algorithms & Data Structures - Text (src_algo_text)
        # ==========================================
        {
            "id": "algo_txt_c1",
            "text": "Fundamental Algorithm Analysis. Binary search requires a sorted array and executes in O(log n) time complexity by halving the search space each step. Merge sort guarantees O(n log n) worst-case time by divide-and-conquer, while Quick sort has an average time complexity of O(n log n) and worst-case O(n^2). Hash tables provide O(1) average time complexity for search, insert, and delete using collision resolution techniques like chaining or open addressing.",
            "metadata": {
                "user_id": "default_user",
                "source_id": "src_algo_text",
                "document_id": "doc_algo_core",
                "topic": "Algorithms & Data Structures",
                "subtopic": "Algorithm Complexity",
                "chunk_id": "algo_txt_c1",
                "source_type": "TEXT",
                "page_number": -1,
                "slide_number": -1,
                "timestamp_start": -1.0,
                "timestamp_end": -1.0,
            }
        },
        {
            "id": "algo_txt_c2",
            "text": "Dynamic Programming Paradigms. Dynamic programming solves complex optimization problems by breaking them into overlapping subproblems and exhibiting optimal substructure. Techniques include top-down memoization and bottom-up tabulation. Examples include the 0/1 Knapsack problem, Longest Common Subsequence (LCS), and Bellman-Ford shortest paths algorithm.",
            "metadata": {
                "user_id": "default_user",
                "source_id": "src_algo_text",
                "document_id": "doc_algo_core",
                "topic": "Algorithms & Data Structures",
                "subtopic": "Dynamic Programming",
                "chunk_id": "algo_txt_c2",
                "source_type": "TEXT",
                "page_number": -1,
                "slide_number": -1,
                "timestamp_start": -1.0,
                "timestamp_end": -1.0,
            }
        }
    ]

    print(f"Adding {len(chunks)} multimodal chunks to Chroma collection '{collection.name}'...")
    collection.upsert(
        ids=[c["id"] for c in chunks],
        documents=[c["text"] for c in chunks],
        metadatas=[c["metadata"] for c in chunks]
    )
    print(f"Successfully seeded Chroma collection! Total items now: {collection.count()}")

if __name__ == "__main__":
    seed_knowledge_base()
