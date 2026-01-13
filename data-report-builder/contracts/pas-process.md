# Portable Agent System — Day-to-Day Workflow

This is the **exact process** to use the agent system in any project.  
Follow it mechanically. Do not improvise unless you intentionally break the loop.

---

## A. One-Time Setup (per project)

1. **Add core files**
   - `agent-system.md` (unchanged, reused everywhere)
   - `project-primer.md` (project-specific, short)

2. **Create planning artifacts**
   - Problem statement
   - Goals / PRD
   - Technical structure (tools, languages, constraints)

3. **Freeze planning artifacts**
   - Treat these as authoritative
   - No silent revisions during implementation

---

## B. Starting Any Task

1. **Restate the task**
   - One paragraph max
   - Explicit success criteria

2. **(Optional) Add Skill Hints**
   - Constraints, file locations, or gotchas
   - Disposable, task-scoped only

3. **Initialize the agent loop**
   - Agents always run in this order unless explicitly stopped:
     1. Planner
     2. Context Loader
     3. Implementer
     4. Reviewer
     5. Integrator

---

## C. The Agent Loop (core execution)

### 1. Planner
- Produces numbered, step-by-step plan
- Confirms plan satisfies goals completely
- Does **not** edit code

**If the plan feels wrong**
→ Stop and revise goals or constraints  
→ Do not proceed

---

### 2. Context Loader
- Identifies relevant files, systems, APIs
- Surfaces assumptions, risks, and non-negotiables
- Confirms what must not change

**If context reveals conflicts**
→ Escalate back to Planner  
→ Do not implement yet

---

### 3. Implementer
- Implements the approved plan
- Makes minimal, scoped changes
- Outputs **diff only**
- May suggest alternatives *only if blocked*

**If implementation feels hacky or overly complex**
→ Stop and escalate to Reviewer

---

### 4. Reviewer
- Verifies correctness and completeness
- Checks for:
  - Bugs
  - Hacky shortcuts
  - Unnecessary complexity
  - Drift from the plan
- May block progress

**If Reviewer blocks**
→ Return to Implementer with explicit fixes  
→ Do not bypass

---

### 5. Integrator
- Confirms Definition of Done:
  - Code compiles
  - Tests pass
  - Docs updated
  - Goals fully achieved
- Terminates work early if already satisfied
- Escalates disagreements to the user

**Integrator outcomes**
- ✅ Done → Stop
- 🔁 Needs fixes → Route to Implementer
- ❓ Disagreement → User decides

---

## D. How to Handle Stuckness (important)

When progress stalls, **do not reason ad hoc**.

Instead, diagnose the failure type:

- Confusion about goals → Planner
- Missing system understanding → Context Loader
- Bad code → Reviewer
- Endless loop → Integrator

Switch agents explicitly.

---

## E. Rules You Do Not Break

- One agent acts at a time
- Implementer never debugs its own work
- Reviewer never edits code
- Planner does not revise goals mid-stream
- User decisions override all agents

---

## F. Mental Model to Keep

Do not ask:
> "What should I prompt next?"

Ask:
> "Which agent should act next?"

That is the system.

