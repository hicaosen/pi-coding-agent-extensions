/**
 * Proactive Context Compaction Extension
 *
 * After each turn, checks context usage. If it exceeds the threshold AND the
 * agent was mid-task (called tools), compacts and then auto-sends a continue
 * message so the agent resumes without user intervention. If the agent was
 * already done (no tool calls = natural stop), compacts silently.
 *
 * NOTE: compact() internally aborts the running agent, so mid-turn
 * interception is impossible. Instead this extension fires at turn_end
 * (after each LLM response) and uses session_compact to resume if needed.
 *
 * Usage:
 *   pi --extension examples/extensions/proactive-compact.ts
 *   pi --extension examples/extensions/proactive-compact.ts --compact-threshold 50
 *
 * The threshold is a percentage of the context window (default: 30%).
 * Context usage is shown persistently in the footer.
 */

import type { ExtensionAPI, ExtensionContext, TurnEndEvent } from "@mariozechner/pi-coding-agent";

const DEFAULT_THRESHOLD = 30;
const CONTINUE_MESSAGE = "(Context was compacted to stay within limits. Continue with the current task.)";

export default function (pi: ExtensionAPI) {
	let compacting = false;
	let shouldContinueAfterCompact = false;

	pi.registerFlag("compact-threshold", {
		description: `Compact when context usage exceeds this percentage (default: ${DEFAULT_THRESHOLD})`,
		type: "string",
	});

	function getThreshold(): number {
		const flag = pi.getFlag("compact-threshold");
		if (typeof flag === "string") {
			const parsed = Number.parseInt(flag, 10);
			if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 100) {
				return parsed;
			}
		}
		return DEFAULT_THRESHOLD;
	}

	function updateStatus(ctx: ExtensionContext) {
		const theme = ctx.ui.theme;
		const usage = ctx.getContextUsage();

		if (!usage || usage.tokens === null || usage.percent === null) {
			ctx.ui.setStatus("proactive-compact", undefined);
			return;
		}

		const pct = Math.round(usage.percent);
		const limit = getThreshold();

		let indicator: string;
		if (compacting) {
			indicator = theme.fg("warning", "⟳");
		} else if (pct >= limit) {
			indicator = theme.fg("error", "▲");
		} else if (pct >= limit * 0.8) {
			indicator = theme.fg("warning", "▲");
		} else {
			indicator = theme.fg("success", "◉");
		}

		const pctText = pct >= limit ? theme.fg("error", `${pct}%`) : theme.fg("dim", `${pct}%`);
		const label = theme.fg("dim", "ctx:");
		ctx.ui.setStatus("proactive-compact", `${indicator} ${label}${pctText}`);
	}

	pi.on("session_start", (_event, ctx) => {
		updateStatus(ctx);
	});

	pi.on("turn_end", (event: TurnEndEvent, ctx) => {
		updateStatus(ctx);

		if (compacting) return;

		const usage = ctx.getContextUsage();
		if (!usage || usage.percent === null || usage.percent < getThreshold()) return;

		// If the agent made tool calls this turn, it was mid-task — resume after compaction.
		// If no tool calls, it just finished naturally — compact silently.
		shouldContinueAfterCompact = event.toolResults.length > 0;
		compacting = true;

		const pct = `${Math.round(usage.percent)}%`;
		ctx.ui.notify(
			`Compacting context (${pct} used >= ${getThreshold()}%)${shouldContinueAfterCompact ? " — will auto-resume" : ""}...`,
			"info",
		);
		updateStatus(ctx);

		ctx.compact({
			onComplete: () => {
				compacting = false;
				updateStatus(ctx);
			},
			onError: (error) => {
				compacting = false;
				shouldContinueAfterCompact = false;
				ctx.ui.notify(`Compaction failed: ${error.message}`, "error");
				updateStatus(ctx);
			},
		});
	});

	pi.on("session_compact", () => {
		compacting = false;
		if (!shouldContinueAfterCompact) return;
		shouldContinueAfterCompact = false;

		// Resume the agent: the compaction summary + kept tool results give
		// the LLM all the context it needs to continue.
		pi.sendUserMessage(CONTINUE_MESSAGE);
	});
}
