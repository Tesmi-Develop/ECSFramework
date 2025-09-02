import { BaseSystem, ECSComponent, RobloxInstanceComponent } from "@ecsframework/core";
import { Replicated } from "@ecsframework/replicator";

@Replicated({
	resolvePlayerConnection: (player, entity, data, system) => {
		const instanceData = system.GetComponent<RobloxInstanceComponent>(entity);
		if (!instanceData) return false;
		return instanceData.Instance === player;
	},
})
@ECSComponent()
export class ReadyPlayerTag extends BaseSystem {}
