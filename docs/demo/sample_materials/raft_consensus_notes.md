# Lecture Notes: Raft Distributed Consensus Algorithm
**Course:** CS 6824: Distributed Systems  
**Instructor:** Prof. M. Kaashoek  
**Topic:** Replicated State Machines & Consensus Under Crash Failures

---

## 1. Overview and Problem Definition

Distributed consensus is the fundamental problem of getting a collection of fault-tolerant machines to agree on a sequence of values or operations, even in the presence of network partitions, packet loss, and machine crash failures (excluding Byzantine/malicious behavior).

A consensus algorithm typically operates in the context of a **Replicated State Machine** (RSM). Each server in the cluster maintains:
1. A replicated log containing client commands in identical order.
2. A deterministic state machine that executes commands from the log.
3. Consensus module state ensuring that all non-faulty state machines execute identical commands in the identical sequence.

---

## 2. Server States and Transitions

In the Raft consensus algorithm, each node is in one of three mutually exclusive states at any given time:
- **Leader:** Handles all client requests, replicates log entries to follower nodes, and sends periodic heartbeats to maintain authority. There is at most one active leader per term.
- **Candidate:** A transitional state assumed by a follower that has timed out without receiving heartbeats. Candidates solicit votes from peers to become the new leader.
- **Follower:** Completely passive; responds only to incoming remote procedure calls (RPCs) from candidates and leaders. Never issues requests autonomously.

Time in Raft is divided into arbitrary numbered **Terms** (integers $t = 1, 2, 3, \dots$). Terms act as logical clocks, allowing servers to detect obsolete information such as stale leaders.

---

## 3. Leader Election and Split-Brain Prevention

### 3.1 Election Trigger and Heartbeats
A leader maintains its authority by sending periodic empty `AppendEntries` RPCs (heartbeats) to all follower nodes within a configured heartbeat interval (typically 50ms). If a follower receives no communication over an **Election Timeout** interval (typically randomized between 150ms and 300ms), it assumes the leader has failed and transitions to the Candidate state.

### 3.2 Preventing Split-Brain via Quorum
Upon becoming a Candidate:
1. It increments its current term: `currentTerm = currentTerm + 1`.
2. It votes for itself.
3. It issues parallel `RequestVote` RPCs to all other cluster members.

To win an election and assume the Leader state, a candidate must receive votes from a strict **majority quorum** of cluster members:
$$\text{Quorum} = \left\lfloor \frac{N}{2} \right\rfloor + 1$$
For a 5-node cluster, a quorum requires $\lfloor 5/2 \rfloor + 1 = 3$ votes. Because any two majorities must overlap by at least one node, at most one candidate can win the election in any given term. This guarantees that two leaders can never be elected simultaneously, preventing split-brain states.

### 3.3 Randomized Timeouts
If multiple followers timeout simultaneously, votes may split such that no candidate obtains a majority. Raft uses randomized election timeouts (e.g., 150–300 ms) so that one node almost always times out first, starts an election, and wins before other nodes time out.

---

## 4. Log Replication and Safety Invariant

Once elected, the leader accepts commands from clients:
1. Leader appends the command to its local log as a new uncommitted entry.
2. Leader issues `AppendEntries` RPCs in parallel to all followers.
3. When the entry has been safely replicated on a majority of nodes, the leader marks the entry as **committed**.
4. The leader applies the committed entry to its local state machine and returns the result to the client.
5. In subsequent `AppendEntries` RPCs, the leader includes the `leaderCommit` index, instructing followers to commit and apply the entry to their state machines.

### Log Matching Invariant
If two logs contain an entry with the same index and term:
- They store the same command.
- Their logs are identical in all preceding entries up to that index.

If a follower's log conflicts with the leader's, the leader forces the follower's log to duplicate its own by finding the latest index where the logs agree and overwriting any conflicting follower entries.

---

## 5. Candidate Step-Down Rules

A Candidate immediately steps down and returns to the Follower state under two conditions:
1. It receives an `AppendEntries` RPC from another server claiming to be leader whose term is greater than or equal to the candidate's current term.
2. It receives any RPC response containing a term strictly greater than its own current term.
