import type { NextApiRequest, NextApiResponse } from "next";
import { getChannelContext } from "@/lib/nightbot";
import { getChannelState, setChannelState } from "@/lib/state";
import { findEvent } from "@/lib/data";
import { text, error, parseQuery } from "@/lib/api-helpers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { channelId, channelName, isMod } = getChannelContext(req);
  if (!isMod) return error(res, "Mod only.");

  const query = parseQuery(req).toLowerCase();
  const state = await getChannelState(channelId, channelName);

  if (query === "off" || query === "clear" || query === "none") {
    state.activeEvents = [];
    await setChannelState(state);
    return text(res, "All events deactivated.");
  }

  const event = findEvent(query);
  if (!event) return error(res, `Unknown event: ${query}`);

  if (state.activeEvents.includes(event.id)) {
    state.activeEvents = state.activeEvents.filter((e) => e !== event.id);
    await setChannelState(state);
    return text(res, `Event ${event.name} deactivated.`);
  }

  state.activeEvents.push(event.id);
  await setChannelState(state);
  return text(res, `Event ${event.name} activated. Active: ${state.activeEvents.join(", ")}`);
}
