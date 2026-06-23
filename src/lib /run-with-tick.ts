import { getChannelState, setChannelState } from "@/lib/state";
import { processBiomeTick } from "@/lib/biome-engine";

export async function withTick(channelId: string, channelName: string, fn: (state: any) => Promise<any> | any) {
  const state = await getChannelState(channelId, channelName);

  const elapsed = Date.now() - state.lastTickAt;

  const tick = await processBiomeTick(state, elapsed);
  await setChannelState(tick.state);

  return fn(tick.state);
}
