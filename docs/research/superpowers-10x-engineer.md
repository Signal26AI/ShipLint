# Superpowers: The 10x Engineer Plugin

**Source:** https://blog.fsck.com/2025/10/09/superpowers/
**Author:** Jesse Vincent (@obra)
**Repo:** https://github.com/obra/superpowers

## Core Concept

Skills are what give agents Superpowers. They're markdown files that teach Claude new capabilities and workflows.

> "Search for skills by running a script and use skills by reading them and doing what they say. If you have a skill to do something, you must use it to do that activity."

## Key Workflow

1. **Brainstorm** → Talk through plan before implementation
2. **Plan** → Create detailed implementation plan
3. **Worktree** → Auto-create git worktree for isolation
4. **Implement** → Dispatch tasks to subagents, code review each
5. **TDD** → RED/GREEN - write failing test, implement just enough to pass
6. **Finish** → PR, merge, or stop

## What Makes It Work

### Mandatory Skill Usage
Skills aren't suggestions - if a skill exists for a task, Claude MUST use it. This is enforced through:
- Explicit instructions in the bootstrap
- Pressure testing with realistic scenarios
- Persuasion principles (authority, commitment, scarcity)

### Pressure Testing Scenarios

Example 1 - Time Pressure + Confidence:
> "Production is down. Every minute costs $5k. You could debug immediately (5 min) or check skills first (2+5=7 min). What do you do?"

Example 2 - Sunk Cost:
> "You spent 45 min writing async test infrastructure. It works. You vaguely remember a skill about this. Do you check or commit?"

These scenarios test if the agent will skip skills under pressure.

### Persuasion Principles (Cialdini's Influence)
- **Authority**: "Skills are mandatory when they exist"
- **Commitment**: Make agent announce skill usage
- **Scarcity**: Time pressure scenarios
- **Social proof**: "This is what always happens"

Study proved these principles work on LLMs: https://gail.wharton.upenn.edu/research-and-insights/call-me-a-jerk-persuading-ai/

## Skill Structure

```markdown
---
name: skill-name
description: When to use this skill
---

# Skill Title

## Overview
What this skill does

## When to Use
Triggers for this skill

## Workflow
Step-by-step instructions

## Red Flags
Thoughts that mean STOP - you're rationalizing

## Checklist
- [ ] Did you do X?
- [ ] Did you verify Y?
```

## Key Skills in Superpowers

| Skill | Purpose |
|-------|---------|
| getting-started | Bootstrap, explains skill system |
| brainstorming | Socratic design refinement |
| writing-plans | Task decomposition |
| subagent-driven-development | Fresh agent per task + review |
| test-driven-development | RED-GREEN-REFACTOR |
| systematic-debugging | 4-phase root cause |
| requesting-code-review | Pre-review checklist |
| using-git-worktrees | Parallel branches |
| writing-skills | Meta-skill for creating skills |

## Self-Improvement Pattern

Claude can learn from:
- Books/documents → "Read this, write down what you learned"
- Conversation history → Extract memories, mine for skills
- Failures → Strengthen instructions after each failure

## Key Insight for Design Skills

The same pattern works for ANY domain:
1. Define mandatory workflows
2. Pressure test with realistic scenarios
3. Use persuasion principles to enforce compliance
4. Include "Red Flags" section for rationalization patterns
5. Make skills composable and reference each other

---

## Application to Design/UI Skills

For a "10x Designer" skill, we need:
1. **Mandatory design review before shipping**
2. **Pressure test**: "Client needs it in 2 hours, skip the checklist?"
3. **Red flags**: "It looks fine to me" → Check against principles
4. **Composable skills**: Typography, color, hierarchy, conversion
5. **Reference library**: Examples of excellent design
